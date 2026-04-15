"""Спринт 7: реестр контуров 1С, мониторинг, массовое обновление подключений."""

import hmac

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.onec import _get_onec_connection, _validate_onec_endpoint
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.onec import OneCConnection, OneCContour
from app.models.user import Organization, User
from app.services.onec_contour_service import ensure_onec_contour_record, get_or_create_contour

router = APIRouter(prefix="/onec", tags=["1c-integration"])
log = structlog.get_logger(__name__)


def _mask_secret(value: str | None) -> str:
    if not value:
        return "<empty>"
    if len(value) <= 4:
        return "*" * len(value)
    return f"{value[:2]}***{len(value)}"


def _require_provision_admin(
    x_finklik_admin: str | None = Header(None, alias="X-Finklik-Admin-Token"),
):
    expected = settings.PROVISION_ADMIN_TOKEN
    if not expected:
        raise HTTPException(status_code=404, detail="Not found")
    if not hmac.compare_digest((x_finklik_admin or "").encode(), expected.encode()):
        raise HTTPException(status_code=404, detail="Not found")


@router.get("/contour/status")
async def get_contour_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Реестр organization_id → контур 1С + факт наличия HTTP-подключения."""
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Пользователь не привязан к организации")

    org_r = await db.execute(select(Organization).where(Organization.id == current_user.organization_id))
    org = org_r.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=400, detail="Организация не найдена")

    contour = await get_or_create_contour(db, org)
    conn = await _get_onec_connection(db, current_user.organization_id)
    return {
        "contour_key": contour.contour_key,
        "status": contour.status,
        "external_tenant_id": contour.external_tenant_id,
        "last_health_at": contour.last_health_at.isoformat() if contour.last_health_at else None,
        "last_health_ok": contour.last_health_ok,
        "last_error": contour.last_error,
        "connection_configured": conn is not None,
        "endpoint": conn.endpoint if conn else None,
    }


class BulkConnectionItem(BaseModel):
    organization_id: str = Field(min_length=8, max_length=36)
    endpoint: HttpUrl
    token: str = Field(min_length=8, max_length=4096)
    protocol: str = Field(default="custom-http", max_length=20)


class BulkConnectionPayload(BaseModel):
    items: list[BulkConnectionItem] = Field(default_factory=list, max_length=500)


@router.post("/admin/bulk-connections")
async def bulk_upsert_onec_connections(
    body: BulkConnectionPayload,
    _admin: None = Depends(_require_provision_admin),
    db: AsyncSession = Depends(get_db),
):
    """Массовое обновление endpoint/token для организаций (только с валидным PROVISION_ADMIN_TOKEN)."""
    updated = 0
    errors: list[dict] = []
    for item in body.items:
        org_r = await db.execute(select(Organization).where(Organization.id == item.organization_id))
        org = org_r.scalar_one_or_none()
        if not org:
            errors.append({"organization_id": item.organization_id, "detail": "org not found"})
            continue
        try:
            await _validate_onec_endpoint(item.endpoint)
        except HTTPException as e:
            errors.append({"organization_id": item.organization_id, "detail": e.detail})
            continue

        conn = await _get_onec_connection(db, item.organization_id)
        ep = str(item.endpoint)
        if conn:
            conn.endpoint = ep
            conn.token = item.token
            conn.protocol = item.protocol
        else:
            db.add(
                OneCConnection(
                    organization_id=item.organization_id,
                    endpoint=ep,
                    token=item.token,
                    protocol=item.protocol,
                )
            )
        await ensure_onec_contour_record(db, org)
        updated += 1
    await db.flush()
    return {"updated": updated, "errors": errors}


class ProvisionWebhookPayload(BaseModel):
    organization_id: str = Field(min_length=8, max_length=36)
    external_tenant_id: str | None = Field(default=None, max_length=128)
    status: str = Field(pattern="^(ready|error|provisioning|pending_provisioning|suspended)$")
    error: str | None = Field(default=None, max_length=2000)


@router.post("/webhooks/provision")
async def provision_webhook(
    body: ProvisionWebhookPayload,
    x_secret: str | None = Header(None, alias="X-Provision-Webhook-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """Колбэк внешнего оркестратора после создания ИБ / tenant (секрет в PROVISION_WEBHOOK_SECRET)."""
    expected = settings.PROVISION_WEBHOOK_SECRET
    if not expected:
        log.warning("onec_provision_webhook_rejected", reason="webhook_secret_not_configured")
        raise HTTPException(status_code=404, detail="Not found")
    if not hmac.compare_digest((x_secret or "").encode(), expected.encode()):
        log.warning(
            "onec_provision_webhook_rejected",
            reason="bad_secret",
            secret_preview=_mask_secret(x_secret),
            organization_id=body.organization_id,
        )
        raise HTTPException(status_code=404, detail="Not found")

    org_r = await db.execute(select(Organization).where(Organization.id == body.organization_id))
    org = org_r.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=400, detail="organization not found")

    contour = await ensure_onec_contour_record(db, org)
    if body.external_tenant_id is not None:
        contour.external_tenant_id = body.external_tenant_id
    contour.status = body.status
    contour.last_error = (body.error[:2000] if body.error else None)
    await db.flush()
    log.info(
        "onec_provision_webhook_processed",
        organization_id=body.organization_id,
        status=body.status,
        has_error=bool(body.error),
    )
    return {"ok": True, "contour_key": contour.contour_key}
