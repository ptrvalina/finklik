"""Уведомления о результате подачи отчёта (WebSocket + email)."""
import structlog

from app.services.email_service import send_submission_portal_email
from app.websocket.manager import manager

log = structlog.get_logger()


async def notify_submission_portal_result(
    *,
    org_id: str,
    user_email: str,
    org_name: str,
    authority_label: str,
    report_period: str,
    submission_id: str,
    status: str,
    submission_ref: str | None,
    rejection_reason: str | None,
    portal_outcome: str,
    summary_message: str,
) -> None:
    try:
        await manager.send_to_org(
            org_id,
            "report_status",
            {
                "submission_id": submission_id,
                "status": status,
                "portal_outcome": portal_outcome,
                "submission_ref": submission_ref,
                "authority_label": authority_label,
                "report_period": report_period,
                "message": summary_message,
                "rejection_reason": rejection_reason,
            },
        )
    except Exception:
        log.exception("submission_notify.ws_failed", submission_id=submission_id)

    try:
        await send_submission_portal_email(
            user_email,
            org_name=org_name,
            authority_label=authority_label,
            report_period=report_period,
            accepted=(portal_outcome == "accepted"),
            submission_ref=submission_ref,
            rejection_reason=rejection_reason,
            summary_message=summary_message,
        )
    except Exception:
        log.exception("submission_notify.email_failed", submission_id=submission_id)
