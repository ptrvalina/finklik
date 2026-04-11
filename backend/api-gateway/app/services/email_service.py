"""
Email service for FinKlik.

Uses httpx to call an external transactional email provider (Resend, Mailgun, etc.).
Falls back to logging when no API key is configured.
"""
import structlog
from app.core.config import settings

log = structlog.get_logger()


async def send_invite_email(to_email: str, org_name: str, invite_code: str, invite_url: str) -> bool:
    if not settings.EMAIL_API_KEY:
        log.warning("email.skipped", to=to_email, reason="EMAIL_API_KEY not set")
        return False

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                settings.EMAIL_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.EMAIL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.EMAIL_FROM,
                    "to": [to_email],
                    "subject": f"Приглашение в {org_name} — ФинКлик",
                    "html": (
                        f"<h2>Вас пригласили в организацию «{org_name}»</h2>"
                        f"<p>Перейдите по ссылке для принятия приглашения:</p>"
                        f'<p><a href="{invite_url}">{invite_url}</a></p>'
                        f"<p>Или введите код вручную: <b>{invite_code}</b></p>"
                        f"<p>— Команда ФинКлик</p>"
                    ),
                },
            )
            if resp.status_code < 300:
                log.info("email.sent", to=to_email, status=resp.status_code)
                return True
            log.error("email.failed", to=to_email, status=resp.status_code, body=resp.text[:200])
            return False
    except Exception as exc:
        log.error("email.exception", to=to_email, error=str(exc))
        return False
