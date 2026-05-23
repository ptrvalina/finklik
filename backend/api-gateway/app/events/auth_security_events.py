"""Доменные события по безопасности сессий (без запуска workflow)."""

from __future__ import annotations

from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.bootstrap import get_event_store
from app.events.constants import (
    EV_FAILED_LOGIN_ATTEMPT,
    EV_PASSWORD_CHANGED,
    EV_REFRESH_TOKEN_REUSE_DETECTED,
    EV_REFRESH_TOKEN_ROTATED,
    EV_SESSION_REVOKED,
    EV_USER_LOGGED_IN,
    EV_USER_LOGGED_OUT,
)
from app.models.user import User, UserOrganizationMembership

log = structlog.get_logger(__name__)


async def _resolve_org_id_for_user(db: AsyncSession, user: User) -> str | None:
    if user.organization_id:
        return str(user.organization_id)
    r = await db.execute(
        select(UserOrganizationMembership.organization_id)
        .where(UserOrganizationMembership.user_id == user.id)
        .limit(1)
    )
    oid = r.scalar_one_or_none()
    return str(oid) if oid else None


async def append_security_domain_event(
    db: AsyncSession,
    *,
    user: User,
    event_type: str,
    payload: dict[str, Any],
    idempotency_key: str | None = None,
) -> None:
    org_id = await _resolve_org_id_for_user(db, user)
    if not org_id:
        log.info("security_domain_event_skipped_no_org", event_type=event_type, user_id=str(user.id))
        return
    store = get_event_store()
    await store.append(
        db,
        organization_id=org_id,
        event_type=event_type,
        actor="security",
        target_id=str(user.id),
        target_kind="user",
        payload=payload,
        skip_workflow=True,
        idempotency_key=idempotency_key,
    )


async def emit_user_logged_in(db: AsyncSession, user: User, *, ip: str) -> None:
    await append_security_domain_event(
        db,
        user=user,
        event_type=EV_USER_LOGGED_IN,
        payload={"ip": ip},
        idempotency_key=None,
    )


async def emit_user_logged_out(db: AsyncSession, user: User, *, ip: str) -> None:
    await append_security_domain_event(
        db,
        user=user,
        event_type=EV_USER_LOGGED_OUT,
        payload={"ip": ip},
        idempotency_key=None,
    )


async def emit_session_revoked(db: AsyncSession, user: User, *, reason: str, ip: str) -> None:
    await append_security_domain_event(
        db,
        user=user,
        event_type=EV_SESSION_REVOKED,
        payload={"reason": reason, "ip": ip},
        idempotency_key=f"session_revoked:{user.id}:{reason}:{ip}"[:128],
    )


async def emit_refresh_rotated(db: AsyncSession, user: User, *, new_jti: str) -> None:
    await append_security_domain_event(
        db,
        user=user,
        event_type=EV_REFRESH_TOKEN_ROTATED,
        payload={"rotated": True},
        idempotency_key=f"refresh_rot:{user.id}:{new_jti}"[:128],
    )


async def emit_refresh_reuse_detected(db: AsyncSession, user: User, *, ip: str) -> None:
    await append_security_domain_event(
        db,
        user=user,
        event_type=EV_REFRESH_TOKEN_REUSE_DETECTED,
        payload={"ip": ip},
        idempotency_key=None,
    )


async def emit_failed_login_attempt(db: AsyncSession, user: User, *, ip: str) -> None:
    await append_security_domain_event(
        db,
        user=user,
        event_type=EV_FAILED_LOGIN_ATTEMPT,
        payload={"ip": ip},
        idempotency_key=None,
    )


async def emit_password_changed(db: AsyncSession, user: User, *, ip: str) -> None:
    await append_security_domain_event(
        db,
        user=user,
        event_type=EV_PASSWORD_CHANGED,
        payload={"ip": ip},
        idempotency_key=f"pwd_changed:{user.id}"[:128],
    )
