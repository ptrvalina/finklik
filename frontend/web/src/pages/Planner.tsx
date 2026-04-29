import { FormEvent, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { plannerApi, teamApi } from '../api/client'
import { useAuthStore } from '../store/authStore'

type PlannerTask = {
  id: string
  title: string
  description?: string
  assignee_id: string
  author_id: string
  status: string
  created_at: string
}
type PlannerComment = {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
}

export default function Planner() {
  const user = useAuthStore((s) => s.user)
  const role = (user?.role || '').toLowerCase()
  const canRequestReport = role === 'owner' || role === 'admin'
  const qc = useQueryClient()
  const [viewMode, setViewMode] = useState<'mine' | 'assigned'>('mine')
  const [taskKind, setTaskKind] = useState<'task' | 'report_request'>('task')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [attachments, setAttachments] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [reportText, setReportText] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState<Record<string, string>>({})

  const myTasksQuery = useQuery({
    queryKey: ['planner', 'mine'],
    queryFn: () => plannerApi.listTasks('mine').then((r) => r.data as PlannerTask[]),
  })
  const assignedTasksQuery = useQuery({
    queryKey: ['planner', 'assigned'],
    queryFn: () => plannerApi.listTasks('assigned').then((r) => r.data as PlannerTask[]),
  })
  const membersQuery = useQuery({
    queryKey: ['team-members'],
    queryFn: () => teamApi.listMembers().then((r) => r.data?.members ?? []),
  })

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data])
  const assignees = useMemo(
    () => members.filter((m: any) => ['owner', 'admin', 'accountant'].includes((m.role || '').toLowerCase())),
    [members],
  )

  const createTaskMutation = useMutation({
    mutationFn: () =>
      plannerApi.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        assignee_id: assigneeId,
        attachments: attachments
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setTitle('')
      setDescription('')
      setAttachments('')
      qc.invalidateQueries({ queryKey: ['planner'] })
    },
  })

  const closeTaskMutation = useMutation({
    mutationFn: (taskId: string) => plannerApi.closeTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planner'] }),
  })

  const reportMutation = useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      plannerApi.createReport(taskId, { content, attachments: [] }),
    onSuccess: (_, vars) => {
      setReportText((prev) => ({ ...prev, [vars.taskId]: '' }))
      qc.invalidateQueries({ queryKey: ['planner'] })
    },
  })
  const commentMutation = useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) => plannerApi.addComment(taskId, { content }),
    onSuccess: (_, vars) => {
      setCommentText((prev) => ({ ...prev, [vars.taskId]: '' }))
      qc.invalidateQueries({ queryKey: ['planner-comments', vars.taskId] })
    },
  })

  function onCreateTask(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !assigneeId) return
    createTaskMutation.mutate()
  }

  return (
    <section className="space-y-6">
      <div className="card-elevated p-6">
        <h1 className="text-2xl font-semibold text-on-surface">Планер</h1>
        <p className="mt-2 text-on-surface-variant">Задачи и отчёты по документам, платежам и запросам владельца.</p>
      </div>

      <form onSubmit={onCreateTask} className="card-elevated grid gap-3 p-6 md:grid-cols-2">
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Новая задача</h2>
          {canRequestReport && (
            <div className="inline-flex rounded-xl border border-outline/70 p-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${taskKind === 'task' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                onClick={() => setTaskKind('task')}
              >
                Обычная задача
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${taskKind === 'report_request' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
                onClick={() => {
                  setTaskKind('report_request')
                  if (!title.trim()) setTitle('Запрос отчёта:')
                }}
              >
                Запрос отчёта
              </button>
            </div>
          )}
        </div>
        <input
          className="input"
          placeholder={taskKind === 'report_request' ? 'Напр.: Покажи расходы по аренде за январь' : 'Напр.: Срочно оплатить счёт №123'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Назначить ответственного</option>
          {assignees.map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.full_name} ({m.role})
            </option>
          ))}
        </select>
        <textarea
          className="input md:col-span-2 min-h-[90px]"
          placeholder={taskKind === 'report_request' ? 'Укажите период, детализацию и ожидаемый формат отчёта' : 'Описание и контекст задачи'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="input md:col-span-2"
          placeholder="Вложения (URL через запятую)"
          value={attachments}
          onChange={(e) => setAttachments(e.target.value)}
        />
        <button className="btn-primary md:col-span-2" type="submit" disabled={createTaskMutation.isPending}>
          Создать задачу
        </button>
      </form>

      <div className="card-elevated p-3">
        <div className="inline-flex rounded-xl border border-outline/70 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === 'mine' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
            onClick={() => setViewMode('mine')}
          >
            Мои задачи ({(myTasksQuery.data ?? []).length})
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === 'assigned' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
            onClick={() => setViewMode('assigned')}
          >
            Я ответственный ({(assignedTasksQuery.data ?? []).length})
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <TaskList
          title={viewMode === 'mine' ? 'Мои задачи' : 'Задачи, где я ответственный'}
          tasks={viewMode === 'mine' ? myTasksQuery.data ?? [] : assignedTasksQuery.data ?? []}
          loading={viewMode === 'mine' ? myTasksQuery.isLoading : assignedTasksQuery.isLoading}
          onClose={(id) => closeTaskMutation.mutate(id)}
          canClose
          userId={user?.id || ''}
          onReport={(taskId, content) => reportMutation.mutate({ taskId, content })}
          reportText={reportText}
          setReportText={setReportText}
          commentText={commentText}
          setCommentText={setCommentText}
          onComment={(taskId, content) => commentMutation.mutate({ taskId, content })}
        />
      </div>
    </section>
  )
}

function TaskList(props: {
  title: string
  tasks: PlannerTask[]
  loading?: boolean
  canClose?: boolean
  onClose: (id: string) => void
  userId: string
  onReport: (taskId: string, content: string) => void
  reportText: Record<string, string>
  setReportText: Dispatch<SetStateAction<Record<string, string>>>
  commentText: Record<string, string>
  setCommentText: Dispatch<SetStateAction<Record<string, string>>>
  onComment: (taskId: string, content: string) => void
}) {
  const { title, tasks, loading, canClose, onClose, userId, onReport, reportText, setReportText, commentText, setCommentText, onComment } = props
  return (
    <div className="card-elevated p-5">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      {loading ? (
        <p className="text-on-surface-variant">Загрузка...</p>
      ) : tasks.length === 0 ? (
        <p className="text-on-surface-variant">Пока нет задач</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canClose={canClose}
              onClose={onClose}
              userId={userId}
              onReport={onReport}
              reportText={reportText}
              setReportText={setReportText}
              commentText={commentText}
              setCommentText={setCommentText}
              onComment={onComment}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard(props: {
  task: PlannerTask
  canClose?: boolean
  onClose: (id: string) => void
  userId: string
  onReport: (taskId: string, content: string) => void
  reportText: Record<string, string>
  setReportText: Dispatch<SetStateAction<Record<string, string>>>
  commentText: Record<string, string>
  setCommentText: Dispatch<SetStateAction<Record<string, string>>>
  onComment: (taskId: string, content: string) => void
}) {
  const { task, canClose, onClose, userId, onReport, reportText, setReportText, commentText, setCommentText, onComment } = props
  const commentsQuery = useQuery({
    queryKey: ['planner-comments', task.id],
    queryFn: () => plannerApi.listComments(task.id).then((r) => r.data as PlannerComment[]),
  })
  return (
    <article className="rounded-xl border border-outline/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{task.title}</p>
                  <p className="text-xs text-on-surface-variant">{task.description || 'Без описания'}</p>
                </div>
                <span className={`text-xs ${task.status === 'closed' ? 'text-emerald-600' : 'text-amber-600'}`}>{task.status}</span>
              </div>
              {task.status !== 'closed' && canClose && (
                <button className="btn-secondary mt-3 mr-2" onClick={() => onClose(task.id)}>
                  Закрыть
                </button>
              )}
              <div className="mt-3 space-y-2 rounded-lg bg-surface-container-low/40 p-2">
                <p className="text-xs font-semibold text-on-surface-variant">Комментарии</p>
                <div className="space-y-1">
                  {(commentsQuery.data || []).map((c) => (
                    <div key={c.id} className="rounded-md border border-outline/40 px-2 py-1 text-xs">
                      <p>{c.content}</p>
                      <p className="text-on-surface-variant">{new Date(c.created_at).toLocaleString('ru-RU')}</p>
                    </div>
                  ))}
                  {commentsQuery.data?.length === 0 && <p className="text-xs text-on-surface-variant">Пока нет комментариев</p>}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input h-9 text-sm"
                    placeholder="Добавить комментарий"
                    value={commentText[task.id] || ''}
                    onChange={(e) => setCommentText((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => onComment(task.id, commentText[task.id] || '')}
                    disabled={!(commentText[task.id] || '').trim()}
                  >
                    Комментировать
                  </button>
                </div>
              </div>
              {task.status !== 'closed' && (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="input min-h-[70px]"
                    placeholder="Подготовить отчёт..."
                    value={reportText[task.id] || ''}
                    onChange={(e) => setReportText((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  />
                  <button
                    className="btn-primary"
                    onClick={() => onReport(task.id, reportText[task.id] || '')}
                    disabled={!(reportText[task.id] || '').trim() || (task.assignee_id !== userId && task.author_id !== userId)}
                  >
                    Подготовить отчёт
                  </button>
                </div>
              )}
    </article>
  )
}
