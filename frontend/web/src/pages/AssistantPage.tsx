import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { assistantApi, type AssistantChatMessage, type AssistantSource } from '../api/client'

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
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">Консультант</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Ориентиры по учёту, госпорталам (ИМНС, ФСЗН, Белстат, Белгосстрах), Pravo.by и справочным системам. Не заменяет бухгалтера и
          официальные разъяснения органов.
        </p>
      </div>

      <div
        className={`rounded-2xl border px-4 py-3 text-sm shadow-soft ${
          status?.llm_enabled
            ? orgIsolated
              ? 'border-primary/25 bg-primary/5 text-zinc-700'
              : 'border-emerald-200/80 bg-emerald-50/80 text-zinc-700'
            : 'border-amber-200/90 bg-amber-50 text-amber-950'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Icon
            name={status?.llm_enabled ? (orgIsolated ? 'shield_lock' : 'psychology') : 'info'}
            filled
            className={`text-lg ${status?.llm_enabled ? (orgIsolated ? 'text-primary' : 'text-emerald-700') : 'text-amber-700'}`}
          />
          <span className="font-bold text-zinc-900">
            {status?.llm_enabled
              ? orgIsolated
                ? `ИИ (изолированный ключ организации) · ${status.model ?? 'модель'}`
                : `ИИ (платформа) · ${status.model ?? 'модель'}`
              : 'Демо-режим'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          {status?.llm_enabled
            ? orgIsolated
              ? `${status.isolation_note ?? 'Ключ хранится зашифрованно только для вашей организации и не передаётся другим клиентам.'} Проверяйте критичные цифры у бухгалтера.`
              : 'Ответы идут через платформенный ключ API. Для максимальной приватности владелец может задать свой ключ в «Настройки» → «Интеграции».'
            : 'Нет ключа ИИ: задайте изолированный ключ организации («Настройки» → «Интеграции») или попросите администратора включить ключ на сервере API.'}
        </p>
      </div>

      <div className="flex min-h-[min(420px,50vh)] flex-1 flex-col rounded-2xl border border-zinc-200/90 bg-surface shadow-card dark:border-zinc-700/80 sm:min-h-[480px]">
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {messages.length === 0 && !chatMutation.isPending && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Примеры вопросов:</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="tap-highlight-none rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-left text-xs font-medium text-zinc-800 transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {sourcesCatalog?.groups && sourcesCatalog.groups.length > 0 && (
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Первоисточники и порталы</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-zinc-600">
                    {sourcesCatalog.groups.flatMap((g) =>
                      (g.entries || []).map((e) => (
                        <li key={`${g.id}-${e.title}`}>
                          {e.url ? (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {e.title}
                            </a>
                          ) : (
                            <span className="text-zinc-800">{e.title}</span>
                          )}
                          {e.note && <span className="text-zinc-600"> — {e.note}</span>}
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
                    ? 'bg-primary/12 text-zinc-900 ring-1 ring-primary/25 shadow-soft'
                    : 'border border-zinc-200/80 bg-zinc-50 text-zinc-800 shadow-soft'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                  <div className="mt-3 border-t border-zinc-200/80 pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Источники-ориентиры</p>
                    <ul className="mt-1.5 space-y-1">
                      {m.sources.map((s) => (
                        <li key={s.id || s.title || ''} className="text-[11px] text-zinc-600">
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
                            <span className="text-zinc-800">{s.title}</span>
                          )}
                          {s.authority && s.authority !== 'general' && (
                            <span className="ml-1 text-zinc-600">({s.authority})</span>
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
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 shadow-soft">
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

        <div className="border-t border-zinc-100 bg-zinc-50/50 p-3 sm:p-4">
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
          <p className="mt-2 text-center text-[10px] text-zinc-600">Enter — отправить · Shift+Enter — новая строка</p>
        </div>
      </div>

      {messages.length > 0 && (
        <button
          type="button"
          className="btn-ghost self-center text-xs text-zinc-500"
          onClick={() => {
            setMessages([])
            chatMutation.reset()
          }}
        >
          Очистить диалог
        </button>
      )}
    </div>
  )
}
