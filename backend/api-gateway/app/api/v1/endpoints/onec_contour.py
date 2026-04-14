"""Спринт 7: реестр контуров 1С, мониторинг, массовое обновление подключений."""

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


def _require_provision_admin(
    x_finklik_admin: str | None = Header(None, alias="X-Finklik-Admin-Token"),
):
    if not settings.PROVISION_ADMIN_TOKEN or x_finklik_admin != settings.PROVISION_ADMIN_TOKEN:
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
