import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AppModal from '../components/ui/AppModal'
import { motion } from 'framer-motion'
import { notesApi } from '../api/client'
import { CardSkeleton } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'

const STORAGE_KEY = 'finklik.notes.v1'
const IMPORT_FLAG = 'finklik.notes.localImportDone.v1'

type LocalNote = { id: string; title: string; body: string; updatedAt: string }

type ApiNote = {
  id: string
  title: string
  body: string
  updated_at: string
  created_at: string
}

function loadLocalNotes(): LocalNote[] {
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

function clearLocalNotes() {
  localStorage.removeItem(STORAGE_KEY)
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function Notes() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ApiNote | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [importUi, setImportUi] = useState<{ count: number } | null>(null)

  const notesQuery = useQuery({
    queryKey: ['notes'],
    queryFn: () => notesApi.list().then((r) => r.data as ApiNote[]),
    retry: 1,
  })

  useEffect(() => {
    if (!notesQuery.isSuccess) return
    const remote = notesQuery.data ?? []
    if (remote.length > 0) return
    const local = loadLocalNotes()
    if (local.length === 0) return
    if (localStorage.getItem(IMPORT_FLAG) === '1') return
    setImportUi({ count: local.length })
  }, [notesQuery.isSuccess, notesQuery.data])

  const createMutation = useMutation({
    mutationFn: (payload: { title: string; body: string }) => notesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; title: string; body: string }) =>
      notesApi.update(args.id, { title: args.title, body: args.body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })

  const importMutation = useMutation({
    mutationFn: async (items: LocalNote[]) => {
      for (const n of items) {
        await notesApi.create({
          title: n.title || 'Без названия',
          body: n.body || '',
        })
      }
    },
    onSuccess: () => {
      clearLocalNotes()
      localStorage.setItem(IMPORT_FLAG, '1')
      setImportUi(null)
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })

  const sorted = useMemo(() => {
    const items = notesQuery.data ?? []
    return [...items].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  }, [notesQuery.data])

  const openCreate = useCallback(() => {
    setEditing(null)
    setTitle('')
    setBody('')
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((n: ApiNote) => {
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
    if (editing) {
      updateMutation.mutate({ id: editing.id, title: t, body: b }, { onSuccess: closeModal })
    } else {
      createMutation.mutate({ title: t, body: b }, { onSuccess: closeModal })
    }
  }, [body, closeModal, createMutation, editing, title, updateMutation])

  const remove = useCallback(
    (id: string) => {
      if (!confirm('Удалить заметку?')) return
      deleteMutation.mutate(id)
    },
    [deleteMutation],
  )

  const busy =
    notesQuery.isLoading ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  if (notesQuery.isError) {
    return (
      <div className="fc-page-shell mx-auto max-w-3xl pb-24 lg:pb-10">
        <CalmErrorState
          title="Заметки недоступны"
          fallbackMessage="Не удалось загрузить заметки. Проверьте сеть и попробуйте снова."
          onRetry={() => void notesQuery.refetch()}
        />
      </div>
    )
  }

  return (
    <div className="fc-page-shell mx-auto max-w-3xl pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="btn-primary fc-btn-thumb" onClick={openCreate} disabled={busy}>
          <Icon name="add" className="text-lg" /> Новая
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Заметки</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{sorted.length}</p>
          <p className="text-[11px] text-on-surface-variant">В организации</p>
        </div>
        <div className="glass-card rounded-2xl p-4 sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Синхронизация</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">
            {importUi ? `${importUi.count} локальных — можно импортировать` : 'С сервером'}
          </p>
          <p className="text-[11px] text-primary">Личные пометки по организации</p>
        </div>
      </div>

      {importUi && (
        <div className="card-elevated flex flex-col gap-3 border border-secondary/30 bg-secondary/5 p-4 ring-1 ring-secondary/15 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-on-surface">
            В браузере есть {importUi.count}{' '}
            {importUi.count === 1 ? 'старая заметка' : 'старых заметок'} (localStorage). Перенести в аккаунт?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                localStorage.setItem(IMPORT_FLAG, '1')
                setImportUi(null)
              }}
            >
              Пропустить
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={importMutation.isPending}
              onClick={() => importMutation.mutate(loadLocalNotes())}
            >
              {importMutation.isPending ? 'Импорт…' : 'Импортировать'}
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !notesQuery.isLoading ? (
        <div className="card-elevated border border-dashed border-primary/30 bg-gradient-to-br from-primary/[0.04] to-transparent p-10 text-center text-sm text-on-surface-variant backdrop-blur-sm">
          Пока нет заметок — нажмите «Новая заметка».
        </div>
      ) : notesQuery.isLoading ? (
        <div className="space-y-4 py-4" aria-busy="true" aria-label="Загрузка заметок">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <ul className="space-y-4">
          {sorted.map((n, idx) => (
            <motion.li
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, type: 'spring', stiffness: 380, damping: 28 }}
              className="card-elevated border border-outline/60 p-4 shadow-card ring-1 ring-primary/[0.05] sm:p-5"
            >
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
                Обновлено: {new Date(n.updated_at).toLocaleString('ru-BY')}
              </p>
            </motion.li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <AppModal
          title={editing ? 'Редактировать заметку' : 'Новая заметка'}
          onClose={closeModal}
          wide
          footer={
            <div className="flex w-full justify-end gap-2 border-t border-outline/80 px-4 py-3 dark:border-outline/40 sm:px-6">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
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
