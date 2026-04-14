from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.user import User, Organization
from app.services.onec_contour_service import ensure_onec_contour_record
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, TokenResponse, UserResponse
from app.security import check_brute_force, record_failed_login, record_successful_login, audit_log

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")

    existing_org = await db.execute(select(Organization).where(Organization.unp == body.org_unp))
    if existing_org.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Организация с УНП {body.org_unp} уже зарегистрирована")

    org = Organization(
        name=body.org_name,
        unp=body.org_unp,
        legal_form=body.legal_form,
        tax_regime=body.tax_regime,
    )
    db.add(org)
    await db.flush()
    await ensure_onec_contour_record(db, org)

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role="owner",
        organization_id=org.id,
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token(str(user.id), str(org.id), user.role)
    refresh_token = create_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    check_brute_force(body.email)

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        record_failed_login(body.email)
        audit_log("login_failed", None, "auth", None, ip, {"email": body.email}, success=False)
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт деактивирован")

    record_successful_login(body.email)
    user.last_login = datetime.utcnow()
    org_id = str(user.organization_id) if user.organization_id else ""
    access_token = create_access_token(str(user.id), org_id, user.role)
    refresh_token = create_refresh_token(str(user.id))

    audit_log("login_success", str(user.id), "auth", None, ip)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    user_id = decode_refresh_token(body.refresh_token)
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    org_id = str(user.organization_id) if user.organization_id else ""
    access_token = create_access_token(str(user.id), org_id, user.role)
    new_refresh = create_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org_name = None
    if current_user.organization_id:
        result = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
        org = result.scalar_one_or_none()
        org_name = org.name if org else None

    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        organization_id=str(current_user.organization_id) if current_user.organization_id else None,
        org_name=org_name,
        legal_form=org.legal_form if org else None,
        tax_regime=org.tax_regime if org else None,
    )
