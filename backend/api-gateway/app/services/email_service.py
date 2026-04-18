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


async def send_payment_link_email(
    to_email: str,
    *,
    org_name: str,
    doc_number: str,
    amount: float,
    currency: str,
    payment_url: str,
) -> bool:
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
                    "subject": f"Ссылка на оплату счёта {doc_number} — ФинКлик",
                    "html": (
                        f"<h2>Счёт {doc_number} к оплате</h2>"
                        f"<p>Сумма: <b>{amount:.2f} {currency}</b></p>"
                        f"<p>Оплатить можно по ссылке:</p>"
                        f'<p><a href="{payment_url}">{payment_url}</a></p>'
                        f"<p>Организация: {org_name}</p>"
                        f"<p>— Команда ФинКлик</p>"
                    ),
                },
            )
            if resp.status_code < 300:
                log.info("email.sent", to=to_email, status=resp.status_code, kind="payment_link")
                return True
            log.error(
                "email.failed",
                to=to_email,
                status=resp.status_code,
                body=resp.text[:200],
                kind="payment_link",
            )
            return False
    except Exception as exc:
        log.error("email.exception", to=to_email, error=str(exc), kind="payment_link")
        return False


async def send_submission_portal_email(
    to_email: str,
    *,
    org_name: str,
    authority_label: str,
    report_period: str,
    accepted: bool,
    submission_ref: str | None,
    rejection_reason: str | None,
    summary_message: str,
) -> bool:
    """Уведомление о принятии/отклонении отчёта порталом (тот же канал, что счета/приглашения)."""
    if not settings.EMAIL_API_KEY:
        log.warning("email.skipped", to=to_email, reason="EMAIL_API_KEY not set", kind="submission_portal")
        return False

    status_ru = "принят" if accepted else "отклонён"
    ref_line = f"<p>Референс: <b>{submission_ref}</b></p>" if submission_ref else ""
    reason_line = (
        f"<p>Причина: {rejection_reason}</p>" if (not accepted and rejection_reason) else ""
    )

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
                    "subject": f"Отчёт {status_ru} ({authority_label}, {report_period}) — ФинКлик",
                    "html": (
                        f"<h2>Отчёт {status_ru}</h2>"
                        f"<p>Организация: {org_name}</p>"
                        f"<p>Орган: {authority_label}, период: {report_period}</p>"
                        f"{ref_line}"
                        f"{reason_line}"
                        f"<p>{summary_message}</p>"
                        f"<p>— Команда ФинКлик</p>"
                    ),
                },
            )
            if resp.status_code < 300:
                log.info("email.sent", to=to_email, status=resp.status_code, kind="submission_portal")
                return True
            log.error(
                "email.failed",
                to=to_email,
                status=resp.status_code,
                body=resp.text[:200],
                kind="submission_portal",
            )
            return False
    except Exception as exc:
        log.error("email.exception", to=to_email, error=str(exc), kind="submission_portal")
        return False
