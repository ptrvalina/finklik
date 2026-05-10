import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { counterpartiesApi } from '../api/client'
import AppModal from '../components/ui/AppModal'
import { DataTableShell, useDataTableSelection } from '../components/datatable'
import { PremiumEmptyState, TableSkeleton } from '../components/premium'
import { Link } from 'react-router-dom'
import { formatApiDetail } from '../utils/apiError'

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

const CP_KIND_LABEL: Record<string, string> = {
  supplier: 'Поставщик',
  customer: 'Клиент',
  both: 'Поставщик / клиент',
}

type CpKind = 'both' | 'supplier' | 'customer'

function normalizeCpKind(v: string | undefined | null): CpKind {
  if (v === 'supplier' || v === 'customer' || v === 'both') return v
  return 'both'
}

type CpRow = {
  id: string
  name: string
  unp: string
  address?: string | null
  phone?: string | null
  email?: string | null
  bank_account?: string | null
  bank_name?: string | null
  notes?: string | null
  cp_kind?: string
  is_pinned?: boolean
  balance_net?: string
  last_transaction_date?: string | null
  last_transaction_amount?: string | null
  week_tx_count?: number
}

export default function CounterpartiesPage() {
  const qc = useQueryClient()
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showQuickUnp, setShowQuickUnp] = useState(false)
  const [quickUnp, setQuickUnp] = useState('')
  const [quickName, setQuickName] = useState('')
  const [reconCp, setReconCp] = useState<CpRow | null>(null)
  const [reconFrom, setReconFrom] = useState('')
  const [reconTo, setReconTo] = useState('')
  const [editing, setEditing] = useState<CpRow | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const emptyForm: {
    name: string
    unp: string
    address: string
    phone: string
    email: string
    bank_account: string
    bank_name: string
    notes: string
    cp_kind: CpKind
  } = {
    name: '',
    unp: '',
    address: '',
    phone: '',
    email: '',
    bank_account: '',
    bank_name: '',
    notes: '',
    cp_kind: 'both',
  }
  const [form, setForm] = useState(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ['counterparties', search],
    queryFn: () =>
      counterpartiesApi.list({ q: search || undefined, include_stats: true }).then((r) => r.data as CpRow[]),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const saveMutation = useMutation({
    mutationFn: () =>
      editing ? counterpartiesApi.update(editing.id, form) : counterpartiesApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] })
      closeModal()
      setMessage({ type: 'success', text: editing ? 'Обновлён' : 'Добавлен' })
    },
    onError: (e: any) =>
      setMessage({ type: 'error', text: formatApiDetail(e?.response?.data?.detail) || 'Ошибка' }),
  })

  const quickUnpMutation = useMutation({
    mutationFn: () =>
      counterpartiesApi.quickUnp({
        unp: quickUnp.replace(/\D/g, '').slice(0, 9),
        name: quickName.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] })
      setShowQuickUnp(false)
      setQuickUnp('')
      setQuickName('')
      setMessage({ type: 'success', text: 'Контрагент добавлен по УНП' })
    },
    onError: (e: any) =>
      setMessage({ type: 'error', text: formatApiDetail(e?.response?.data?.detail) || 'Ошибка' }),
  })

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      counterpartiesApi.update(id, { is_pinned: pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['counterparties'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => counterpartiesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] })
      setMessage({ type: 'success', text: 'Удалён' })
    },
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }
  function openEdit(cp: CpRow) {
    setEditing(cp)
    setForm({
      name: cp.name,
      unp: cp.unp,
      address: cp.address || '',
      phone: cp.phone || '',
      email: cp.email || '',
      bank_account: cp.bank_account || '',
      bank_name: cp.bank_name || '',
      notes: cp.notes || '',
      cp_kind: normalizeCpKind(cp.cp_kind),
    })
    setShowModal(true)
  }
  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm({ ...emptyForm })
  }

  const items = data ?? []
  const visibleIds = useMemo(() => items.map((i) => i.id), [items])
  const selection = useDataTableSelection(visibleIds)

  function copySelectedUnps() {
    const lines = items.filter((i) => selection.selected.has(i.id)).map((i) => i.unp)
    if (lines.length === 0) return
    void navigator.clipboard.writeText(lines.join('\n'))
    setMessage({ type: 'success', text: `Скопировано УНП: ${lines.length}` })
  }

  const frequent = useMemo(() => {
    const hot = items.filter((c) => (c.week_tx_count || 0) > 0)
    hot.sort((a, b) => (b.week_tx_count || 0) - (a.week_tx_count || 0))
    return hot.slice(0, 5)
  }, [items])

  function openRecon(cp: CpRow) {
    const t = new Date()
    const start = new Date(t.getFullYear(), t.getMonth(), 1)
    setReconFrom(start.toISOString().slice(0, 10))
    setReconTo(t.toISOString().slice(0, 10))
    setReconCp(cp)
  }

  async function downloadReconciliation() {
    if (!reconCp || !reconFrom || !reconTo) return
    try {
      const res = await counterpartiesApi.reconciliationCsv(reconCp.id, {
        date_from: reconFrom,
        date_to: reconTo,
      })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `akt-sverki-${reconCp.unp}-${reconFrom}_${reconTo}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setReconCp(null)
    } catch (e: any) {
      setMessage({ type: 'error', text: formatApiDetail(e) || 'Не удалось скачать' })
    }
  }

  function RowActions({ cp }: { cp: CpRow }) {
    const qIncome = new URLSearchParams({
      counterparty_id: cp.id,
      counterparty_name: cp.name,
      preset: 'income',
    }).toString()
    const qExpense = new URLSearchParams({
      counterparty_id: cp.id,
      counterparty_name: cp.name,
      preset: 'expense',
    }).toString()
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Link to={`/accounting?${qIncome}`} className="btn-ghost !px-2 !py-1 !text-[10px]" title="Доход">
          Доход
        </Link>
        <Link to={`/accounting?${qExpense}`} className="btn-ghost !px-2 !py-1 !text-[10px]" title="Расход">
          Расход
        </Link>
        <Link
          to={`/accounting?${new URLSearchParams({ counterparty_id: cp.id, counterparty_name: cp.name }).toString()}`}
          className="btn-ghost !px-2 !py-1 !text-[10px]"
        >
          Учёт
        </Link>
        <button type="button" className="btn-ghost !px-2 !py-1 !text-[10px]" onClick={() => openRecon(cp)}>
          Акт сверки
        </button>
        <button
          type="button"
          className="btn-ghost !px-2 !py-1 !text-[10px]"
          onClick={() => pinMutation.mutate({ id: cp.id, pinned: !cp.is_pinned })}
        >
          {cp.is_pinned ? 'Открепить' : 'Закрепить'}
        </button>
        <button type="button" className="btn-ghost !px-2 !py-1 !text-[10px]" onClick={() => openEdit(cp)}>
          Карточка
        </button>
        <button
          type="button"
          className="btn-ghost !px-2 !py-1 !text-[10px] text-error"
          onClick={() => {
            if (confirm('Удалить контрагента из справочника?')) removeMutation.mutate(cp.id)
          }}
        >
          Удалить
        </button>
      </div>
    )
  }

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric">
      <div className="fc-hero flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="fc-hero-strip" aria-hidden />
        <div className="relative z-[1] flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-heading">Контрагенты</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Добавление по УНП (до интеграции ЕГР — название уточняйте вручную), поиск <kbd className="rounded border px-1">/</kbd>
              , операции из списка.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link to="/accounting" className="btn-secondary w-full sm:w-auto">
              <Icon name="description" className="text-lg" /> Учёт
            </Link>
            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setShowQuickUnp(true)}>
              <Icon name="bolt" className="text-lg" /> По УНП
            </button>
            <button type="button" className="btn-primary w-full sm:w-auto" onClick={openCreate}>
              <Icon name="add" className="text-lg" /> Вручную
            </button>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-r from-[#004d40]/15 via-emerald-500/10 to-cyan-500/10 p-6 shadow-float backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <svg className="h-full w-full" viewBox="0 0 520 140" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="cp-flow" x1="0" x2="1">
                <stop stopColor="#34d399" stopOpacity="0.9" />
                <stop offset="1" stopColor="#22d3ee" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            <path
              d="M24 88 C120 24 200 120 280 64 S420 24 496 72"
              fill="none"
              stroke="url(#cp-flow)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="96" cy="56" r="5" fill="#10b981" opacity="0.9" />
            <circle cx="280" cy="64" r="5" fill="#2dd4bf" opacity="0.85" />
            <circle cx="420" cy="48" r="5" fill="#22d3ee" opacity="0.85" />
          </svg>
        </div>
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">Relationship layer</p>
            <p className="mt-1 font-headline text-lg font-bold text-on-surface">Сеть контрагентов</p>
            <p className="text-sm text-on-surface-variant">Визуальный слой доверия: активные связи и оборот за период.</p>
          </div>
          <div className="flex gap-2">
            {['high', 'mid', 'new'].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface backdrop-blur-md dark:bg-black/20"
              >
                {t === 'high' ? 'Топ' : t === 'mid' ? 'Стабильно' : 'Новые'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
            message.type === 'success'
              ? 'border-secondary/20 bg-secondary/10 text-secondary'
              : 'border-error/20 bg-error/10 text-error'
          }`}
        >
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" /> {message.text}
        </div>
      )}

      {frequent.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Часто за последнюю неделю</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {frequent.map((cp) => (
              <div
                key={cp.id}
                className="flex min-w-[200px] flex-1 flex-col rounded-xl border border-outline/60 bg-surface-container-low p-3"
              >
                <p className="text-sm font-bold text-on-surface">{cp.name}</p>
                <p className="font-mono text-[10px] text-on-surface-variant">УНП {cp.unp}</p>
                <RowActions cp={cp} />
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTableShell
        toolbar={
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1">
              <label className="label">Поиск по названию или УНП</label>
              <div className="relative mt-1">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" />
                <input
                  ref={searchRef}
                  className="input min-h-11 rounded-xl pl-10"
                  placeholder="Начните вводить название или УНП..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-describedby="cp-search-hint"
                />
              </div>
              <p id="cp-search-hint" className="mt-1.5 text-[10px] text-on-surface-variant">
                Горячая клавиша <kbd className="rounded border border-outline/60 px-1">/</kbd> · Escape снимает выбор строк
              </p>
            </div>
          </div>
        }
        bulkBar={
          <>
            <span className="text-xs font-semibold text-emerald-100">
              Выбрано: {selection.selectedCount}
            </span>
            <button type="button" className="btn-ghost min-h-9 px-3 text-xs" onClick={() => selection.clear()}>
              Снять выбор
            </button>
            <button type="button" className="btn-secondary min-h-9 px-4 text-xs" onClick={() => copySelectedUnps()}>
              Копировать УНП
            </button>
          </>
        }
        selectedCount={selection.selectedCount}
      >
        {isLoading ? (
          <TableSkeleton rows={10} cols={5} />
        ) : items.length === 0 ? (
          <div className="p-4 sm:p-8">
            <PremiumEmptyState
              variant="compact"
              icon="handshake"
              title={search ? 'Ничего не найдено' : 'Контрагентов пока нет'}
              description={
                search
                  ? 'Измените запрос или сбросьте фильтр — данные подтягиваются из справочника.'
                  : 'Добавьте контрагента вручную, по УНП или из операций учёта.'
              }
              actions={
                !search ? (
                  <>
                    <button type="button" className="btn-primary min-h-11 px-5 text-sm" onClick={openCreate}>
                      Добавить вручную
                    </button>
                    <button type="button" className="btn-secondary min-h-11 px-5 text-sm" onClick={() => setShowQuickUnp(true)}>
                      По УНП
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn-secondary min-h-11 px-5 text-sm" onClick={() => setSearch('')}>
                    Очистить поиск
                  </button>
                )
              }
            />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-white/[0.05] md:hidden">
              {items.map((cp) => (
                <li key={cp.id} className="p-4">
                  <div className="flex gap-3">
                    <input
                      type="checkbox"
                      className="tap-highlight-none mt-2 h-5 w-5 rounded border-outline/60 accent-primary"
                      checked={selection.isSelected(cp.id)}
                      onChange={() => selection.toggle(cp.id)}
                      aria-label={`Выбрать ${cp.name}`}
                    />
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-outline/75 bg-surface-container-high">
                      <Icon name="corporate_fare" className="text-xl text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-headline text-sm font-bold text-on-surface">
                        {cp.is_pinned ? <Icon name="push_pin" className="mr-1 align-middle text-xs text-amber-600" /> : null}
                        {cp.name}
                      </p>
                      <p className="font-mono text-xs text-on-surface-variant">
                        УНП {cp.unp} · {CP_KIND_LABEL[cp.cp_kind || 'both'] || cp.cp_kind}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Сальдо: {cp.balance_net ?? '0'} · Последняя оп.:{' '}
                        {cp.last_transaction_date || '—'}{' '}
                        {cp.last_transaction_amount != null ? `(${cp.last_transaction_amount})` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                        {cp.phone && (
                          <a href={`tel:${cp.phone}`} className="text-primary underline">
                            {cp.phone}
                          </a>
                        )}
                        {cp.email && (
                          <a href={`mailto:${cp.email}`} className="text-primary underline">
                            почта
                          </a>
                        )}
                      </div>
                      <div className="mt-3">
                        <RowActions cp={cp} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="fc-premium-table fc-premium-table-scroll fc-premium-table--sticky hidden max-h-[min(72vh,620px)] overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="table-head-row">
                    <th className="w-12 px-3 py-3 sm:px-4 sm:py-4">
                      <input
                        type="checkbox"
                        className="tap-highlight-none h-4 w-4 rounded border-outline/60 accent-primary"
                        checked={selection.allVisibleSelected}
                        onChange={() => selection.toggleAllVisible()}
                        aria-label="Выбрать все на странице"
                      />
                    </th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4">Название / тип</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4">УНП</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4">Сальдо</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4">Последняя операция</th>
                    <th className="px-4 py-3 text-right sm:px-6 sm:py-4">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((cp) => (
                    <tr key={cp.id} className="group">
                      <td className="px-3 py-3 sm:px-4 sm:py-4">
                        <input
                          type="checkbox"
                          className="tap-highlight-none h-4 w-4 rounded border-outline/60 accent-primary"
                          checked={selection.isSelected(cp.id)}
                          onChange={() => selection.toggle(cp.id)}
                          aria-label={`Выбрать ${cp.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <p className="text-sm font-bold text-on-surface">
                          {cp.is_pinned ? <Icon name="push_pin" className="mr-1 align-middle text-xs text-amber-600" /> : null}
                          {cp.name}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">{CP_KIND_LABEL[cp.cp_kind || 'both']}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-on-surface-variant sm:px-6 sm:py-4">{cp.unp}</td>
                      <td className="px-4 py-3 text-sm sm:px-6 sm:py-4">{cp.balance_net ?? '0'}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant sm:px-6 sm:py-4">
                        {cp.last_transaction_date || '—'}
                        {cp.last_transaction_amount != null ? ` · ${cp.last_transaction_amount}` : ''}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <div className="flex justify-end">
                          <RowActions cp={cp} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DataTableShell>

      {showQuickUnp && (
        <AppModal
          title="Добавить по УНП"
          onClose={() => setShowQuickUnp(false)}
          footer={
            <div className="app-form-actions flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowQuickUnp(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={quickUnp.replace(/\D/g, '').length !== 9 || quickUnpMutation.isPending}
                onClick={() => quickUnpMutation.mutate()}
              >
                {quickUnpMutation.isPending ? '…' : 'Создать'}
              </button>
            </div>
          }
        >
          <p className="mb-3 text-xs text-on-surface-variant">
            Интеграция с ЕГР подключается отдельно. Сейчас можно задать название вручную или оставить шаблон и отредактировать позже.
          </p>
          <label className="label">УНП (9 цифр)</label>
          <input
            className="input mb-3 font-mono"
            value={quickUnp}
            onChange={(e) => setQuickUnp(e.target.value.replace(/\D/g, '').slice(0, 9))}
          />
          <label className="label">Название (необязательно)</label>
          <input className="input" value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="Как в договоре" />
        </AppModal>
      )}

      {reconCp && (
        <AppModal
          title={`Акт сверки — ${reconCp.name}`}
          onClose={() => setReconCp(null)}
          footer={
            <div className="app-form-actions flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setReconCp(null)}>
                Отмена
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => downloadReconciliation()}>
                Скачать CSV
              </button>
            </div>
          }
        >
          <p className="mb-3 text-xs text-on-surface-variant">PDF по корпоративному шаблону можно добавить позже.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">
              С даты
              <input type="date" className="input mt-1" value={reconFrom} onChange={(e) => setReconFrom(e.target.value)} />
            </label>
            <label className="label">
              По дату
              <input type="date" className="input mt-1" value={reconTo} onChange={(e) => setReconTo(e.target.value)} />
            </label>
          </div>
        </AppModal>
      )}

      {showModal && (
        <AppModal
          title={editing ? 'Редактировать контрагента' : 'Новый контрагент'}
          onClose={closeModal}
          wide
          footer={
            <div className="app-form-actions -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-3">
                <button type="button" className="btn-secondary min-h-12 flex-1" onClick={closeModal}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-primary min-h-12 flex-1"
                  disabled={!form.name || form.unp.length !== 9 || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">Название *</label>
              <input
                className="input min-h-11 rounded-xl"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">УНП (9 цифр) * — для физлиц и иностранцев можно условный номер</label>
              <input
                className="input min-h-11 rounded-xl font-mono"
                maxLength={9}
                value={form.unp}
                onChange={(e) => setForm({ ...form, unp: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="label">Роль</label>
              <select
                className="input min-h-11 rounded-xl"
                value={form.cp_kind}
                onChange={(e) => setForm({ ...form, cp_kind: normalizeCpKind(e.target.value) })}
              >
                <option value="both">Поставщик и клиент</option>
                <option value="supplier">Поставщик</option>
                <option value="customer">Клиент</option>
              </select>
            </div>
            <div>
              <label className="label">Адрес</label>
              <input
                className="input min-h-11 rounded-xl"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Телефон</label>
                <input
                  className="input min-h-11 rounded-xl"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input min-h-11 rounded-xl"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Счёт</label>
                <input
                  className="input min-h-11 rounded-xl font-mono"
                  value={form.bank_account}
                  onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Банк</label>
                <input
                  className="input min-h-11 rounded-xl"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Заметка</label>
              <textarea
                className="input min-h-[80px] rounded-xl"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}
