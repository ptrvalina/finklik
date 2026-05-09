from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.datetime_utils import utc_now_naive
from app.core.deps import get_current_user
from app.models.user import User
from app.models.user_note import UserNote
from app.schemas.user_note import UserNoteCreate, UserNoteResponse, UserNoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[UserNoteResponse])
async def list_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        return []
    result = await db.execute(
        select(UserNote)
        .where(
            UserNote.organization_id == current_user.organization_id,
            UserNote.user_id == current_user.id,
        )
        .order_by(UserNote.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=UserNoteResponse, status_code=201)
async def create_note(
    body: UserNoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Организация не назначена")
    title = (body.title or "").strip() or "Без названия"
    now = utc_now_naive()
    note = UserNote(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        title=title[:500],
        body=body.body or "",
        created_at=now,
        updated_at=now,
    )
    db.add(note)
    await db.flush()
    return note


@router.patch("/{note_id}", response_model=UserNoteResponse)
async def update_note(
    note_id: str,
    body: UserNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Организация не назначена")
    result = await db.execute(
        select(UserNote).where(
            UserNote.id == note_id,
            UserNote.organization_id == current_user.organization_id,
            UserNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    if body.title is not None:
        t = body.title.strip() or "Без названия"
        note.title = t[:500]
    if body.body is not None:
        note.body = body.body
    note.updated_at = utc_now_naive()
    await db.flush()
    return note


@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="Организация не назначена")
    result = await db.execute(
        select(UserNote).where(
            UserNote.id == note_id,
            UserNote.organization_id == current_user.organization_id,
            UserNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    await db.delete(note)
    await db.flush()
