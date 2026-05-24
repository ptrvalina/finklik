import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { assistantApi, type AssistantChatMessage, type AssistantSource } from '../api/client'
import { Link } from 'react-router-dom'
import OperationalPage from '../components/shell/OperationalPage'

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

const SUGGESTIONS = [
  'Как вести расходы по УСН?',
  'Где в приложении импортировать выписку?',
  'Что умеет раздел «Сканер»?',
]

export default function AssistantPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: status } = useQuery({
    queryKey: ['assistant-status'],
    queryFn: () => assistantApi.status().then((r) => r.data),
  })

  const { data: sourcesCatalog } = useQuery({
    queryKey: ['assistant-sources-catalog'],
    queryFn: () => assistantApi.sourcesCatalog().then((r) => r.data),
  })

  const chatMutation = useMutation({
    mutationFn: (msgs: AssistantChatMessage[]) => assistantApi.chat(msgs).then((r) => r.data),
    onSuccess: (data, vars) => {
      const src = data.sources as AssistantSource[] | undefined
      setMessages([...vars, { role: 'assistant', content: data.reply, sources: src }])
    },
  })

  const keySource = status?.key_source
  const orgIsolated = keySource === 'organization'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatMutation.isPending])

  function send(text?: string) {
    const t = (text ?? input).trim()
    if (!t || chatMutation.isPending) return
    const next: AssistantChatMessage[] = [...messages, { role: 'user', content: t }]
    setMessages(next)
    setInput('')
    chatMutation.mutate(next)
  }

  return (
    <OperationalPage
      narrow
      eyebrow="Помощник"
      title="Консультант"
      description="Ориентиры по учёту и госпорталам (ИМНС, ФСЗН, Белстат). Не заменяет бухгалтера и официальные разъяснения."
      secondaryActions={
        <>
          <Link to="/settings" className="btn-secondary w-full sm:w-auto">
            <Icon name="vpn_key" className="text-lg" /> Ключ ИИ
          </Link>
          <Link to="/reports" className="btn-secondary w-full sm:w-auto">
            <Icon name="assignment_turned_in" className="text-lg" /> Отчётность
          </Link>
        </>
      }
      className="pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div
        className={`rounded-2xl border px-4 py-3 text-sm shadow-soft ${
          status?.llm_enabled
            ? orgIsolated
              ? 'border-primary/25 bg-primary/5 text-on-surface'
              : 'border-emerald-200/80 bg-emerald-50/80 text-on-surface'
            : 'border-amber-200/90 bg-amber-50 text-amber-950'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Icon
            name={status?.llm_enabled ? (orgIsolated ? 'shield_lock' : 'psychology') : 'info'}
            filled
            className={`text-lg ${status?.llm_enabled ? (orgIsolated ? 'text-primary' : 'text-emerald-700') : 'text-amber-700'}`}
          />
          <span className="font-bold text-on-surface">
            {status?.llm_enabled
              ? orgIsolated
                ? `ИИ (изолированный ключ организации) · ${status.model ?? 'модель'}`
                : `ИИ (платформа) · ${status.model ?? 'модель'}`
              : 'Демо-режим'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          {status?.llm_enabled
            ? orgIsolated
              ? `${status.isolation_note ?? 'Ключ хранится зашифрованно только для вашей организации и не передаётся другим клиентам.'} Проверяйте критичные цифры у бухгалтера.`
              : 'Ответы идут через платформенный ключ API. Для максимальной приватности владелец может задать свой ключ в «Настройки» → «Интеграции».'
            : 'Нет ключа ИИ: задайте изолированный ключ организации («Настройки» → «Интеграции») или попросите администратора включить ключ на сервере API.'}
        </p>
      </div>

      <div className="flex min-h-[min(420px,50vh)] flex-1 flex-col rounded-2xl border border-outline/80 bg-surface shadow-card dark:border-outline/45 sm:min-h-[480px]">
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {messages.length === 0 && !chatMutation.isPending && (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">Примеры вопросов:</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="tap-highlight-none rounded-xl border border-outline/75 bg-surface-container-low px-3 py-2 text-left text-xs font-medium text-on-surface transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {sourcesCatalog?.groups && sourcesCatalog.groups.length > 0 && (
                <div className="rounded-xl border border-outline/75 bg-surface-container-low/90 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Первоисточники и порталы</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-on-surface-variant">
                    {sourcesCatalog.groups.flatMap((g) =>
                      (g.entries || []).map((e) => (
                        <li key={`${g.id}-${e.title}`}>
                          {e.url ? (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {e.title}
                            </a>
                          ) : (
                            <span className="text-on-surface">{e.title}</span>
                          )}
                          {e.note && <span className="text-on-surface-variant"> — {e.note}</span>}
                        </li>
                      )),
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-primary/12 text-on-surface ring-1 ring-primary/25 shadow-soft'
                    : 'border border-outline/75 bg-surface-container-low text-on-surface shadow-soft'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                  <div className="mt-3 border-t border-outline/75 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Источники-ориентиры</p>
                    <ul className="mt-1.5 space-y-1">
                      {m.sources.map((s) => (
                        <li key={s.id || s.title || ''} className="text-[11px] text-on-surface-variant">
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline"
                            >
                              {s.title}
                            </a>
                          ) : (
                            <span className="text-on-surface">{s.title}</span>
                          )}
                          {s.authority && s.authority !== 'general' && (
                            <span className="ml-1 text-on-surface-variant">({s.authority})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-outline/75 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant shadow-soft">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary" />
                Думаю…
              </div>
            </div>
          )}

          {chatMutation.isError && (
            <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              Не удалось получить ответ. Проверьте сеть или попробуйте позже.
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-outline/55 bg-surface-container-low/50 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              className="input min-h-[3rem] flex-1 resize-none rounded-xl py-3 text-sm"
              rows={2}
              placeholder="Ваш вопрос…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              disabled={chatMutation.isPending}
            />
            <button
              type="button"
              className="btn-primary min-h-12 shrink-0 px-6"
              disabled={!input.trim() || chatMutation.isPending}
              onClick={() => send()}
            >
              <Icon name="send" className="text-lg" />
              Отправить
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-on-surface-variant">Enter — отправить · Shift+Enter — новая строка</p>
        </div>
      </div>

      {messages.length > 0 && (
        <button
          type="button"
          className="btn-ghost self-center text-xs text-on-surface-variant"
          onClick={() => {
            setMessages([])
            chatMutation.reset()
          }}
        >
          Очистить диалог
        </button>
      )}
    </OperationalPage>
  )
}
