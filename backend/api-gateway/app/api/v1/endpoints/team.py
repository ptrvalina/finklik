"""Team management: invite users, list org members, manage roles."""
import json
import secrets
from datetime import datetime, timedelta, timezone

from app.core.datetime_utils import utc_now_naive

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user, require_roles, workspace_organization_id
from app.core.security import hash_password
from app.models.user import User, Organization, Invitation, UserOrganizationMembership
from app.models.bank_account import BankAccount
from app.services.email_service import send_invite_email
from app.events.emit import (
    emit_business_profile_completed,
    emit_oked_selected,
    emit_tax_mode_selected,
)
from app.services.product_contour import (
    LEGAL_FORM_LABELS,
    TAX_REGIME_LABELS,
    is_tax_regime_valid,
    normalize_legal_form,
    resolve_product_contour,
    suggested_accounting_mode,
)

router = APIRouter(
    prefix="/team",
    tags=["team"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)

# Публичные team-эндпоинты (без JWT) — отдельный router без role-guard.
public_router = APIRouter(prefix="/team", tags=["team"])


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="accountant", pattern="^(accountant|manager|viewer)$")


class InviteAcceptRequest(BaseModel):
    invite_code: str
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=100)


class TeamMemberResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganizationRequisitesOut(BaseModel):
    name: str
    unp: str
    legal_form: str
    tax_regime: str
    legal_address: str | None = None
    ceo_name: str | None = None
    director_fallback: str | None = None
    bank_accounts: list[dict]


class OrganizationRequisitesPatch(BaseModel):
    legal_address: str | None = None
    ceo_name: str | None = None


class ProductContourOut(BaseModel):
    id: str
    accounting_mode: str
    features: dict


class BusinessProfileOut(BaseModel):
    legal_form: str
    tax_regime: str
    oked_primary: str | None = None
    oked_secondary: list[str] = Field(default_factory=list)
    employee_count_band: str | None = None
    business_profile_completed: bool = False
    product_contour: ProductContourOut


class BusinessProfilePatch(BaseModel):
    legal_form: str | None = Field(default=None, max_length=20)
    tax_regime: str | None = Field(default=None, max_length=32)
    oked_primary: str | None = Field(default=None, max_length=12)
    oked_secondary: list[str] | None = None
    employee_count_band: str | None = Field(
        default=None,
        pattern="^(none|up_to_5|up_to_20|over_20)$",
    )
    mark_completed: bool = False


def _tax_regime_label(code: str) -> str:
    return TAX_REGIME_LABELS.get((code or "").strip().lower(), code or "—")


def _legal_form_label(v: str) -> str:
    return LEGAL_FORM_LABELS.get(normalize_legal_form(v), v or "—")


def _business_profile_out(org: Organization) -> BusinessProfileOut:
    contour = resolve_product_contour(org.legal_form, org.tax_regime)
    return BusinessProfileOut(
        legal_form=org.legal_form,
        tax_regime=org.tax_regime,
        oked_primary=org.oked_primary,
        oked_secondary=_parse_oked_secondary(org.oked_secondary_json),
        employee_count_band=org.employee_count_band,
        business_profile_completed=org.business_profile_completed_at is not None,
        product_contour=ProductContourOut(
            id=contour["id"],
            accounting_mode=contour["accounting_mode"],
            features=contour["features"],
        ),
    )


def _parse_oked_secondary(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x) for x in data if x]
    except json.JSONDecodeError:
        pass
    return []


@router.get("/organization/business-profile", response_model=BusinessProfileOut)
async def get_business_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    oid = workspace_organization_id(current_user)
    org = (await db.execute(select(Organization).where(Organization.id == oid))).scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Организация не найдена")
    return _business_profile_out(org)


@router.patch("/organization/business-profile", response_model=BusinessProfileOut)
async def patch_business_profile(
    body: BusinessProfilePatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(403, "Только владелец может изменять профиль организации")
    oid = workspace_organization_id(current_user)
    org = (await db.execute(select(Organization).where(Organization.id == oid))).scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Организация не найдена")

    if body.legal_form is not None:
        org.legal_form = normalize_legal_form(body.legal_form)
    if body.tax_regime is not None:
        tax = body.tax_regime.strip().lower()
        if not is_tax_regime_valid(org.legal_form, tax):
            raise HTTPException(
                422,
                f"Режим «{tax}» недоступен для ОПФ «{_legal_form_label(org.legal_form)}»",
            )
        org.tax_regime = tax
        await emit_tax_mode_selected(
            db, oid, tax_regime=org.tax_regime, legal_form=org.legal_form, actor=str(current_user.id)
        )
    if body.legal_form is not None or body.tax_regime is not None:
        org.accounting_mode = suggested_accounting_mode(org.legal_form, org.tax_regime)
    if body.oked_primary is not None:
        org.oked_primary = body.oked_primary.strip()
        secondary = body.oked_secondary if body.oked_secondary is not None else _parse_oked_secondary(org.oked_secondary_json)
        org.oked_secondary_json = json.dumps(secondary, ensure_ascii=False)
        await emit_oked_selected(db, oid, oked_primary=org.oked_primary, oked_secondary=secondary, actor=str(current_user.id))
    elif body.oked_secondary is not None:
        org.oked_secondary_json = json.dumps(body.oked_secondary, ensure_ascii=False)
    if body.employee_count_band is not None:
        org.employee_count_band = body.employee_count_band
    if body.mark_completed:
        org.business_profile_completed_at = datetime.now(timezone.utc)
        await emit_business_profile_completed(db, oid, actor=str(current_user.id))

    await db.commit()
    await db.refresh(org)
    return _business_profile_out(org)


def _build_requisites_text(org: Organization, banks: list[BankAccount], director_fallback: str | None) -> bytes:
    lines: list[str] = []
    lines.append("РЕКВИЗИТЫ ОРГАНИЗАЦИИ (для договоров и счетов)")
    lines.append("")
    lines.append(f"Наименование: {org.name}")
    lines.append(f"УНП: {org.unp}")
    lines.append(f"ОПФ: {_legal_form_label(org.legal_form)}")
    lines.append(f"Режим налогообложения: {_tax_regime_label(org.tax_regime)}")
    lines.append(f"Юридический адрес: {org.legal_address or '—'}")
    ceo = org.ceo_name or director_fallback or "—"
    lines.append(f"Руководитель (подписант): {ceo}")
    lines.append("")
    if banks:
        lines.append("Банковские счета:")
        for b in banks:
            prim = " (основной)" if b.is_primary else ""
            lines.append(
                f"  • {b.bank_name}, БИК {b.bank_bic}, р/с {b.account_number}, "
                f"{b.currency}{prim}"
            )
    else:
        lines.append("Банковские счета: не указаны в разделе «Банк».")
    lines.append("")
    lines.append("—")
    lines.append("Файл сформирован в личном кабинете ФинКлик. При необходимости дополните адрес и ФИО руководителя в Настройках.")
    return ("\n".join(lines)).encode("utf-8")


@router.get("/members")
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Участники активной организации (по членству, не только «домашний» профиль)."""
    oid = workspace_organization_id(current_user)
    result = await db.execute(
        select(User)
        .join(UserOrganizationMembership, UserOrganizationMembership.user_id == User.id)
        .where(UserOrganizationMembership.organization_id == oid)
    )
    users = result.scalars().all()
    org_result = await db.execute(
        select(Organization).where(Organization.id == workspace_organization_id(current_user))
    )
    org = org_result.scalar_one_or_none()

    return {
        "members": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ],
        "max_users": org.max_users if org else 2,
        "current_count": len(users),
    }


@router.get("/invitations")
async def list_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List pending invitations."""
    result = await db.execute(
        select(Invitation).where(
            Invitation.organization_id == workspace_organization_id(current_user),
            Invitation.status == "pending",
        )
    )
    invitations = result.scalars().all()
    return {
        "invitations": [
            {
                "id": inv.id,
                "email": inv.email,
                "role": inv.role,
                "invite_code": inv.invite_code,
                "created_at": inv.created_at.isoformat(),
                "expires_at": inv.expires_at.isoformat(),
            }
            for inv in invitations
        ]
    }


@router.post("/invite")
async def invite_user(
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a second user to the organization. Only owner can invite."""
    if current_user.role != "owner":
        raise HTTPException(403, "Только владелец может приглашать пользователей")

    org_result = await db.execute(
        select(Organization).where(Organization.id == workspace_organization_id(current_user))
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Организация не найдена")

    user_count = await db.execute(
        select(func.count(User.id))
        .select_from(User)
        .join(UserOrganizationMembership, UserOrganizationMembership.user_id == User.id)
        .where(
            UserOrganizationMembership.organization_id == workspace_organization_id(current_user),
            User.is_active == True,
        )
    )
    count = user_count.scalar() or 0
    if count >= org.max_users:
        raise HTTPException(400, f"Достигнут лимит пользователей ({org.max_users}). Обратитесь в поддержку для расширения.")

    existing_user = await db.execute(
        select(User).where(User.email == body.email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(409, "Пользователь с таким email уже зарегистрирован")

    existing_invite = await db.execute(
        select(Invitation).where(
            Invitation.email == body.email,
            Invitation.organization_id == workspace_organization_id(current_user),
            Invitation.status == "pending",
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(409, "Приглашение уже отправлено на этот email")

    invite_code = secrets.token_urlsafe(32)
    invitation = Invitation(
        organization_id=workspace_organization_id(current_user),
        email=body.email,
        role=body.role,
        invite_code=invite_code,
        invited_by=current_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invitation)
    await db.flush()

    invite_url = f"{settings.FRONTEND_URL}/accept-invite?code={invite_code}"
    email_sent = await send_invite_email(body.email, org.name, invite_code, invite_url)

    return {
        "id": invitation.id,
        "email": body.email,
        "role": body.role,
        "invite_code": invite_code,
        "expires_at": invitation.expires_at.isoformat(),
        "email_sent": email_sent,
        "message": f"Приглашение создано. {'Email отправлен.' if email_sent else f'Код: {invite_code}'}",
    }


@public_router.post("/accept-invite")
async def accept_invitation(
    body: InviteAcceptRequest,
    db: AsyncSession = Depends(get_db),
):
    """Accept an invitation and create a new user account."""
    result = await db.execute(
        select(Invitation).where(
            Invitation.invite_code == body.invite_code,
            Invitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(404, "Приглашение не найдено или истекло")

    expires_at = invitation.expires_at
    if expires_at.tzinfo is not None:
        expires_at = expires_at.replace(tzinfo=None)
    if expires_at < utc_now_naive():
        invitation.status = "expired"
        await db.flush()
        raise HTTPException(400, "Срок приглашения истёк")

    existing = await db.execute(select(User).where(User.email == invitation.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Пользователь уже зарегистрирован")

    user = User(
        email=invitation.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=invitation.role,
        organization_id=invitation.organization_id,
    )
    db.add(user)
    invitation.status = "accepted"
    await db.flush()
    db.add(
        UserOrganizationMembership(
            user_id=user.id,
            organization_id=invitation.organization_id,
            role_in_org=user.role,
            is_pinned=False,
        )
    )
    await db.flush()

    from app.core.security import create_access_token, create_refresh_token_pair
    from app.core.config import settings

    access_token = create_access_token(str(user.id), str(user.organization_id), user.role)
    refresh_token, jti = create_refresh_token_pair(str(user.id))
    user.refresh_token_jti = jti
    await db.flush()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.delete("/members/{user_id}")
async def deactivate_member(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a team member. Owner only."""
    if current_user.role != "owner":
        raise HTTPException(403, "Только владелец может управлять участниками")
    if user_id == current_user.id:
        raise HTTPException(400, "Нельзя деактивировать самого себя")

    result = await db.execute(
        select(User)
        .join(UserOrganizationMembership, UserOrganizationMembership.user_id == User.id)
        .where(
            User.id == user_id,
            UserOrganizationMembership.organization_id == workspace_organization_id(current_user),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    user.is_active = False
    await db.flush()
    return {"ok": True, "message": f"Пользователь {user.email} деактивирован"}


@router.delete("/invitations/{invite_id}")
async def cancel_invitation(
    invite_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a pending invitation."""
    if current_user.role != "owner":
        raise HTTPException(403, "Только владелец может отменять приглашения")

    result = await db.execute(
        select(Invitation).where(
            Invitation.id == invite_id,
            Invitation.organization_id == workspace_organization_id(current_user),
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(404, "Приглашение не найдено")

    invitation.status = "expired"
    await db.flush()
    return {"ok": True}


@router.get("/organization/requisites", response_model=OrganizationRequisitesOut)
async def get_organization_requisites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not workspace_organization_id(current_user):
        raise HTTPException(400, detail="Нет организации")
    org_r = await db.execute(select(Organization).where(Organization.id == workspace_organization_id(current_user)))
    org = org_r.scalar_one_or_none()
    if not org:
        raise HTTPException(404, detail="Организация не найдена")

    own_r = await db.execute(
        select(User).where(
            User.organization_id == org.id,
            User.role == "owner",
            User.is_active == True,  # noqa: E712
        )
    )
    owner = own_r.scalar_one_or_none()

    bank_r = await db.execute(
        select(BankAccount).where(
            BankAccount.organization_id == org.id,
            BankAccount.is_active == True,  # noqa: E712
        ).order_by(BankAccount.is_primary.desc(), BankAccount.created_at)
    )
    banks = list(bank_r.scalars().all())

    return OrganizationRequisitesOut(
        name=org.name,
        unp=org.unp,
        legal_form=org.legal_form,
        tax_regime=org.tax_regime,
        legal_address=org.legal_address,
        ceo_name=org.ceo_name,
        director_fallback=owner.full_name if owner else None,
        bank_accounts=[
            {
                "id": b.id,
                "bank_name": b.bank_name,
                "bank_bic": b.bank_bic,
                "account_number": b.account_number,
                "currency": b.currency,
                "is_primary": b.is_primary,
            }
            for b in banks
        ],
    )


@router.patch("/organization/requisites", response_model=OrganizationRequisitesOut)
async def patch_organization_requisites(
    body: OrganizationRequisitesPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not workspace_organization_id(current_user):
        raise HTTPException(400, detail="Нет организации")
    org_r = await db.execute(select(Organization).where(Organization.id == workspace_organization_id(current_user)))
    org = org_r.scalar_one_or_none()
    if not org:
        raise HTTPException(404, detail="Организация не найдена")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(org, k, v)
    await db.flush()

    return await get_organization_requisites(current_user=current_user, db=db)  # type: ignore[misc]


@router.get("/organization/requisites-export")
async def export_organization_requisites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not workspace_organization_id(current_user):
        raise HTTPException(400, detail="Нет организации")
    org_r = await db.execute(select(Organization).where(Organization.id == workspace_organization_id(current_user)))
    org = org_r.scalar_one_or_none()
    if not org:
        raise HTTPException(404, detail="Организация не найдена")

    own_r = await db.execute(
        select(User).where(
            User.organization_id == org.id,
            User.role == "owner",
            User.is_active == True,  # noqa: E712
        )
    )
    owner = own_r.scalar_one_or_none()

    bank_r = await db.execute(
        select(BankAccount).where(
            BankAccount.organization_id == org.id,
            BankAccount.is_active == True,  # noqa: E712
        ).order_by(BankAccount.is_primary.desc(), BankAccount.created_at)
    )
    banks = list(bank_r.scalars().all())

    data = _build_requisites_text(org, banks, owner.full_name if owner else None)
    safe_unp = "".join(ch for ch in org.unp if ch.isalnum())
    filename = f"rekvizity-{safe_unp or 'org'}.txt"
    return StreamingResponse(
        iter([data]),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
