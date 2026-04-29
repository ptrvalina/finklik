from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.automation_policy import AutomationPolicy
from app.models.employee import AuditLog
from app.models.employee import CalendarEvent
from app.models.onec_sync import OneCSyncJob
from app.models.regulatory import ReportSubmission
from app.models.document import ScannedDocument
from app.models.employee import SalaryRecord
from app.models.transaction import Transaction
from app.services.pipeline_status import get_transaction_validation_issues
from app.models.user import User
from app.schemas.automation_policy import AutomationPolicyResponse, AutomationPolicyUpdate

router = APIRouter(
    prefix="/automation",
    tags=["automation-issues"],
    dependencies=[Depends(require_roles("admin", "accountant"))],
)


async def _get_or_create_policy(db: AsyncSession, organization_id: str) -> AutomationPolicy:
    result = await db.execute(
        select(AutomationPolicy).where(AutomationPolicy.organization_id == organization_id)
    )
    policy = result.scalar_one_or_none()
    if policy:
        return policy
    policy = AutomationPolicy(
        organization_id=organization_id,
        mode="assist",
        allow_auto_reporting=False,
        allow_auto_workforce=False,
        max_auto_submissions_per_run=20,
    )
    db.add(policy)
    await db.flush()
    return policy


@router.get("/issues")
async def automation_issues(
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    issues: list[dict] = []

    sync_result = await db.execute(
        select(OneCSyncJob)
        .where(
            OneCSyncJob.organization_id == current_user.organization_id,
            OneCSyncJob.status == "failed",
        )
        .order_by(desc(OneCSyncJob.updated_at))
        .limit(limit)
    )
    for job in sync_result.scalars().all():
        issues.append(
            {
                "id": f"sync:{job.id}",
                "source": "reporting",
                "kind": "sync_failed",
                "severity": "high",
                "status": "open",
                "title": "Ошибка синхронизации операции",
                "details": job.last_error or "Неизвестная ошибка синхронизации",
                "created_at": job.updated_at.isoformat() if job.updated_at else None,
                "ref_id": job.id,
            }
        )

    report_result = await db.execute(
        select(ReportSubmission)
        .where(
            ReportSubmission.organization_id == current_user.organization_id,
            ReportSubmission.status == "rejected",
        )
        .order_by(desc(ReportSubmission.updated_at))
        .limit(limit)
    )
    for rep in report_result.scalars().all():
        issues.append(
            {
                "id": f"submission:{rep.id}",
                "source": "reporting",
                "kind": "submission_rejected",
                "severity": "medium",
                "status": "open",
                "title": "Портал отклонил отчёт",
                "details": rep.rejection_reason or "Отчёт отклонён внешним контуром",
                "created_at": rep.updated_at.isoformat() if rep.updated_at else None,
                "ref_id": rep.id,
            }
        )

    issues.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {
        "items": issues[:limit],
        "total": len(issues),
        "summary": {
            "high": sum(1 for i in issues if i["severity"] == "high"),
            "medium": sum(1 for i in issues if i["severity"] == "medium"),
            "low": sum(1 for i in issues if i["severity"] == "low"),
        },
    }


@router.get("/policy", response_model=AutomationPolicyResponse)
async def get_policy(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    policy = await _get_or_create_policy(db, str(current_user.organization_id))
    return policy


@router.put("/policy", response_model=AutomationPolicyResponse)
async def update_policy(
    body: AutomationPolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    policy = await _get_or_create_policy(db, str(current_user.organization_id))
    policy.mode = body.mode
    policy.allow_auto_reporting = body.allow_auto_reporting
    policy.allow_auto_workforce = body.allow_auto_workforce
    policy.max_auto_submissions_per_run = body.max_auto_submissions_per_run
    await db.flush()
    return policy


@router.get("/scenarios")
async def scenarios(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    policy = await _get_or_create_policy(db, str(current_user.organization_id))
    return {
        "mode": policy.mode,
        "items": [
            {
                "id": "reporting.auto-submit-confirmed",
                "title": "Автоподача подтверждённых отчётов",
                "enabled": policy.allow_auto_reporting,
                "schedule": "manual/cron-ready",
            },
            {
                "id": "workforce.followups",
                "title": "Автозадачи по кадровым событиям",
                "enabled": policy.allow_auto_workforce,
                "schedule": "event-driven",
            },
            {
                "id": "pipeline.data-guardrails",
                "title": "Guardrails данных перед автодействиями",
                "enabled": True,
                "schedule": "always-on",
            },
        ],
    }


@router.get("/health")
async def automation_health(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    all_sync = await db.execute(
        select(OneCSyncJob).where(OneCSyncJob.organization_id == current_user.organization_id)
    )
    sync_jobs = all_sync.scalars().all()
    total_sync = len(sync_jobs)
    failed_sync = sum(1 for j in sync_jobs if j.status == "failed")
    success_sync = sum(1 for j in sync_jobs if j.status == "success")
    success_rate = (success_sync / total_sync * 100.0) if total_sync > 0 else 100.0

    rejected_reports = await db.execute(
        select(ReportSubmission).where(
            ReportSubmission.organization_id == current_user.organization_id,
            ReportSubmission.status == "rejected",
        )
    )
    rejected_count = len(rejected_reports.scalars().all())
    status = "healthy" if success_rate >= 98 and rejected_count == 0 else "degraded"
    return {
        "status": status,
        "sync_success_rate": round(success_rate, 2),
        "sync_failed": failed_sync,
        "reports_rejected": rejected_count,
        "sla_target_success_rate": 98.0,
    }


@router.get("/audit")
async def automation_audit(
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == str(current_user.organization_id))
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
    )
    rows = result.scalars().all()
    return {
        "items": [
            {
                "id": r.id,
                "action": r.action,
                "resource": r.resource,
                "resource_id": r.resource_id,
                "success": r.success,
                "details": r.details,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": len(rows),
    }


@router.get("/kpi")
async def automation_kpi(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = str(current_user.organization_id)

    total_tx_q = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.organization_id == org_id)
    )
    total_tx = int(total_tx_q.scalar() or 0)
    reported_tx_q = await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.organization_id == org_id,
            Transaction.status == "synced",
        )
    )
    reported_tx = int(reported_tx_q.scalar() or 0)
    operations_auto_rate = (reported_tx / total_tx * 100.0) if total_tx > 0 else 0.0

    total_docs_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(ScannedDocument.organization_id == org_id)
    )
    total_docs = int(total_docs_q.scalar() or 0)
    low_conf_docs_q = await db.execute(
        select(func.count(ScannedDocument.id)).where(
            ScannedDocument.organization_id == org_id,
            ScannedDocument.status == "needs_review",
        )
    )
    low_conf_docs = int(low_conf_docs_q.scalar() or 0)
    ocr_auto_rate = ((total_docs - low_conf_docs) / total_docs * 100.0) if total_docs > 0 else 0.0

    total_sub_q = await db.execute(
        select(func.count(ReportSubmission.id)).where(ReportSubmission.organization_id == org_id)
    )
    total_sub = int(total_sub_q.scalar() or 0)
    ready_sub_q = await db.execute(
        select(func.count(ReportSubmission.id)).where(
            ReportSubmission.organization_id == org_id,
            ReportSubmission.status.in_(["confirmed", "accepted"]),
        )
    )
    ready_sub = int(ready_sub_q.scalar() or 0)
    reporting_ready_rate = (ready_sub / total_sub * 100.0) if total_sub > 0 else 0.0

    total_salary_q = await db.execute(
        select(func.count(SalaryRecord.id)).where(SalaryRecord.organization_id == org_id)
    )
    total_salary = int(total_salary_q.scalar() or 0)
    draft_salary_q = await db.execute(
        select(func.count(SalaryRecord.id)).where(
            SalaryRecord.organization_id == org_id,
            SalaryRecord.status == "draft",
        )
    )
    draft_salary = int(draft_salary_q.scalar() or 0)
    payroll_auto_rate = ((total_salary - draft_salary) / total_salary * 100.0) if total_salary > 0 else 0.0
    baseline_hours = 72.0
    cycle_hours = baseline_hours
    sub_rows = await db.execute(
        select(ReportSubmission)
        .where(
            ReportSubmission.organization_id == org_id,
            ReportSubmission.status.in_(["accepted", "submitted", "confirmed"]),
        )
        .order_by(desc(ReportSubmission.updated_at))
        .limit(200)
    )
    samples: list[float] = []
    for s in sub_rows.scalars().all():
        end_dt = s.submitted_at or s.confirmed_at or s.updated_at or s.created_at
        start_dt = s.created_at
        if not start_dt or not end_dt:
            continue
        delta_hours = (end_dt - start_dt).total_seconds() / 3600.0
        if delta_hours >= 0:
            samples.append(delta_hours)
    if samples:
        cycle_hours = sum(samples) / len(samples)
    cycle_reduction_progress_x = (baseline_hours / cycle_hours) if cycle_hours > 0 else 0.0

    categorized_tx_q = await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.organization_id == org_id,
            Transaction.category.is_not(None),
        )
    )
    categorized_tx = int(categorized_tx_q.scalar() or 0)
    auto_categorized_share = (categorized_tx / total_tx * 100.0) if total_tx > 0 else 0.0

    obligations_total_q = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            CalendarEvent.organization_id == org_id,
            CalendarEvent.event_type == "tax",
        )
    )
    obligations_total = int(obligations_total_q.scalar() or 0)
    obligations_auto_q = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            CalendarEvent.organization_id == org_id,
            CalendarEvent.event_type == "tax",
            CalendarEvent.is_auto.is_(True),
        )
    )
    obligations_auto = int(obligations_auto_q.scalar() or 0)
    obligations_auto_created_rate = (obligations_auto / obligations_total * 100.0) if obligations_total > 0 else 100.0

    accepted_reports_q = await db.execute(
        select(func.count(ReportSubmission.id)).where(
            ReportSubmission.organization_id == org_id,
            ReportSubmission.status == "accepted",
        )
    )
    accepted_reports = int(accepted_reports_q.scalar() or 0)
    report_readiness_without_manual_edits_rate = (accepted_reports / total_sub * 100.0) if total_sub > 0 else 0.0

    running_scenarios_q = await db.execute(
        select(AutomationPolicy).where(AutomationPolicy.organization_id == org_id)
    )
    policy = running_scenarios_q.scalar_one_or_none()
    scheduled_scenarios_count = 1 + int(bool(policy and policy.allow_auto_reporting)) + int(bool(policy and policy.allow_auto_workforce))

    total_jobs_q = await db.execute(
        select(func.count(OneCSyncJob.id)).where(OneCSyncJob.organization_id == org_id)
    )
    total_jobs = int(total_jobs_q.scalar() or 0)
    success_jobs_q = await db.execute(
        select(func.count(OneCSyncJob.id)).where(
            OneCSyncJob.organization_id == org_id,
            OneCSyncJob.status == "success",
        )
    )
    success_jobs = int(success_jobs_q.scalar() or 0)
    auto_job_success_rate = (success_jobs / total_jobs * 100.0) if total_jobs > 0 else 100.0

    repeated_failures_q = await db.execute(
        select(func.count()).select_from(
            select(OneCSyncJob.transaction_id)
            .where(
                OneCSyncJob.organization_id == org_id,
                OneCSyncJob.status == "failed",
            )
            .group_by(OneCSyncJob.transaction_id)
            .having(func.count(OneCSyncJob.id) > 1)
            .subquery()
        )
    )
    repeated_failures = int(repeated_failures_q.scalar() or 0)
    recurring_incidents_rate = (repeated_failures / total_jobs * 100.0) if total_jobs > 0 else 0.0

    return {
        "operations_auto_rate": round(operations_auto_rate, 2),
        "pipeline_pass_rate": round(operations_auto_rate, 2),
        "auto_categorized_share": round(auto_categorized_share, 2),
        "ocr_auto_rate": round(ocr_auto_rate, 2),
        "reporting_ready_rate": round(reporting_ready_rate, 2),
        "report_readiness_without_manual_edits_rate": round(report_readiness_without_manual_edits_rate, 2),
        "payroll_auto_rate": round(payroll_auto_rate, 2),
        "obligations_auto_created_rate": round(obligations_auto_created_rate, 2),
        "scheduled_scenarios_count": scheduled_scenarios_count,
        "auto_job_success_rate": round(auto_job_success_rate, 2),
        "recurring_incidents_rate": round(recurring_incidents_rate, 2),
        "cycle_hours_operation_to_report_ready": round(cycle_hours, 2),
        "cycle_reduction_progress_x": round(cycle_reduction_progress_x, 2),
        "targets": {
            "pipeline_pass_rate": 95.0,
            "operations_auto_rate": 85.0,
            "auto_categorized_share": 60.0,
            "ocr_auto_rate": 70.0,
            "reporting_ready_rate": 80.0,
            "report_readiness_without_manual_edits_rate": 80.0,
            "payroll_auto_rate": 90.0,
            "obligations_auto_created_rate": 100.0,
            "scheduled_scenarios_count": 3,
            "auto_job_success_rate": 98.0,
            "recurring_incidents_rate_max": 2.0,
            "cycle_reduction_target_x": 3.0,
        },
    }


@router.get("/data-quality")
async def automation_data_quality(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = str(current_user.organization_id)
    normalized_description = func.lower(func.trim(func.coalesce(Transaction.description, "")))
    duplicate_groups_q = await db.execute(
        select(
            Transaction.transaction_date.label("tx_date"),
            Transaction.type.label("tx_type"),
            Transaction.amount.label("tx_amount"),
            Transaction.counterparty_id.label("counterparty_id"),
            normalized_description.label("description"),
            func.count(Transaction.id).label("duplicates_count"),
        )
        .where(Transaction.organization_id == org_id)
        .group_by(
            Transaction.transaction_date,
            Transaction.type,
            Transaction.amount,
            Transaction.counterparty_id,
            normalized_description,
        )
        .having(func.count(Transaction.id) > 1)
        .order_by(desc("duplicates_count"))
        .limit(20)
    )
    duplicate_groups = duplicate_groups_q.all()
    duplicate_operations = int(sum(int(row.duplicates_count) for row in duplicate_groups))

    tx_rows = await db.execute(
        select(Transaction).where(Transaction.organization_id == org_id).order_by(desc(Transaction.created_at)).limit(5000)
    )
    inconsistencies = 0
    for tx in tx_rows.scalars().all():
        if get_transaction_validation_issues(tx):
            inconsistencies += 1

    total_tx_q = await db.execute(
        select(func.count(Transaction.id)).where(Transaction.organization_id == org_id)
    )
    total_transactions = int(total_tx_q.scalar() or 0)

    return {
        "status": "ok" if duplicate_operations == 0 and inconsistencies == 0 else "needs_attention",
        "total_transactions": total_transactions,
        "duplicate_operations": duplicate_operations,
        "inconsistent_operations": inconsistencies,
        "top_duplicate_groups": [
            {
                "transaction_date": row.tx_date.isoformat() if row.tx_date else None,
                "type": row.tx_type,
                "amount": float(row.tx_amount or 0),
                "counterparty_id": row.counterparty_id,
                "description": row.description,
                "duplicates_count": int(row.duplicates_count),
            }
            for row in duplicate_groups
        ],
    }
