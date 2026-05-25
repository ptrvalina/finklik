import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workspaceApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import { useAuthStore } from '../../store/authStore'

type CommentRow = {
  id: string
  author_user_id: string
  body: string
  created_at?: string | null
}

function formatWhen(iso?: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ru-BY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/** Операционные заметки к задаче (не чат) — привязка к inbox / согласованию / пакету работ. */
export function OperationalCommentsPanel({
  targetKind,
  targetId,
  className = '',
}: {
  targetKind: string
  targetId: string
  className?: string
}) {
  const userId = useAuthStore((s) => s.user?.id)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const qc = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: orgQueryKey(['workspace-comments', targetKind, targetId]),
    queryFn: () =>
      workspaceApi.comments({ target_kind: targetKind, target_id: targetId }).then((r) => r.data),
    enabled: open,
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (body: string) =>
      workspaceApi.createComment({ target_kind: targetKind, target_id: targetId, body }).then((r) => r.data),
    onSuccess: () => {
      setDraft('')
      void qc.invalidateQueries({ queryKey: orgQueryKey(['workspace-comments', targetKind, targetId]) })
    },
  })

  const comments: CommentRow[] = data?.comments ?? []
  const countHint = open ? comments.length : null

  return (
    <div
      className={`mt-3 border-t border-outline/25 pt-3 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="text-xs font-semibold text-primary hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Скрыть заметки' : 'Заметки по задаче'}
        {countHint != null && countHint > 0 ? ` (${countHint})` : ''}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {isLoading || isFetching ? (
            <p className="text-xs text-on-surface-variant">Загрузка…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Пока нет заметок — зафиксируйте контекст для коллеги.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-xl bg-surface-container-low/80 px-3 py-2 text-sm">
                  <p className="text-on-surface">{c.body}</p>
                  <p className="mt-1 text-[10px] text-on-surface-variant">
                    {c.author_user_id === userId ? 'Вы' : 'Коллега'}
                    {c.created_at ? ` · ${formatWhen(c.created_at)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              className="input min-h-[72px] flex-1 resize-y rounded-xl text-sm"
              placeholder="Краткая заметка для бухгалтера или клиента…"
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary min-h-10 shrink-0 px-4 text-xs sm:mb-0.5"
              disabled={!draft.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(draft.trim())}
            >
              {createMutation.isPending ? '…' : 'Добавить'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
