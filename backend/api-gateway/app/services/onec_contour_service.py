"""Реестр контуров 1С: провижининг-запись и снимки health (спринт 7)."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.onec import OneCContour
from app.models.user import Organization


def _contour_key_for_org(org: Organization) -> str:
    return f"C-{org.unp}"


async def ensure_onec_contour_record(db: AsyncSession, org: Organization) -> OneCContour:
    """Создаёт запись реестра при регистрации организации (ИБ/tenant — внешняя оркестрация)."""
    r = await db.execute(select(OneCContour).where(OneCContour.organization_id == org.id))
    row = r.scalar_one_or_none()
    if row:
        return row
    row = OneCContour(
        organization_id=org.id,
        contour_key=_contour_key_for_org(org),
        status="pending_provisioning",
    )
    db.add(row)
    await db.flush()
    return row


async def get_or_create_contour(db: AsyncSession, org: Organization) -> OneCContour:
    return await ensure_onec_contour_record(db, org)


async def update_contour_health_snapshot(
    db: AsyncSession,
    organization_id: str | None,
    *,
    ok: bool,
    error: str | None = None,
) -> None:
    if not organization_id:
        return
    r = await db.execute(select(OneCContour).where(OneCContour.organization_id == organization_id))
    row = r.scalar_one_or_none()
    if not row:
        return
    row.last_health_at = datetime.now(timezone.utc)
    row.last_health_ok = ok
    row.last_error = (error[:2000] if error else None)
    if ok and row.status in ("pending_provisioning", "provisioning", "error"):
        row.status = "ready"
    await db.flush()


async def set_contour_external_ref(db: AsyncSession, organization_id: str, tenant_id: str | None) -> None:
    r = await db.execute(select(OneCContour).where(OneCContour.organization_id == organization_id))
    row = r.scalar_one_or_none()
    if not row:
        return
    row.external_tenant_id = tenant_id
    if tenant_id:
        row.status = "provisioning"
    await db.flush()
