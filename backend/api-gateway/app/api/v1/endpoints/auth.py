from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone

from app.core.datetime_utils import utc_now_naive

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token_pair,
    decode_refresh_token,
)
from app.core.deps import get_current_user, resolve_workspace_organization_id, workspace_organization_id
from app.core.config import settings
from app.models.user import User, Organization, UserOrganizationMembership
from app.services.onec_contour_service import ensure_onec_contour_record
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
    UserNotificationsPatch,
    ChangePasswordRequest,
)
from app.security import check_brute_force, record_failed_login, record_successful_login, audit_log
from app.security.metrics import (
    AUTH_FAILED_LOGIN_TOTAL,
    AUTH_REFRESH_REUSE_TOTAL,
    SESSION_REVOKED_TOTAL,
)
from app.events.auth_security_events import (
    emit_failed_login_attempt,
    emit_password_changed,
    emit_refresh_reuse_detected,
    emit_refresh_rotated,
    emit_session_revoked,
    emit_user_logged_in,
    emit_user_logged_out,
)
import structlog

_log = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"


def _clear_refresh_cookie(response: JSONResponse) -> JSONResponse:
    sm = settings.REFRESH_COOKIE_SAMESITE
    secure = sm == "none" or not settings.DEBUG
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path="/",
        secure=secure,
        httponly=True,
        samesite=sm,
    )
    return response


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
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
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
        db.add(
            UserOrganizationMembership(
                user_id=user.id,
                organization_id=org.id,
                role_in_org=user.role,
                is_pinned=False,
            )
        )
        await db.flush()
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        _log.error("register_failed", error=str(exc), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка регистрации: {type(exc).__name__}: {exc}")

    refresh_token, jti = create_refresh_token_pair(str(user.id))
    user.refresh_token_jti = jti
    await db.flush()
    access_token = create_access_token(str(user.id), str(org.id), user.role)

    payload = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    ).model_dump()
    resp = JSONResponse(content=payload, status_code=201)
    ip = request.client.host if request.client else "unknown"
    await emit_user_logged_in(db, user, ip=ip)
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

    if not user:
        record_failed_login(body.email)
        audit_log("login_failed", None, "auth", None, ip, {"email": body.email}, success=False)
        AUTH_FAILED_LOGIN_TOTAL.labels(reason="unknown_user").inc()
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not verify_password(body.password, user.hashed_password):
        record_failed_login(body.email)
        audit_log("login_failed", str(user.id), "auth", None, ip, {"email": body.email}, success=False)
        AUTH_FAILED_LOGIN_TOTAL.labels(reason="bad_password").inc()
        await emit_failed_login_attempt(db, user, ip=ip)
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт деактивирован")

    record_successful_login(body.email)
    user.last_login = utc_now_naive()
    org_id = str(user.organization_id) if user.organization_id else ""
    access_token = create_access_token(str(user.id), org_id, user.role)
    refresh_token, jti = create_refresh_token_pair(str(user.id))
    user.refresh_token_jti = jti
    await db.flush()

    audit_log("login_success", str(user.id), "auth", None, ip)
    await emit_user_logged_in(db, user, ip=ip)
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
    ip = request.client.host if request.client else "unknown"
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw:
        raise HTTPException(status_code=401, detail="Требуется refresh token в httpOnly cookie")
    claims = decode_refresh_token(raw)
    user_id = claims["sub"]
    token_jti = claims.get("jti")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    body_org = None
    if body and body.organization_id and str(body.organization_id).strip():
        body_org = str(body.organization_id).strip()
    org_id_str = await resolve_workspace_organization_id(db, user, body_org)
    access_token = create_access_token(str(user.id), org_id_str, user.role)
    new_refresh, new_jti = create_refresh_token_pair(str(user.id))

    if token_jti is not None:
        lock_cond = User.refresh_token_jti == token_jti
    else:
        lock_cond = User.refresh_token_jti.is_(None)

    res = await db.execute(
        update(User)
        .where(User.id == user.id, User.is_active == True, lock_cond)
        .values(refresh_token_jti=new_jti)
    )
    if res.rowcount != 1:
        AUTH_REFRESH_REUSE_TOTAL.inc()
        audit_log(
            "refresh_token_mismatch",
            str(user.id),
            "auth",
            None,
            ip,
            {"reason": "reuse_or_stale_refresh"},
            success=False,
        )
        await emit_refresh_reuse_detected(db, user, ip=ip)
        _log.warning("security_refresh_token_mismatch", user_id=str(user.id))
        raise HTTPException(
            status_code=401,
            detail="Обнаружено повторное использование сессии. Войдите снова.",
        )

    await emit_refresh_rotated(db, user, new_jti=new_jti)

    payload = TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    ).model_dump()
    resp = JSONResponse(content=payload)
    return _attach_refresh_cookie(resp, new_refresh)


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    """Завершить сессию на устройстве: сброс refresh jti и очистка httpOnly cookie."""
    ip = request.client.host if request.client else "unknown"
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    resp = JSONResponse(
        content={
            "ok": True,
            "user_message": "Вы вышли из аккаунта на этом устройстве. Данные в журнале и отчётах не затронуты.",
        }
    )
    if raw:
        try:
            claims = decode_refresh_token(raw)
            uid = claims["sub"]
            r = await db.execute(select(User).where(User.id == uid))
            u = r.scalar_one_or_none()
            if u:
                u.refresh_token_jti = None
                await db.flush()
                SESSION_REVOKED_TOTAL.labels(reason="logout").inc()
                await emit_user_logged_out(db, u, ip=ip)
                await emit_session_revoked(db, u, reason="logout", ip=ip)
        except HTTPException:
            pass
    return _clear_refresh_cookie(resp)


@router.patch("/me/password")
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Текущий пароль указан неверно")
    current_user.hashed_password = hash_password(body.new_password)
    current_user.refresh_token_jti = None
    await db.flush()
    SESSION_REVOKED_TOTAL.labels(reason="password_change").inc()
    await emit_password_changed(db, current_user, ip=ip)
    await emit_session_revoked(db, current_user, reason="password_change", ip=ip)
    resp = JSONResponse(
        content={
            "ok": True,
            "user_message": "Пароль обновлён. На других устройствах потребуется войти снова.",
        }
    )
    return _clear_refresh_cookie(resp)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org_name = None
    org = None
    if workspace_organization_id(current_user):
        result = await db.execute(select(Organization).where(Organization.id == workspace_organization_id(current_user)))
        org = result.scalar_one_or_none()
        org_name = org.name if org else None

    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        organization_id=workspace_organization_id(current_user) if workspace_organization_id(current_user) else None,
        org_name=org_name,
        legal_form=org.legal_form if org else None,
        tax_regime=org.tax_regime if org else None,
        telegram_chat_id=current_user.telegram_chat_id,
    )


@router.patch("/me/notifications", response_model=UserResponse)
async def patch_me_notifications(
    body: UserNotificationsPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Сохранить личный Telegram chat_id для напоминаний и уведомлений."""
    patch = body.model_dump(exclude_unset=True)
    if "telegram_chat_id" in patch:
        current_user.telegram_chat_id = patch["telegram_chat_id"]
    await db.flush()
    org_name = None
    org = None
    if workspace_organization_id(current_user):
        result = await db.execute(select(Organization).where(Organization.id == workspace_organization_id(current_user)))
        org = result.scalar_one_or_none()
        org_name = org.name if org else None
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        organization_id=workspace_organization_id(current_user) if workspace_organization_id(current_user) else None,
        org_name=org_name,
        legal_form=org.legal_form if org else None,
        tax_regime=org.tax_regime if org else None,
        telegram_chat_id=current_user.telegram_chat_id,
    )
