"""Мульти-организационное рабочее пространство: переключение клиента, inbox, согласования, комментарии."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.datetime_utils import utc_now_naive
from app.core.deps import (
    get_current_user,
    require_roles,
    resolve_workspace_organization_id,
    workspace_organization_id,
)
from app.core.security import create_access_token, create_refresh_token_pair
from app.events.emit import (
    emit_approval_completed,
    emit_approval_requested,
    emit_comment_added,
    emit_document_requested,
    emit_organization_switched,
)
from app.models.collaboration import ApprovalRequest, CollaborationComment, OperationalInboxItem
from app.models.user import Organization, User, UserOrganizationMembership
from app.schemas.auth import TokenResponse
from app.services.accountant_workspace_service import build_accountant_workspace_summary

REFRESH_COOKIE_NAME = "refresh_token"


def _attach_refresh_cookie(response: JSONResponse, refresh_token: str) -> JSONResponse:
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    sm = settings.REFRESH_COOKIE_SAMESITE
    secure = sm == "none" or not settings.DEBUG
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite=sm,
        path="/",
    )
    return response


router = APIRouter(prefix="/workspace", tags=["workspace"])


class SwitchBody(BaseModel):
    organization_id: str = Field(min_length=1)


class PinBody(BaseModel):
    pinned: bool


class InboxCreate(BaseModel):
    kind: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=500)
    body: str = ""
    priority: str = Field(default="normal", pattern="^(low|normal|high)$")
    linked_transaction_id: str | None = None
    linked_document_id: str | None = None
    assignee_user_id: str | None = None
    due_at: datetime | None = None


class InboxPatch(BaseModel):
    status: Literal["open", "done", "snoozed"] | None = None


class ApprovalCreate(BaseModel):
    subject_kind: str = Field(min_length=1, max_length=40)
    subject_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=500)
    note: str | None = None


class ApprovalResolve(BaseModel):
    status: str = Field(pattern="^(approved|rejected|clarification)$")
    note: str | None = None


class CommentCreate(BaseModel):
    target_kind: str = Field(min_length=1, max_length=40)
    target_id: str = Field(min_length=1, max_length=64)
    body: str = Field(min_length=1)


@router.get("/memberships")
async def list_memberships(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Организации, в которых у пользователя есть доступ (закрепление, недавние)."""
    r = await db.execute(
        select(UserOrganizationMembership, Organization)
        .join(Organization, Organization.id == UserOrganizationMembership.organization_id)
        .where(UserOrganizationMembership.user_id == current_user.id)
        .order_by(UserOrganizationMembership.is_pinned.desc(), Organization.name.asc())
    )
    rows = []
    for mem, org in r.all():
        rows.append(
            {
                "organization_id": org.id,
                "name": org.name,
                "unp": org.unp,
                "is_pinned": mem.is_pinned,
                "last_used_at": mem.last_used_at.isoformat() if mem.last_used_at else None,
                "is_active_workspace": org.id == workspace_organization_id(current_user),
            }
        )
    return {"memberships": rows, "active_organization_id": workspace_organization_id(current_user)}


@router.post("/switch", response_model=TokenResponse)
async def switch_workspace(
    body: SwitchBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Переключить активную организацию (новый access token + событие)."""
    oid = await resolve_workspace_organization_id(db, current_user, body.organization_id.strip())
    mr = await db.execute(
        select(UserOrganizationMembership).where(
            UserOrganizationMembership.user_id == current_user.id,
            UserOrganizationMembership.organization_id == oid,
        )
    )
    mem = mr.scalar_one_or_none()
    if mem:
        mem.last_used_at = utc_now_naive()
        await db.flush()
    await emit_organization_switched(db, oid, user_id=str(current_user.id))
    access_token = create_access_token(str(current_user.id), oid, current_user.role)
    refresh_token, jti = create_refresh_token_pair(str(current_user.id))
    current_user.refresh_token_jti = jti
    await db.flush()
    payload = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    ).model_dump()
    resp = JSONResponse(content=payload)
    return _attach_refresh_cookie(resp, refresh_token)


@router.patch("/memberships/{organization_id}/pin")
async def pin_membership(
    organization_id: str,
    body: PinBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_workspace_organization_id(db, current_user, organization_id)
    r = await db.execute(
        select(UserOrganizationMembership).where(
            UserOrganizationMembership.user_id == current_user.id,
            UserOrganizationMembership.organization_id == organization_id,
        )
    )
    mem = r.scalar_one_or_none()
    if not mem:
        raise HTTPException(404, "Членство не найдено")
    mem.is_pinned = body.pinned
    await db.flush()
    return {"ok": True, "organization_id": organization_id, "pinned": body.pinned}


@router.get("/accountant/overview", dependencies=[Depends(require_roles("admin", "accountant"))])
async def accountant_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Командный центр: карточки клиентов с готовностью и очередями (не CRM)."""
    return await build_accountant_workspace_summary(db, str(current_user.id))


@router.get("/inbox")
async def inbox_list(
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = workspace_organization_id(current_user)
    q = select(OperationalInboxItem).where(OperationalInboxItem.organization_id == oid)
    if status:
        q = q.where(OperationalInboxItem.status == status)
    q = q.order_by(OperationalInboxItem.created_at.desc()).limit(100)
    r = await db.execute(q)
    items = r.scalars().all()
    return {
        "items": [
            {
                "id": i.id,
                "kind": i.kind,
                "title": i.title,
                "body": i.body,
                "status": i.status,
                "priority": i.priority,
                "linked_transaction_id": i.linked_transaction_id,
                "linked_document_id": i.linked_document_id,
                "assignee_user_id": i.assignee_user_id,
                "created_by_user_id": i.created_by_user_id,
                "due_at": i.due_at.isoformat() if i.due_at else None,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ]
    }


@router.post("/inbox")
async def inbox_create(
    body: InboxCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    row = OperationalInboxItem(
        organization_id=oid,
        kind=body.kind,
        title=body.title,
        body=body.body,
        priority=body.priority,
        linked_transaction_id=body.linked_transaction_id,
        linked_document_id=body.linked_document_id,
        assignee_user_id=body.assignee_user_id,
        created_by_user_id=str(current_user.id),
        due_at=body.due_at.replace(tzinfo=None) if body.due_at else None,
    )
    db.add(row)
    await db.flush()
    if body.kind in ("document_request", "missing_document", "upload_reminder"):
        await emit_document_requested(db, oid, row.id, kind=body.kind, actor="user")
    return {"id": row.id, "status": "ok"}


@router.patch("/inbox/{item_id}")
async def inbox_patch(
    item_id: str,
    body: InboxPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    r = await db.execute(
        select(OperationalInboxItem).where(
            OperationalInboxItem.id == item_id,
            OperationalInboxItem.organization_id == oid,
        )
    )
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Запись не найдена")
    if body.status is None:
        raise HTTPException(400, "Укажите status")
    row.status = body.status
    await db.flush()
    return {"ok": True}


@router.get("/approvals")
async def approvals_list(
    status_filter: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = workspace_organization_id(current_user)
    q = select(ApprovalRequest).where(ApprovalRequest.organization_id == oid)
    if status_filter:
        q = q.where(ApprovalRequest.status == status_filter)
    q = q.order_by(ApprovalRequest.created_at.desc()).limit(100)
    r = await db.execute(q)
    rows = r.scalars().all()
    return {
        "items": [
            {
                "id": x.id,
                "subject_kind": x.subject_kind,
                "subject_id": x.subject_id,
                "title": x.title,
                "note": x.note,
                "status": x.status,
                "requested_by_user_id": x.requested_by_user_id,
                "resolved_by_user_id": x.resolved_by_user_id,
                "resolved_at": x.resolved_at.isoformat() if x.resolved_at else None,
                "created_at": x.created_at.isoformat() if x.created_at else None,
            }
            for x in rows
        ]
    }


@router.post("/approvals")
async def approvals_create(
    body: ApprovalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    row = ApprovalRequest(
        organization_id=oid,
        subject_kind=body.subject_kind,
        subject_id=body.subject_id,
        title=body.title,
        note=body.note,
        requested_by_user_id=str(current_user.id),
    )
    db.add(row)
    await db.flush()
    await emit_approval_requested(
        db,
        oid,
        row.id,
        subject_kind=body.subject_kind,
        subject_id=body.subject_id,
        actor="user",
    )
    return {"id": row.id}


@router.patch("/approvals/{approval_id}")
async def approvals_resolve(
    approval_id: str,
    body: ApprovalResolve,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "accountant")),
):
    oid = workspace_organization_id(current_user)
    r = await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.id == approval_id,
            ApprovalRequest.organization_id == oid,
        )
    )
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Согласование не найдено")
    row.status = body.status
    row.resolved_by_user_id = str(current_user.id)
    row.resolved_at = utc_now_naive()
    if body.note is not None:
        row.note = body.note
    await db.flush()
    await emit_approval_completed(db, oid, approval_id, status=body.status, actor="user")
    return {"ok": True}


@router.get("/comments")
async def comments_list(
    target_kind: str | None = None,
    target_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = workspace_organization_id(current_user)
    q = select(CollaborationComment).where(CollaborationComment.organization_id == oid)
    if target_kind and target_id:
        q = q.where(
            CollaborationComment.target_kind == target_kind,
            CollaborationComment.target_id == target_id,
        )
    q = q.order_by(CollaborationComment.created_at.asc()).limit(200)
    r = await db.execute(q)
    rows = r.scalars().all()
    return {
        "comments": [
            {
                "id": c.id,
                "author_user_id": c.author_user_id,
                "target_kind": c.target_kind,
                "target_id": c.target_id,
                "body": c.body,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in rows
        ]
    }


@router.post("/comments")
async def comments_create(
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = workspace_organization_id(current_user)
    row = CollaborationComment(
        organization_id=oid,
        author_user_id=str(current_user.id),
        target_kind=body.target_kind,
        target_id=body.target_id,
        body=body.body,
    )
    db.add(row)
    await db.flush()
    await emit_comment_added(
        db,
        oid,
        row.id,
        target_kind=body.target_kind,
        target_id=body.target_id,
        actor="user",
    )
    return {"id": row.id}
