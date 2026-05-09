import { useCallback, useEffect, useMemo, useState } from 'react'
import AppModal from '../components/ui/AppModal'

const STORAGE_KEY = 'finklik.notes.v1'

type Note = { id: string; title: string; body: string; updatedAt: string }

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x) => x && typeof x.id === 'string')
  } catch {
    return []
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  const sorted = useMemo(
    () => [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [notes],
  )

  const openCreate = useCallback(() => {
    setEditing(null)
    setTitle('')
    setBody('')
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((n: Note) => {
    setEditing(n)
    setTitle(n.title)
    setBody(n.body)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditing(null)
    setTitle('')
    setBody('')
  }, [])

  const handleSave = useCallback(() => {
    const t = title.trim() || 'Без названия'
    const b = body.trim()
    const now = new Date().toISOString()
    if (editing) {
      setNotes((prev) =>
        prev.map((x) =>
          x.id === editing.id ? { ...x, title: t, body: b, updatedAt: now } : x,
        ),
      )
    } else {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setNotes((prev) => [{ id, title: t, body: b, updatedAt: now }, ...prev])
    }
    closeModal()
  }, [body, closeModal, editing, title])

  const remove = useCallback((id: string) => {
    if (!confirm('Удалить заметку?')) return
    setNotes((prev) => prev.filter((x) => x.id !== id))
  }, [])

  return (
    <div className="max-w-4xl space-y-5">
      <div className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h1 className="page-heading">Заметки</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Личные заметки хранятся только в этом браузере (localStorage).
          </p>
        </div>
        <button type="button" className="btn-primary self-start sm:self-auto" onClick={openCreate}>
          <Icon name="add" className="mr-1 align-middle text-lg" /> Новая заметка
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="card-elevated border border-dashed border-outline/60 p-8 text-center text-sm text-on-surface-variant">
          Пока нет заметок — нажмите «Новая заметка».
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((n) => (
            <li key={n.id} className="card-elevated border border-outline/70 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <button
                  type="button"
                  className="text-left font-headline text-base font-bold text-on-surface hover:text-primary"
                  onClick={() => openEdit(n)}
                >
                  {n.title}
                </button>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="tap-highlight-none rounded-lg border border-outline/80 px-2 py-1 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
                    onClick={() => openEdit(n)}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="tap-highlight-none rounded-lg border border-error/25 px-2 py-1 text-xs font-bold text-error hover:bg-error/10"
                    onClick={() => remove(n.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant line-clamp-4">{n.body || '—'}</p>
              <p className="mt-2 text-[11px] text-on-surface-variant/80">
                Обновлено: {new Date(n.updatedAt).toLocaleString('ru-BY')}
              </p>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <AppModal
          title={editing ? 'Редактировать заметку' : 'Новая заметка'}
          onClose={closeModal}
          wide
          footer={
            <div className="flex w-full justify-end gap-2 border-t border-outline/80 px-4 py-3 dark:border-zinc-800 sm:px-6">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Отмена
              </button>
              <button type="button" className="btn-primary" onClick={handleSave}>
                Сохранить
              </button>
            </div>
          }
        >
          <div className="space-y-4 px-4 py-4 sm:px-6">
            <div>
              <label className="label">Заголовок</label>
              <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: встреча с бухгалтером" />
            </div>
            <div>
              <label className="label">Текст</label>
              <textarea
                className="input min-h-[160px] w-full resize-y font-sans"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Текст заметки…"
              />
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}
