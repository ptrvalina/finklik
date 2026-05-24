import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { okedApi } from '../../api/client'

export type OkedItem = { code: string; name_ru: string }

type Props = {
  primary: OkedItem | null
  secondary: OkedItem[]
  onPrimaryChange: (item: OkedItem | null) => void
  onSecondaryChange: (items: OkedItem[]) => void
}

async function resolveOkedByCode(code: string): Promise<OkedItem | null> {
  const { data } = await okedApi.search(code, 5)
  const items = (data.items || []) as OkedItem[]
  return items.find((i) => i.code === code) || items[0] || { code, name_ru: code }
}

export async function hydrateOkedFromProfile(
  primaryCode: string | null | undefined,
  secondaryCodes: string[] | undefined,
): Promise<{ primary: OkedItem | null; secondary: OkedItem[] }> {
  const secondary: OkedItem[] = []
  if (secondaryCodes?.length) {
    const resolved = await Promise.all(secondaryCodes.map((c) => resolveOkedByCode(c)))
    for (const item of resolved) {
      if (item && !secondary.some((s) => s.code === item.code)) secondary.push(item)
    }
  }
  let primary: OkedItem | null = null
  if (primaryCode) {
    primary = await resolveOkedByCode(primaryCode)
    if (primary) {
      const idx = secondary.findIndex((s) => s.code === primary!.code)
      if (idx >= 0) secondary.splice(idx, 1)
    }
  }
  return { primary, secondary }
}

export default function OkedSelector({ primary, secondary, onPrimaryChange, onSecondaryChange }: Props) {
  const [q, setQ] = useState('')
  const [highlight, setHighlight] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const { data: searchData, isFetching: searchLoading } = useQuery({
    queryKey: ['oked-search', q],
    queryFn: () => okedApi.search(q, 16).then((r) => r.data.items as OkedItem[]),
    enabled: q.trim().length >= 2,
    staleTime: 120_000,
  })

  const { data: popular = [] } = useQuery({
    queryKey: ['oked-popular'],
    queryFn: () => okedApi.popular(16).then((r) => r.data as OkedItem[]),
    staleTime: 300_000,
  })

  const suggestions = useMemo(() => {
    if (q.trim().length >= 2 && searchData) return searchData
    return popular
  }, [q, searchData, popular])

  useEffect(() => {
    setHighlight(0)
  }, [suggestions])

  const addSecondary = useCallback(
    (item: OkedItem) => {
      if (primary?.code === item.code) return
      if (secondary.some((s) => s.code === item.code)) return
      onSecondaryChange([...secondary, item])
    },
    [primary, secondary, onSecondaryChange],
  )

  const removeSecondary = useCallback(
    (code: string) => {
      onSecondaryChange(secondary.filter((s) => s.code !== code))
    },
    [secondary, onSecondaryChange],
  )

  const pickFromList = useCallback(
    (item: OkedItem, opts?: { forceSecondary?: boolean }) => {
      if (opts?.forceSecondary) {
        addSecondary(item)
        return
      }
      if (primary?.code === item.code) {
        addSecondary(item)
        onPrimaryChange(null)
        return
      }
      if (secondary.some((s) => s.code === item.code)) {
        removeSecondary(item.code)
        return
      }
      onPrimaryChange(item)
      setQ('')
    },
    [primary, secondary, addSecondary, removeSecondary, onPrimaryChange],
  )

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = suggestions[highlight]
      if (item) {
        if (e.shiftKey) addSecondary(item)
        else pickFromList(item)
      }
    }
  }

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="text-xs font-semibold text-on-surface">Основной ОКЭД</p>
        {primary ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">
              <span className="font-mono text-xs opacity-90">{primary.code}</span>
              <span className="max-w-[14rem] truncate sm:max-w-none">{primary.name_ru}</span>
            </span>
            <button
              type="button"
              className="text-xs font-medium text-on-surface-variant underline-offset-2 hover:underline"
              onClick={() => onPrimaryChange(null)}
            >
              Сменить
            </button>
            <button
              type="button"
              className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
              onClick={() => {
                addSecondary(primary)
                onPrimaryChange(null)
              }}
            >
              В дополнительные
            </button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-on-surface-variant">Выберите основной вид деятельности из списка ниже.</p>
        )}
      </div>

      <div>
        <label className="label">Поиск ОКЭД</label>
        <input
          className="input min-h-11 w-full rounded-xl"
          placeholder="Кафе, IT, розница, доставка…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onSearchKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-1 text-[11px] text-on-surface-variant">
          Enter — основной · Shift+Enter — дополнительный · повторный клик по основному — в дополнительные
        </p>
      </div>

      <div className="min-h-[10rem] rounded-xl border border-outline/40 bg-surface/50">
        {searchLoading && q.trim().length >= 2 ? (
          <p className="p-4 text-sm text-on-surface-variant">Ищем…</p>
        ) : (
          <ul ref={listRef} className="max-h-52 overflow-y-auto p-1" role="listbox">
            {suggestions.map((item, i) => {
              const isPrimary = primary?.code === item.code
              const isSecondary = secondary.some((s) => s.code === item.code)
              return (
                <li key={item.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      i === highlight ? 'bg-emerald-500/15' : 'hover:bg-emerald-500/8'
                    } ${isPrimary ? 'ring-1 ring-emerald-500/40' : ''}`}
                    onClick={() => pickFromList(item)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      addSecondary(item)
                    }}
                  >
                    <span className="shrink-0 font-mono text-xs text-on-surface-variant">{item.code}</span>
                    <span className="min-w-0 flex-1 text-on-surface">{item.name_ru}</span>
                    {isPrimary && (
                      <span className="shrink-0 rounded bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                        основной
                      </span>
                    )}
                    {isSecondary && !isPrimary && (
                      <span className="shrink-0 rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
                        доп.
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="label">Дополнительные ОКЭД</p>
        {secondary.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Необязательно. Добавьте через Shift+Enter или кнопки ниже.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {secondary.map((s) => (
              <span
                key={s.code}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-outline/50 bg-surface-container-low px-2 py-1 text-xs"
              >
                <span className="font-mono font-semibold">{s.code}</span>
                <span className="max-w-[8rem] truncate text-on-surface-variant sm:max-w-[12rem]">{s.name_ru}</span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                  aria-label={`Убрать ${s.code}`}
                  onClick={() => removeSecondary(s.code)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {popular.slice(0, 8).map((item) => {
            const disabled = primary?.code === item.code || secondary.some((s) => s.code === item.code)
            return (
              <button
                key={`pop-${item.code}`}
                type="button"
                disabled={disabled}
                className="rounded-lg border border-outline/40 px-2 py-1 text-xs disabled:opacity-40"
                onClick={() => addSecondary(item)}
                title={item.name_ru}
              >
                + {item.code}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
