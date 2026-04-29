import structlog

from app.core.config import settings
from app.services.email_service import send_submission_portal_email

log = structlog.get_logger()


async def send_planner_email(to_email: str, subject: str, message: str) -> bool:
    # Reuse existing provider wiring to avoid duplicating transport settings.
    return await send_submission_portal_email(
        to_email=to_email,
        org_name="ФинКлик",
        authority_label="Планер",
        report_period="-",
        accepted=True,
        submission_ref=None,
        rejection_reason=None,
        summary_message=f"{subject}. {message}",
    )


async def send_planner_telegram(message: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_DEFAULT_CHAT_ID:
        log.warning("planner.telegram_skipped", reason="telegram settings missing")
        return False
    try:
        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": settings.TELEGRAM_DEFAULT_CHAT_ID, "text": message},
            )
            return resp.status_code < 300
    except Exception as exc:
        log.error("planner.telegram_failed", error=str(exc))
        return False
