from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
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
