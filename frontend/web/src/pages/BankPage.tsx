import { useEffect, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { bankApi } from '../api/client'
import AppModal from '../components/ui/AppModal'
import { PremiumEmptyState, TableSkeleton } from '../components/premium'
import { FocusStrip } from '../components/shell/FocusStrip'
import { orgQueryKey } from '../lib/queryKeys'
import { calmError } from '../i18n/messages.ru'
import MoneyAmount from '../components/ui/MoneyAmount'
import { CurrencyFieldLabel } from '../components/ui/CurrencyFieldLabel'

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

type BankAccount = { id: string; bank_name: string; bank_bic: string; account_number: string; currency: string; is_primary: boolean; is_active: boolean; color: string }
type BankInfo = { name: string; bic: string; color: string }
type Tab = 'overview' | 'accounts' | 'reconciliation'

export default function BankPage() {
  const qc = useQueryClient()
  const bankYear = new Date().getFullYear()
  const [tab, setTab] = useState<Tab>('overview')
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [accountForm, setAccountForm] = useState({ bank_name: '', bank_bic: '', account_number: '', is_primary: false })
  const [paymentForm, setPaymentForm] = useState({ amount: '', recipient_name: '', description: '' })
  const todayStr = new Date().toISOString().slice(0, 10)
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [recDateFrom, setRecDateFrom] = useState(monthStartStr)
  const [recDateTo, setRecDateTo] = useState(todayStr)
  const [importJson, setImportJson] = useState(
    '[\n  {"transaction_date": "' +
      monthStartStr +
      '", "amount": 100.5, "direction": "credit", "description": "Поступление по выписке"}\n]'
  )
  const [oauthAccountId, setOauthAccountId] = useState('')
  const [oauthCode, setOauthCode] = useState('')
  const [oauthState, setOauthState] = useState('')

  const { data: balanceData } = useQuery({
    queryKey: orgQueryKey('bank-balance'),
    queryFn: () => bankApi.getBalance().then((r) => r.data),
    refetchInterval: 15000,
    placeholderData: (prev) => prev,
  })
  const { data: statementsData, isLoading: statementsLoading } = useQuery({
    queryKey: orgQueryKey('bank-statements'),
    queryFn: () => bankApi.getStatements(30).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
  const { data: accountsData } = useQuery({
    queryKey: orgQueryKey('bank-accounts'),
    queryFn: () => bankApi.listAccounts().then((r) => r.data),
    placeholderData: (prev) => prev,
  })
  const { data: banksData } = useQuery({
    queryKey: orgQueryKey('available-banks'),
    queryFn: () => bankApi.listBanks().then((r) => r.data),
    staleTime: 300_000,
  })
  const { data: recData, isLoading: recLoading, refetch: refetchRec } = useQuery({
    queryKey: orgQueryKey(['bank-reconciliation', recDateFrom, recDateTo]),
    queryFn: () => bankApi.reconciliation(recDateFrom, recDateTo).then((r) => r.data),
    enabled: tab === 'reconciliation',
  })

  const addAccountMutation = useMutation({
    mutationFn: () => bankApi.createAccount(accountForm),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-accounts') })
      setShowAddAccount(false)
      setAccountForm({ bank_name: '', bank_bic: '', account_number: '', is_primary: false })
      flash('success', 'Счёт добавлен')
    },
    onError: () => flash('error', calmError('bankAdd')),
  })
  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) => bankApi.updateAccount(id, { is_primary: true }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orgQueryKey('bank-accounts') }),
  })
  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => bankApi.deleteAccount(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-accounts') })
      flash('success', 'Счёт удалён')
    },
  })
  const paymentMutation = useMutation({
    mutationFn: () => bankApi.createPayment({ amount: parseFloat(paymentForm.amount), recipient_name: paymentForm.recipient_name, description: paymentForm.description }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-balance') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-statements') })
      setShowPayment(false)
      setPaymentForm({ amount: '', recipient_name: '', description: '' })
      flash('success', `Платёж: ${res.data.payment_id?.slice(0, 8)}…`)
    },
    onError: () => flash('error', calmError('bankPay')),
  })
  const importStatementMutation = useMutation({
    mutationFn: (lines: any[]) => bankApi.importStatement(lines),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-balance') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-statements') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-reconciliation') })
      void qc.invalidateQueries({ queryKey: orgQueryKey(['transactions', 'accounting']) })
      void qc.invalidateQueries({ queryKey: orgQueryKey('dashboard') })
      flash('success', `Импорт: создано ${res.data.created}, пропущено дублей ${res.data.skipped_duplicates}`)
    },
    onError: () => flash('error', calmError('bankImport')),
  })
  const oauthUrlMutation = useMutation({
    mutationFn: (accountId: string) => bankApi.oauthUrl(accountId),
    onSuccess: (res) => {
      const url = res.data?.oauth_url
      const accountId = res.data?.account_id
      if (accountId && typeof window !== 'undefined') {
        localStorage.setItem('bank_oauth_account_id', String(accountId))
      }
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      flash('success', 'Окно OAuth2 открыто. Callback обработается автоматически.')
    },
    onError: () => flash('error', calmError('bankOAuth')),
  })
  const oauthCallbackMutation = useMutation({
    mutationFn: (data: { account_id: string; code: string; state: string }) => bankApi.oauthCallback(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-accounts') })
      flash('success', 'Банк подключен через OAuth2')
    },
    onError: () => flash('error', calmError('bankOAuth')),
  })
  const oauthImportMutation = useMutation({
    mutationFn: (data: { account_id: string; date_from: string; date_to: string }) => bankApi.oauthImport(data),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-balance') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-statements') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-reconciliation') })
      void qc.invalidateQueries({ queryKey: orgQueryKey(['transactions', 'accounting']) })
      void qc.invalidateQueries({ queryKey: orgQueryKey('dashboard') })
      flash('success', `OAuth импорт завершён: ${res.data?.import_result?.created ?? 0} новых`)
    },
    onError: () => flash('error', calmError('bankOAuth')),
  })

  function flash(type: 'success' | 'error', text: string) { setMessage({ type, text }); setTimeout(() => setMessage(null), 4000) }
  function selectBank(bank: BankInfo) { setAccountForm((f) => ({ ...f, bank_name: bank.name, bank_bic: bank.bic })) }

  const accounts: BankAccount[] = accountsData?.accounts ?? []
  const banks: BankInfo[] = banksData?.banks ?? []
  const statements = statementsData?.transactions ?? []

  useEffect(() => {
    if (!accounts.length) return
    if (oauthAccountId) return
    if (typeof window === 'undefined') return
    const remembered = localStorage.getItem('bank_oauth_account_id')
    if (remembered && accounts.some((a) => a.id === remembered)) {
      setOauthAccountId(remembered)
    }
  }, [accounts, oauthAccountId])

  const tabItems: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', icon: 'monitoring', label: 'Обзор' },
    { key: 'accounts', icon: 'account_balance', label: 'Счета' },
    { key: 'reconciliation', icon: 'compare_arrows', label: 'Сверка' },
  ]

  return (
    <>
    <div className="fc-page-shell fc-page-shell-asymmetric pb-20 lg:pb-8">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-heading">Банк</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Баланс, выписка и сверка с журналом.</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">На счетах</p>
          <MoneyAmount value={balanceData?.balance} emptyAsZero className="mt-1 font-headline text-2xl font-extrabold text-primary" />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-primary text-sm w-full sm:w-auto" onClick={() => setShowPayment(true)}>
          <Icon name="send" className="text-lg" /> Новый платёж
        </button>
        {accounts.length > 0 ? (
          <button type="button" className="btn-secondary text-sm w-full sm:w-auto" onClick={() => setTab('reconciliation')}>
            <Icon name="upload_file" className="text-lg" /> Импорт выписки
          </button>
        ) : (
          <button type="button" className="btn-secondary text-sm w-full sm:w-auto" onClick={() => setShowAddAccount(true)}>
            <Icon name="add" className="text-lg" /> Добавить счёт
          </button>
        )}
      </div>

      {accounts.length === 0 && (
        <div className="mb-4">
          <FocusStrip
            headline="Подключите расчётный счёт"
            supporting="Добавьте счёт вручную или через OAuth — тогда заработают выписка и сверка с журналом."
            ctaLabel="Добавить счёт"
            onCta={() => setShowAddAccount(true)}
          />
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
        }`}>
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" />
          {message.text}
        </div>
      )}

      <div className="-mx-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max gap-1 rounded-xl bg-surface-container-high p-1 border border-outline/75 shadow-soft sm:inline-flex sm:min-w-0">
          {tabItems.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`tap-highlight-none flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all sm:px-4 sm:py-1.5 ${
                tab === t.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={t.icon} className="text-base" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="mt-3 space-y-4">
          {accounts.length > 0 && (
            <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="glass-card min-w-[220px] shrink-0 rounded-2xl border-l-4 p-4"
                  style={{ borderLeftColor: acc.color || '#2170e4' }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{acc.bank_name}</p>
                  <MoneyAmount
                    value={acc.is_primary ? balanceData?.balance : 0}
                    emptyAsZero
                    className="mt-2 font-headline text-lg font-bold text-on-surface"
                  />
                  <p className="mt-1 truncate font-mono text-[10px] text-on-surface-variant">{acc.account_number}</p>
                </div>
              ))}
            </div>
          )}

          {/* Statements */}
          <div className="glass-card overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-1 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6 dark:border-white/[0.06]">
              <h3 className="font-headline text-base font-bold text-on-surface sm:text-lg">Последние операции</h3>
              <span className="text-xs text-on-surface-variant">{statementsData?.total || 0} всего</span>
            </div>
            {statementsLoading ? (
              <TableSkeleton rows={6} cols={3} className="p-4 sm:p-6" />
            ) : statements.length === 0 ? (
              <div className="p-4 sm:p-6">
                <PremiumEmptyState
                  variant="compact"
                  icon="account_balance"
                  title="Движений по счёту пока нет"
                  description="Подключите счёт, импортируйте выписку JSON или синхронизируйте через OAuth — операции появятся здесь и в учёте."
                  actions={
                    <>
                      <button type="button" className="btn-secondary min-h-11 px-5 text-sm" onClick={() => setTab('accounts')}>
                        Счета и OAuth
                      </button>
                      <button type="button" className="btn-primary min-h-11 px-5 text-sm" onClick={() => setTab('reconciliation')}>
                        Импорт выписки
                      </button>
                      <Link to="/accounting/journal" className="btn-ghost min-h-11 px-4 text-sm">
                        Журнал
                      </Link>
                    </>
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/5">
                {statements.map((tx: any, i: number) => (
                  <div
                    key={tx.id || i}
                    className="flex cursor-pointer items-center justify-between gap-3 p-4 px-4 transition-colors hover:bg-surface-container-high sm:px-8"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center ${tx.type === 'credit' ? 'text-secondary' : 'text-error'} group-hover:scale-110 transition-transform`}>
                        <Icon name={tx.type === 'credit' ? 'arrow_downward' : 'arrow_upward'} filled />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{tx.description}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">{tx.counterparty} · {tx.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-extrabold font-headline ${tx.type === 'credit' ? 'text-secondary' : 'text-on-surface'}`}>
                        <MoneyAmount
                          value={tx.type === 'credit' ? tx.amount : -Number(tx.amount || 0)}
                          signed
                          className={`text-sm font-extrabold font-headline ${tx.type === 'credit' ? 'text-secondary' : 'text-on-surface'}`}
                        />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accounts */}
      {tab === 'accounts' && (
        <div className="space-y-4">
          {accounts.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center sm:p-16">
              <Icon name="account_balance" className="text-5xl text-on-surface-variant/20" />
              <p className="text-on-surface-variant text-sm mt-4">У вас ещё нет привязанных счетов</p>
              <button type="button" className="btn-primary mt-4" onClick={() => setShowAddAccount(true)}>
                <Icon name="add" /> Добавить первый счёт
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map(acc => (
                <div
                  key={acc.id}
                  className={`glass-card rounded-3xl border-l-4 p-5 transition-transform hover:-translate-y-1 sm:p-6 ${acc.is_active ? '' : 'opacity-60'}`}
                  style={{ borderLeftColor: acc.color }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-on-surface">{acc.bank_name}</h3>
                        {acc.is_primary && <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 font-bold">Основной</span>}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1 font-mono">{acc.account_number}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">BIC: {acc.bank_bic} · {acc.currency}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setOauthAccountId(acc.id); oauthUrlMutation.mutate(acc.id) }} className="btn-ghost !text-xs !px-2" title="OAuth2">
                        <Icon name="link" className="text-sm" />
                      </button>
                      {!acc.is_primary && (
                        <button type="button" onClick={() => setPrimaryMutation.mutate(acc.id)} className="btn-ghost !text-xs !px-2">
                          <Icon name="star" className="text-sm" />
                        </button>
                      )}
                      <button type="button" onClick={() => deleteAccountMutation.mutate(acc.id)} className="btn-ghost !text-xs !px-2 text-error hover:text-error">
                        <Icon name="delete" className="text-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 rounded-xl border border-outline/75 bg-surface p-4">
            <p className="mb-2 text-sm font-semibold">OAuth2 подключение банка</p>
            <p className="mb-2 text-[11px] text-on-surface-variant">
              После авторизации в банке вставьте `code` и `state` из callback URL и подтвердите привязку.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select className="input" value={oauthAccountId} onChange={(e) => setOauthAccountId(e.target.value)}>
                <option value="">Выберите счёт</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.bank_name} · {a.account_number}</option>
                ))}
              </select>
              <input className="input" placeholder="Код из ответа банка" value={oauthCode} onChange={(e) => setOauthCode(e.target.value)} />
              <input className="input" placeholder="Параметр state" value={oauthState} onChange={(e) => setOauthState(e.target.value)} />
              <button
                type="button"
                className="btn-primary"
                disabled={!oauthAccountId || !oauthCode || !oauthState || oauthCallbackMutation.isPending}
                onClick={() => oauthCallbackMutation.mutate({ account_id: oauthAccountId, code: oauthCode, state: oauthState })}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'reconciliation' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <h3 className="mb-1 font-headline text-base font-bold text-on-surface">Сверка учёт ↔ выписка</h3>
            <p className="mb-4 text-[11px] text-on-surface-variant">
              Обороты за период: весь учёт и отдельно операции с категорией <code className="text-teal-400">bank_import</code>.
            </p>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">С даты</label>
                <input type="date" className="input min-h-11 w-full" value={recDateFrom} onChange={(e) => setRecDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">По дату</label>
                <input type="date" className="input min-h-11 w-full" value={recDateTo} onChange={(e) => setRecDateTo(e.target.value)} />
              </div>
            </div>
            <button type="button" className="btn-secondary mb-4 min-h-11" onClick={() => refetchRec()} disabled={recLoading}>
              <Icon name="refresh" className="text-lg" />
              {recLoading ? 'Считаем…' : 'Пересчитать'}
            </button>
            {recData && (
              <div className="space-y-2 rounded-xl border border-outline/75 bg-surface-container-low p-4 font-mono text-xs text-on-surface">
                <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
                  Учёт: доход <MoneyAmount value={recData.book?.total_income} emptyAsZero className="inline-flex text-xs" symbolClassName="h-[0.7em] w-[0.6em]" /> · расход{' '}
                  <MoneyAmount value={recData.book?.total_expense} emptyAsZero className="inline-flex text-xs" symbolClassName="h-[0.7em] w-[0.6em]" /> · чистый{' '}
                  <MoneyAmount value={recData.book?.net} emptyAsZero className="inline-flex text-xs font-semibold text-on-surface" symbolClassName="h-[0.7em] w-[0.6em]" /> ({recData.book?.transactions_count} оп.)
                </p>
                <p className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
                  Импорт банка: доход <MoneyAmount value={recData.bank_import?.total_income} emptyAsZero className="inline-flex text-xs" symbolClassName="h-[0.7em] w-[0.6em]" /> · расход{' '}
                  <MoneyAmount value={recData.bank_import?.total_expense} emptyAsZero className="inline-flex text-xs" symbolClassName="h-[0.7em] w-[0.6em]" /> · чистый{' '}
                  <MoneyAmount value={recData.bank_import?.net} emptyAsZero className="inline-flex text-xs font-semibold text-on-surface" symbolClassName="h-[0.7em] w-[0.6em]" /> ({recData.bank_import?.lines_count} оп.)
                </p>
                <p className="flex flex-wrap items-baseline gap-x-1 font-medium text-amber-800">
                  Δ (учёт − импорт): <MoneyAmount value={recData.delta_net_book_minus_bank_import} signed emptyAsZero className="inline-flex text-xs" symbolClassName="h-[0.7em] w-[0.6em]" />
                </p>
              </div>
            )}
          </div>
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <h3 className="mb-1 font-headline text-base font-bold text-on-surface">Импорт выписки (JSON)</h3>
            <p className="mb-3 text-[11px] text-on-surface-variant">
              Массив строк: <code className="text-on-surface-variant">transaction_date</code>, <code className="text-on-surface-variant">amount</code>,{' '}
              <code className="text-on-surface-variant">direction</code> credit/debit, <code className="text-on-surface-variant">description</code>.
            </p>
            <textarea
              className="input mb-3 min-h-[180px] w-full resize-y font-mono text-xs"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary min-h-11 w-full"
              disabled={importStatementMutation.isPending}
              onClick={() => {
                try {
                  const raw = JSON.parse(importJson)
                  const lines = Array.isArray(raw) ? raw : raw.lines
                  if (!Array.isArray(lines)) throw new Error('need array or { lines }')
                  importStatementMutation.mutate(lines)
                } catch {
                  flash('error', 'Неверный JSON')
                }
              }}
            >
              {importStatementMutation.isPending ? 'Импорт…' : 'Импортировать в учёт'}
            </button>
            <div className="mt-4 border-t border-outline/75 pt-4">
              <p className="mb-2 text-sm font-semibold">Импорт из банка через OAuth2</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select className="input" value={oauthAccountId} onChange={(e) => setOauthAccountId(e.target.value)}>
                  <option value="">Выберите подключённый счёт</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.bank_name} · {a.account_number}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!oauthAccountId || oauthImportMutation.isPending}
                  onClick={() => oauthImportMutation.mutate({ account_id: oauthAccountId, date_from: recDateFrom, date_to: recDateTo })}
                >
                  {oauthImportMutation.isPending ? 'Импорт…' : 'OAuth → КУДиР'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

      {showAddAccount && (
        <AppModal
          title="Добавить счёт"
          wide
          onClose={() => setShowAddAccount(false)}
          footer={
            <div className="app-form-actions -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-3">
                <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setShowAddAccount(false)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-primary min-h-12 flex-1"
                  disabled={!accountForm.bank_bic || !accountForm.account_number || addAccountMutation.isPending}
                  onClick={() => addAccountMutation.mutate()}
                >
                  {addAccountMutation.isPending ? 'Сохраняем...' : 'Добавить'}
                </button>
              </div>
            </div>
          }
        >
          <p className="label mb-3">Выберите банк</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {banks.map((bank) => (
              <button
                key={bank.bic}
                type="button"
                onClick={() => selectBank(bank)}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  accountForm.bank_bic === bank.bic
                    ? 'border-primary bg-primary/10'
                    : 'border-outline-variant/20 hover:border-outline'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: bank.color }} />
                  <span className="text-xs font-medium text-on-surface">{bank.name}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Номер счёта (IBAN)</label>
              <input
                className="input min-h-11 rounded-xl font-mono"
                placeholder="BY20XXXX..."
                value={accountForm.account_number}
                onChange={(e) => setAccountForm((f) => ({ ...f, account_number: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={accountForm.is_primary}
                onChange={(e) => setAccountForm((f) => ({ ...f, is_primary: e.target.checked }))}
                className="rounded"
              />{' '}
              Основной
            </label>
          </div>
        </AppModal>
      )}

      {showPayment && (
        <AppModal
          title="Новый платёж"
          onClose={() => setShowPayment(false)}
          footer={
            <div className="app-form-actions -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-3">
                <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setShowPayment(false)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-primary min-h-12 flex-1"
                  disabled={!paymentForm.amount || !paymentForm.recipient_name || paymentMutation.isPending}
                  onClick={() => paymentMutation.mutate()}
                >
                  {paymentMutation.isPending ? 'Отправляем...' : 'Отправить'}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">Получатель</label>
              <input
                className="input min-h-11 rounded-xl"
                value={paymentForm.recipient_name}
                onChange={(e) => setPaymentForm((f) => ({ ...f, recipient_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label"><CurrencyFieldLabel /></label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="input min-h-11 rounded-xl"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Назначение</label>
              <input
                className="input min-h-11 rounded-xl"
                value={paymentForm.description}
                onChange={(e) => setPaymentForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
        </AppModal>
      )}
    </>
  )
}
