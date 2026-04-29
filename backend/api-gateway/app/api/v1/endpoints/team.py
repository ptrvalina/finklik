"""Team management: invite users, list org members, manage roles."""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import hash_password
from app.models.user import User, Organization, Invitation
from app.services.email_service import send_invite_email

router = APIRouter(prefix="/team", tags=["team"])


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


@router.get("/members")
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users in the current organization."""
    result = await db.execute(
        select(User).where(User.organization_id == current_user.organization_id)
    )
    users = result.scalars().all()
    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
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
            Invitation.organization_id == current_user.organization_id,
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
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Организация не найдена")

    user_count = await db.execute(
        select(func.count(User.id)).where(
            User.organization_id == current_user.organization_id,
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
            Invitation.organization_id == current_user.organization_id,
            Invitation.status == "pending",
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(409, "Приглашение уже отправлено на этот email")

    invite_code = secrets.token_urlsafe(32)
    invitation = Invitation(
        organization_id=current_user.organization_id,
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


@router.post("/accept-invite")
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

    if invitation.expires_at < datetime.now(timezone.utc):
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

    from app.core.security import create_access_token, create_refresh_token
    from app.core.config import settings

    access_token = create_access_token(str(user.id), str(user.organization_id), user.role)
    refresh_token = create_refresh_token(str(user.id))

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
        select(User).where(
            User.id == user_id,
            User.organization_id == current_user.organization_id,
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
            Invitation.organization_id == current_user.organization_id,
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(404, "Приглашение не найдено")

    invitation.status = "expired"
    await db.flush()
    return {"ok": True}
