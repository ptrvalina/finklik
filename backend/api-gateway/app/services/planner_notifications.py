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


async def send_planner_telegram(message: str, *, chat_id: str | None = None) -> bool:
    """Отправка в Telegram. Явный chat_id (личный пользователя) имеет приоритет над TELEGRAM_DEFAULT_CHAT_ID."""
    explicit = (chat_id or "").strip() or None
    fallback = (settings.TELEGRAM_DEFAULT_CHAT_ID or "").strip() or None
    target = explicit or fallback
    if not settings.TELEGRAM_BOT_TOKEN or not target:
        log.warning(
            "planner.telegram_skipped",
            reason="telegram settings missing or no chat_id",
            has_explicit=bool(explicit),
            has_fallback=bool(fallback),
        )
        return False
    try:
        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": target, "text": message},
            )
            return resp.status_code < 300
    except Exception as exc:
        log.error("planner.telegram_failed", error=str(exc))
        return False
