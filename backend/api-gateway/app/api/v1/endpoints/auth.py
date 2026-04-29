from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.user import User, Organization
from app.services.onec_contour_service import ensure_onec_contour_record
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, TokenResponse, UserResponse
from app.security import check_brute_force, record_failed_login, record_successful_login, audit_log

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"


def _attach_refresh_cookie(response: JSONResponse, refresh_token: str) -> JSONResponse:
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    sm = settings.REFRESH_COOKIE_SAMESITE
    # SameSite=None обязателен Secure (браузеры); кросс-сайт SPA → обычно none + HTTPS.
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


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201,
    summary="Register tenant owner",
    description="Creates organization + owner user and returns access/refresh tokens. Also sets httpOnly refresh cookie.",
)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    import structlog
    _log = structlog.get_logger()

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")

    existing_org = await db.execute(select(Organization).where(Organization.unp == body.org_unp))
    if existing_org.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Организация с УНП {body.org_unp} уже зарегистрирована")

    try:
        org = Organization(
            name=body.org_name,
            unp=body.org_unp,
            legal_form=body.legal_form,
            tax_regime=body.tax_regime,
        )
        db.add(org)
        await db.flush()

        try:
            await ensure_onec_contour_record(db, org)
        except Exception as contour_exc:
            _log.warning("onec_contour_skipped", error=str(contour_exc))

        user = User(
            email=body.email,
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
            role="owner",
            organization_id=org.id,
        )
        db.add(user)
        await db.flush()
        await db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        _log.error("register_failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка регистрации: {type(exc).__name__}: {exc}")

    access_token = create_access_token(str(user.id), str(org.id), user.role)
    refresh_token = create_refresh_token(str(user.id))

    payload = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    ).model_dump()
    resp = JSONResponse(content=payload, status_code=201)
    return _attach_refresh_cookie(resp, refresh_token)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login",
    description="Authenticates user, returns access/refresh tokens and sets httpOnly refresh cookie.",
)
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
    user.last_login = datetime.now(timezone.utc)
    org_id = str(user.organization_id) if user.organization_id else ""
    access_token = create_access_token(str(user.id), org_id, user.role)
    refresh_token = create_refresh_token(str(user.id))

    audit_log("login_success", str(user.id), "auth", None, ip)
    payload = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    ).model_dump()
    resp = JSONResponse(content=payload)
    return _attach_refresh_cookie(resp, refresh_token)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Accepts refresh token from httpOnly cookie and rotates refresh token.",
)
async def refresh_tokens(
    request: Request,
    body: RefreshRequest | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
):
    _ = body
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw:
        raise HTTPException(status_code=401, detail="Требуется refresh token в httpOnly cookie")
    user_id = decode_refresh_token(raw)
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    org_id = str(user.organization_id) if user.organization_id else ""
    access_token = create_access_token(str(user.id), org_id, user.role)
    new_refresh = create_refresh_token(str(user.id))

    payload = TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    ).model_dump()
    resp = JSONResponse(content=payload)
    return _attach_refresh_cookie(resp, new_refresh)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org_name = None
    org = None
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
