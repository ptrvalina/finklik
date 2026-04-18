import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { assistantApi, type AssistantChatMessage } from '../api/client'

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

  const chatMutation = useMutation({
    mutationFn: (msgs: AssistantChatMessage[]) => assistantApi.chat(msgs).then((r) => r.data),
    onSuccess: (data, vars) => {
      setMessages([...vars, { role: 'assistant', content: data.reply }])
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
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Консультант</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Общие подсказки по учёту и разделам ФинКлика. Не заменяет бухгалтера и официальные разъяснения органов.
        </p>
      </div>

      <div
        className={`rounded-2xl border px-4 py-3 text-sm ${
          status?.llm_enabled
            ? orgIsolated
              ? 'border-teal-500/30 bg-teal-500/5 text-zinc-300'
              : 'border-secondary/25 bg-secondary/5 text-zinc-300'
            : 'border-amber-500/25 bg-amber-500/5 text-amber-100/90'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Icon
            name={status?.llm_enabled ? (orgIsolated ? 'shield_lock' : 'psychology') : 'info'}
            filled
            className="text-lg text-amber-300/90"
          />
          <span className="font-bold text-white">
            {status?.llm_enabled
              ? orgIsolated
                ? `ИИ (изолированный ключ организации) · ${status.model ?? 'модель'}`
                : `ИИ (платформа) · ${status.model ?? 'модель'}`
              : 'Демо-режим'}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          {status?.llm_enabled
            ? orgIsolated
              ? `${status.isolation_note ?? 'Ключ хранится зашифрованно только для вашей организации и не передаётся другим клиентам.'} Проверяйте критичные цифры у бухгалтера.`
              : 'Ответы идут через платформенный ключ API. Для максимальной приватности владелец может задать свой ключ в «Настройки» → «Интеграции».'
            : 'Нет ключа ИИ: задайте изолированный ключ организации («Настройки» → «Интеграции») или попросите администратора включить ключ на сервере API.'}
        </p>
      </div>

      <div className="flex min-h-[min(420px,50vh)] flex-1 flex-col rounded-2xl bg-[#12161f] ring-1 ring-white/[0.06] sm:min-h-[480px]">
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
                    className="tap-highlight-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.07]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-primary/20 text-white ring-1 ring-primary/25'
                    : 'bg-white/[0.06] text-zinc-200 ring-1 ring-white/[0.05]'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-zinc-400 ring-1 ring-white/[0.05]">
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

        <div className="border-t border-white/[0.06] p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              className="input min-h-[3rem] flex-1 resize-none rounded-xl border-white/[0.08] bg-[#0d1017] py-3 text-sm text-white placeholder:text-zinc-600"
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
