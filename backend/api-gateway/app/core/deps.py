from contextvars import ContextVar

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserOrganizationMembership

bearer_scheme = HTTPBearer()

_workspace_oid_cv: ContextVar[str | None] = ContextVar("_workspace_oid_cv", default=None)


async def resolve_workspace_organization_id(
    db: AsyncSession,
    user: User,
    token_org_id: str | None,
) -> str:
    """Активная организация из JWT + таблица членства; без ERP-сложности."""
    uid = str(user.id)
    tok = (token_org_id or "").strip() or None

    async def has_membership(org_id: str) -> bool:
        r = await db.execute(
            select(UserOrganizationMembership.id).where(
                UserOrganizationMembership.user_id == uid,
                UserOrganizationMembership.organization_id == org_id,
            ).limit(1)
        )
        return r.scalar_one_or_none() is not None

    if tok:
        if await has_membership(tok):
            return tok
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к выбранной организации",
        )

    home = str(user.organization_id) if user.organization_id else ""
    if home:
        if await has_membership(home):
            return home
        return home

    r = await db.execute(
        select(UserOrganizationMembership.organization_id)
        .where(UserOrganizationMembership.user_id == uid)
        .order_by(UserOrganizationMembership.last_used_at.desc().nulls_last())
        .limit(1)
    )
    fallback = r.scalar_one_or_none()
    if fallback:
        return str(fallback)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет организации для работы")


def workspace_organization_id(user: User) -> str:
    ctx = _workspace_oid_cv.get()
    if ctx:
        return ctx
    return str(user.organization_id) if user.organization_id else ""


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    raw_org = payload.get("org_id")
    token_org = raw_org if isinstance(raw_org, str) and raw_org.strip() else None
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    oid = await resolve_workspace_organization_id(db, user, token_org)
    _workspace_oid_cv.set(oid)
    return user


def require_roles(*allowed_roles: str):
    normalized = {r.strip().lower() for r in allowed_roles if r and r.strip()}

    async def _dependency(current_user: User = Depends(get_current_user)) -> User:
        # Совместимость: историческая роль owner эквивалентна новой admin.
        current_role = (current_user.role or "").strip().lower()
        effective_role = "admin" if current_role == "owner" else current_role
        effective_allowed = {"admin" if r == "owner" else r for r in normalized}
        if effective_role not in effective_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для выполнения операции",
            )
        return current_user

    return _dependency
