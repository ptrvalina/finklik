from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.notification import Notification
from app.models.planner import PlannerComment, PlannerReport, PlannerTask
from app.models.user import User
from app.schemas.planner import (
    PlannerReportCreate,
    PlannerReportResponse,
    PlannerCommentCreate,
    PlannerCommentResponse,
    PlannerTaskCreate,
    PlannerTaskResponse,
)
from app.services.planner_notifications import send_planner_email, send_planner_telegram
from app.internal.audit.service import safe_log_audit

router = APIRouter(prefix="/planner", tags=["planner"])


def _task_payload(task: PlannerTask) -> PlannerTaskResponse:
    return PlannerTaskResponse(
        id=task.id,
        tenant_id=task.tenant_id,
        author_id=task.author_id,
        assignee_id=task.assignee_id,
        title=task.title,
        description=task.description,
        attachments=list(task.attachments or []),
        status=task.status,
        created_at=task.created_at,
        closed_at=task.closed_at,
    )


@router.post("/tasks", response_model=PlannerTaskResponse, status_code=201)
async def create_task(
    body: PlannerTaskCreate,
    current_user: User = Depends(require_roles("admin", "accountant", "manager")),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Пользователь не привязан к организации")

    assignee = await db.execute(
        select(User).where(
            User.id == body.assignee_id,
            User.organization_id == current_user.organization_id,
            User.is_active.is_(True),
        )
    )
    assignee_user = assignee.scalar_one_or_none()
    if not assignee_user:
        raise HTTPException(status_code=404, detail="Назначенный пользователь не найден")

    task = PlannerTask(
        tenant_id=str(current_user.organization_id),
        author_id=str(current_user.id),
        assignee_id=body.assignee_id,
        title=body.title.strip(),
        description=body.description,
        attachments=body.attachments,
        status="open",
    )
    db.add(task)
    await db.flush()

    db.add(
        Notification(
            user_id=str(assignee_user.id),
            type="planner_task_created",
            message=f"Новая задача: {task.title}",
        )
    )
    await send_planner_email(
        assignee_user.email,
        "Новая задача в планере",
        f"Вам назначена задача «{task.title}».",
    )
    await send_planner_telegram(f"Планер: новая задача «{task.title}» для {assignee_user.full_name}.")
    await safe_log_audit(
        db,
        user_id=str(current_user.id),
        action="planner_task_created",
        entity_type="planner_task",
        entity_id=str(task.id),
        metadata={"assignee_id": str(task.assignee_id), "status": task.status},
    )
    await db.flush()
    return _task_payload(task)


@router.get("/tasks", response_model=list[PlannerTaskResponse])
async def list_tasks(
    mode: str = Query("all", pattern="^(all|mine|assigned)$"),
    current_user: User = Depends(require_roles("admin", "accountant", "manager")),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        return []

    filters = [PlannerTask.tenant_id == str(current_user.organization_id)]
    if mode == "mine":
        filters.append(PlannerTask.author_id == str(current_user.id))
    elif mode == "assigned":
        filters.append(PlannerTask.assignee_id == str(current_user.id))
    else:
        role = (current_user.role or "").lower()
        if role in {"owner", "admin"}:
            pass
        else:
            filters.append(
                or_(
                    PlannerTask.author_id == str(current_user.id),
                    PlannerTask.assignee_id == str(current_user.id),
                )
            )

    result = await db.execute(
        select(PlannerTask).where(and_(*filters)).order_by(PlannerTask.created_at.desc())
    )
    return [_task_payload(task) for task in result.scalars().all()]


@router.post("/tasks/{task_id}/close", response_model=PlannerTaskResponse)
async def close_task(
    task_id: str,
    current_user: User = Depends(require_roles("admin", "accountant", "manager")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlannerTask).where(
            PlannerTask.id == task_id,
            PlannerTask.tenant_id == str(current_user.organization_id),
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    if str(current_user.id) not in {task.author_id, task.assignee_id} and current_user.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Недостаточно прав для закрытия задачи")

    task.status = "closed"
    task.closed_at = datetime.now(timezone.utc)
    await safe_log_audit(
        db,
        user_id=str(current_user.id),
        action="planner_task_closed",
        entity_type="planner_task",
        entity_id=str(task.id),
        metadata={"closed_at": task.closed_at.isoformat() if task.closed_at else None},
    )
    await db.flush()
    return _task_payload(task)


@router.post("/tasks/{task_id}/report", response_model=PlannerReportResponse, status_code=201)
async def create_report(
    task_id: str,
    body: PlannerReportCreate,
    current_user: User = Depends(require_roles("admin", "accountant", "manager")),
    db: AsyncSession = Depends(get_db),
):
    task_result = await db.execute(
        select(PlannerTask).where(
            PlannerTask.id == task_id,
            PlannerTask.tenant_id == str(current_user.organization_id),
        )
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    if str(current_user.id) not in {task.assignee_id, task.author_id} and current_user.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Недостаточно прав для отчета по задаче")

    report = PlannerReport(
        task_id=task.id,
        author_id=str(current_user.id),
        content=body.content.strip(),
        attachments=body.attachments,
    )
    db.add(report)
    db.add(
        Notification(
            user_id=task.author_id,
            type="planner_report_created",
            message=f"Подготовлен отчет по задаче: {task.title}",
        )
    )
    author_result = await db.execute(select(User).where(User.id == task.author_id))
    author = author_result.scalar_one_or_none()
    if author:
        await send_planner_email(
            author.email,
            "Отчет по задаче готов",
            f"По задаче «{task.title}» подготовлен отчет.",
        )
    await send_planner_telegram(f"Планер: подготовлен отчет по задаче «{task.title}».")
    await safe_log_audit(
        db,
        user_id=str(current_user.id),
        action="planner_report_created",
        entity_type="planner_report",
        entity_id=str(report.id),
        metadata={"task_id": str(task.id)},
    )
    await db.flush()
    return PlannerReportResponse(
        id=report.id,
        task_id=report.task_id,
        author_id=report.author_id,
        content=report.content,
        attachments=list(report.attachments or []),
        created_at=report.created_at,
    )


@router.get("/tasks/{task_id}/comments", response_model=list[PlannerCommentResponse])
async def list_comments(
    task_id: str,
    current_user: User = Depends(require_roles("admin", "accountant", "manager")),
    db: AsyncSession = Depends(get_db),
):
    task_result = await db.execute(
        select(PlannerTask).where(
            PlannerTask.id == task_id,
            PlannerTask.tenant_id == str(current_user.organization_id),
        )
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    comments = await db.execute(
        select(PlannerComment).where(PlannerComment.task_id == task_id).order_by(PlannerComment.created_at.asc())
    )
    return comments.scalars().all()


@router.post("/tasks/{task_id}/comments", response_model=PlannerCommentResponse, status_code=201)
async def add_comment(
    task_id: str,
    body: PlannerCommentCreate,
    current_user: User = Depends(require_roles("admin", "accountant", "manager")),
    db: AsyncSession = Depends(get_db),
):
    task_result = await db.execute(
        select(PlannerTask).where(
            PlannerTask.id == task_id,
            PlannerTask.tenant_id == str(current_user.organization_id),
        )
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    comment = PlannerComment(
        task_id=task_id,
        author_id=str(current_user.id),
        content=body.content.strip(),
    )
    db.add(comment)
    await safe_log_audit(
        db,
        user_id=str(current_user.id),
        action="planner_comment_created",
        entity_type="planner_comment",
        entity_id=str(comment.id),
        metadata={"task_id": str(task_id)},
    )
    await db.flush()
    return comment
