import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bankApi } from '../api/client'
import AppModal from '../components/ui/AppModal'
import { PremiumEmptyState, TableSkeleton } from '../components/premium'
import { orgQueryKey } from '../lib/queryKeys'
import { calmError } from '../i18n/messages.ru'
import { PARTNER_BANK } from '../lib/partnerBank'
import MoneyAmount from '../components/ui/MoneyAmount'
import { CurrencyFieldLabel } from '../components/ui/CurrencyFieldLabel'
import {
  GlassCard,
  HeroGradient,
  PageHeader,
  StatusChip,
  StitchIcon,
  StitchTable,
  StitchTableShell,
} from '../components/stitch'

type BankAccount = {
  id: string
  bank_name: string
  bank_bic: string
  account_number: string
  currency: string
  is_primary: boolean
  is_active: boolean
  color: string
}

type StatementRow = {
  id: string
  date: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  counterparty: string
}

type Tab = 'overview' | 'statement' | 'payments'

type PaymentForm = {
  amount: string
  recipient_name: string
  recipient_unp: string
  recipient_account: string
  description: string
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthStartStr = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

function downloadCsv(filename: string, rows: StatementRow[]) {
  const header = 'Дата;Контрагент;Назначение;Сумма;Тип'
  const body = rows
    .map((r) =>
      [r.date, r.counterparty, r.description, String(r.amount), r.type === 'credit' ? 'Поступление' : 'Списание']
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    )
    .join('\n')
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildPaymentOrderText(form: PaymentForm, account: BankAccount | undefined, paymentId?: string) {
  const lines = [
    'ПЛАТЁЖНОЕ ПОРУЧЕНИЕ',
    `Дата: ${todayStr()}`,
    paymentId ? `ID: ${paymentId}` : '',
    '',
    `Плательщик: расчётный счёт ${account?.account_number ?? '—'}`,
    `Банк плательщика: ${PARTNER_BANK.name}, BIC ${PARTNER_BANK.bic}`,
    '',
    `Получатель: ${form.recipient_name}`,
    form.recipient_unp ? `УНП получателя: ${form.recipient_unp}` : '',
    form.recipient_account ? `Счёт получателя: ${form.recipient_account}` : '',
    `Сумма: ${form.amount} BYN`,
    `Назначение: ${form.description}`,
  ].filter(Boolean)
  return lines.join('\n')
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BankPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [showConnect, setShowConnect] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [accountNumber, setAccountNumber] = useState('')
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    amount: '',
    recipient_name: '',
    recipient_unp: '',
    recipient_account: '',
    description: '',
  })
  const [lastPaymentOrder, setLastPaymentOrder] = useState<{ text: string; id: string } | null>(null)

  const [stmtDateFrom, setStmtDateFrom] = useState(monthStartStr())
  const [stmtDateTo, setStmtDateTo] = useState(todayStr())
  const [stmtCounterparty, setStmtCounterparty] = useState('')
  const [stmtPurpose, setStmtPurpose] = useState('')
  const [stmtApplied, setStmtApplied] = useState({
    dateFrom: monthStartStr(),
    dateTo: todayStr(),
    counterparty: '',
    purpose: '',
  })

  const { data: balanceData } = useQuery({
    queryKey: orgQueryKey('bank-balance'),
    queryFn: () => bankApi.getBalance().then((r) => r.data),
    refetchInterval: 15000,
    placeholderData: (prev) => prev,
  })

  const stmtLimit = tab === 'overview' ? 5 : 100

  const { data: statementsData, isLoading: statementsLoading, refetch: refetchStatements } = useQuery({
    queryKey: orgQueryKey([
      'bank-statements',
      stmtApplied.dateFrom,
      stmtApplied.dateTo,
      stmtApplied.counterparty,
      stmtApplied.purpose,
      stmtLimit,
    ]),
    queryFn: () =>
      bankApi
        .getStatements({
          limit: stmtLimit,
          date_from: stmtApplied.dateFrom,
          date_to: stmtApplied.dateTo,
          counterparty: stmtApplied.counterparty || undefined,
          purpose: stmtApplied.purpose || undefined,
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const { data: accountsData } = useQuery({
    queryKey: orgQueryKey('bank-accounts'),
    queryFn: () => bankApi.listAccounts().then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const addAccountMutation = useMutation({
    mutationFn: () =>
      bankApi.createAccount({
        bank_name: PARTNER_BANK.name,
        bank_bic: PARTNER_BANK.bic,
        account_number: accountNumber.trim(),
        is_primary: true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-accounts') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-balance') })
      setShowConnect(false)
      setAccountNumber('')
      flash('success', 'Счёт подключён')
    },
    onError: () => flash('error', calmError('bankAdd')),
  })

  const paymentMutation = useMutation({
    mutationFn: () =>
      bankApi.createPayment({
        amount: parseFloat(paymentForm.amount),
        recipient_name: paymentForm.recipient_name,
        description: paymentForm.description,
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-balance') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-statements') })
      const primary = accounts.find((a) => a.is_primary) ?? accounts[0]
      const text = buildPaymentOrderText(paymentForm, primary, res.data.payment_id)
      setLastPaymentOrder({ text, id: res.data.payment_id })
      setShowPayment(false)
      setPaymentForm({ amount: '', recipient_name: '', recipient_unp: '', recipient_account: '', description: '' })
      flash('success', 'Платёжное поручение сформировано')
      setTab('payments')
    },
    onError: () => flash('error', calmError('bankPay')),
  })

  const statementRequestMutation = useMutation({
    mutationFn: () => {
      const primary = accounts.find((a) => a.is_primary) ?? accounts[0]
      if (!primary) throw new Error('no account')
      return bankApi.oauthImport({
        account_id: primary.id,
        date_from: stmtApplied.dateFrom,
        date_to: stmtApplied.dateTo,
      })
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-balance') })
      void qc.invalidateQueries({ queryKey: orgQueryKey('bank-statements') })
      void qc.invalidateQueries({ queryKey: orgQueryKey(['transactions', 'accounting']) })
      void qc.invalidateQueries({ queryKey: orgQueryKey('dashboard') })
      flash('success', `Выписка загружена: ${res.data?.import_result?.created ?? 0} новых операций`)
      void refetchStatements()
    },
    onError: () => flash('error', calmError('bankImport')),
  })

  function flash(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  function applyStatementFilters() {
    setStmtApplied({
      dateFrom: stmtDateFrom,
      dateTo: stmtDateTo,
      counterparty: stmtCounterparty.trim(),
      purpose: stmtPurpose.trim(),
    })
  }

  const accounts: BankAccount[] = accountsData?.accounts ?? []
  const primaryAccount = accounts.find((a) => a.is_primary) ?? accounts[0]
  const statements: StatementRow[] = statementsData?.transactions ?? []

  const paymentRows = useMemo(() => statements.filter((tx) => tx.type === 'debit'), [statements])

  const tabItems: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', icon: 'account_balance', label: 'Счёт' },
    { key: 'statement', icon: 'receipt_long', label: 'Выписка' },
    { key: 'payments', icon: 'payments', label: 'Платежи' },
  ]

  function StatementFilters({ compact }: { compact?: boolean }) {
    return (
      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}`}>
        <div>
          <label className="label">С даты</label>
          <input type="date" className="input min-h-11 w-full" value={stmtDateFrom} onChange={(e) => setStmtDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">По дату</label>
          <input type="date" className="input min-h-11 w-full" value={stmtDateTo} onChange={(e) => setStmtDateTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Контрагент</label>
          <input
            className="input min-h-11 w-full"
            placeholder="Название или УНП"
            value={stmtCounterparty}
            onChange={(e) => setStmtCounterparty(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Назначение платежа</label>
          <input
            className="input min-h-11 w-full"
            placeholder="Текст в назначении"
            value={stmtPurpose}
            onChange={(e) => setStmtPurpose(e.target.value)}
          />
        </div>
      </div>
    )
  }

  function StatementTable({ rows, loading }: { rows: StatementRow[]; loading: boolean }) {
    if (loading) return <TableSkeleton rows={6} cols={4} className="p-4" />
    if (rows.length === 0) {
      return (
        <PremiumEmptyState
          variant="compact"
          icon="receipt_long"
          title="Операций не найдено"
          description="Измените фильтры или загрузите выписку из банка за нужный период."
          actions={
            primaryAccount ? (
              <button
                type="button"
                className="btn-primary min-h-11 px-5 text-sm"
                disabled={statementRequestMutation.isPending}
                onClick={() => statementRequestMutation.mutate()}
              >
                Загрузить из банка
              </button>
            ) : (
              <button type="button" className="btn-primary min-h-11 px-5 text-sm" onClick={() => setShowConnect(true)}>
                Подключить счёт
              </button>
            )
          }
        />
      )
    }
    return (
      <StitchTable>
        <thead>
          <tr>
            <th>Операция</th>
            <th>Контрагент</th>
            <th>Дата</th>
            <th className="text-right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => (
            <tr key={tx.id}>
              <td>
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      tx.type === 'credit' ? 'bg-tertiary-fixed/30 text-tertiary' : 'bg-error/10 text-error'
                    }`}
                  >
                    <StitchIcon name={tx.type === 'credit' ? 'arrow_downward' : 'arrow_upward'} filled className="text-xl" />
                  </div>
                  <span className="truncate text-sm font-semibold text-on-surface">{tx.description}</span>
                </div>
              </td>
              <td className="text-sm text-secondary">{tx.counterparty}</td>
              <td className="text-sm text-secondary">{tx.date}</td>
              <td className="text-right">
                <MoneyAmount
                  value={tx.type === 'credit' ? tx.amount : -tx.amount}
                  signed
                  className={`font-mono text-sm font-bold ${tx.type === 'credit' ? 'text-tertiary' : 'text-on-surface'}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </StitchTable>
    )
  }

  return (
    <>
      <div className="fc-page-shell fc-page-shell-asymmetric pb-20 lg:pb-8">
        <PageHeader
          title="Банк"
          subtitle="Счёт, выписка и платежи — движение денег на расчётном счёте. Проводки и отчётность — в журнале."
          badge={
            <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-low px-3 py-1">
              <span className="h-2 w-2 rounded-full" style={{ background: PARTNER_BANK.color }} />
              <span className="font-label text-label-caps uppercase text-secondary">{PARTNER_BANK.name}</span>
            </span>
          }
        />

        {message && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
              message.type === 'success'
                ? 'border-secondary/20 bg-secondary/10 text-secondary'
                : 'border-error/20 bg-error/10 text-error'
            }`}
          >
            <StitchIcon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" />
            {message.text}
          </div>
        )}

        <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0">
          <div className="flex min-w-max gap-1 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-1 sm:inline-flex">
            {tabItems.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all sm:px-4 ${
                  tab === t.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <StitchIcon name={t.icon} className="text-base" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'overview' && (
          <div className="mt-4 space-y-6">
            {!primaryAccount ? (
              <GlassCard className="border-2 border-dashed border-outline-variant/50 bg-transparent p-8 text-center">
                <StitchIcon name="account_balance" className="text-4xl text-primary" />
                <h2 className="mt-3 font-headline text-headline-sm text-on-surface">Подключите расчётный счёт</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
                  Укажите IBAN счёта в {PARTNER_BANK.name} — после этого доступны баланс, выписка и платежи.
                </p>
                <button type="button" className="btn-primary mt-4 text-sm" onClick={() => setShowConnect(true)}>
                  Подключить счёт
                </button>
              </GlassCard>
            ) : (
              <HeroGradient>
                <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-tertiary/20 blur-[100px]" />
                <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-label text-label-caps uppercase text-primary-fixed/80">Доступно на счёте</p>
                    <MoneyAmount
                      value={balanceData?.balance}
                      emptyAsZero
                      className="mt-2 font-headline text-display-lg font-bold text-on-primary"
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusChip variant="ready">Счёт подключён</StatusChip>
                      <span className="font-mono text-xs text-primary-fixed/70">{primaryAccount.account_number}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary text-sm" onClick={() => setShowPayment(true)}>
                      <StitchIcon name="edit_document" className="text-lg" /> Платёж
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={statementRequestMutation.isPending}
                      onClick={() => {
                        applyStatementFilters()
                        setTab('statement')
                        statementRequestMutation.mutate()
                      }}
                    >
                      <StitchIcon name="cloud_download" className="text-lg" /> Выписка
                    </button>
                  </div>
                </div>
              </HeroGradient>
            )}

            {primaryAccount && (
              <>
                <section>
                  <div className="mb-4 flex items-end justify-between">
                    <h2 className="font-headline text-headline-sm text-on-surface">Расчётные счета</h2>
                    <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => setShowConnect(true)}>
                      Управление
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {accounts.map((acc) => (
                      <GlassCard key={acc.id} className="p-5 sm:p-6">
                        <div className="mb-8 flex items-start justify-between">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/30 bg-surface-container text-primary"
                            style={{ borderLeftColor: acc.color || PARTNER_BANK.color }}
                          >
                            <StitchIcon name="account_balance" filled className="text-3xl" />
                          </div>
                          <StatusChip variant={acc.is_active ? 'ready' : 'neutral'}>
                            {acc.is_primary ? 'Основной' : acc.is_active ? 'Активен' : 'Неактивен'}
                          </StatusChip>
                        </div>
                        <p className="text-sm text-secondary">{acc.bank_name}</p>
                        {acc.id === primaryAccount.id ? (
                          <MoneyAmount
                            value={balanceData?.balance}
                            emptyAsZero
                            className="mt-1 font-headline text-headline-md text-on-surface"
                          />
                        ) : (
                          <p className="mt-1 font-headline text-headline-md text-on-surface">—</p>
                        )}
                        <p className="mt-3 truncate font-mono text-sm text-secondary">
                          {acc.account_number.replace(/(.{4})/g, '$1 ').trim()}
                        </p>
                      </GlassCard>
                    ))}
                    <button type="button" className="w-full text-left" onClick={() => setShowConnect(true)}>
                      <GlassCard hover className="border-2 border-dashed border-outline-variant/50 bg-transparent p-5 sm:p-6">
                        <div className="flex h-full flex-col items-center justify-center py-6 text-secondary">
                          <StitchIcon name="add_circle" className="mb-2 text-5xl text-secondary-fixed-dim" />
                          <p className="text-sm font-semibold text-on-surface-variant">Подключить счёт</p>
                          <p className="mt-1 text-xs text-on-surface-variant/70">IBAN в {PARTNER_BANK.name}</p>
                        </div>
                      </GlassCard>
                    </button>
                  </div>
                </section>

                <StitchTableShell
                  title="Последние операции"
                  toolbar={
                    <button type="button" className="btn-ghost !text-xs" onClick={() => setTab('statement')}>
                      Вся выписка
                    </button>
                  }
                >
                  <StatementTable rows={statements} loading={statementsLoading} />
                </StitchTableShell>
              </>
            )}
          </div>
        )}

        {tab === 'statement' && (
          <div className="mt-4 space-y-4">
            <GlassCard className="p-4 sm:p-6">
              <h2 className="font-headline text-headline-sm text-on-surface">Выписка по счёту</h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                Загрузите операции из банка, отфильтруйте и выгрузите CSV. Для проводок откройте журнал.
              </p>
              <div className="mt-4">
                <StatementFilters compact />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={applyStatementFilters}>
                  Показать
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={!primaryAccount || statementRequestMutation.isPending}
                  onClick={() => {
                    applyStatementFilters()
                    statementRequestMutation.mutate()
                  }}
                >
                  <StitchIcon name="cloud_download" className="text-lg" />
                  {statementRequestMutation.isPending ? 'Загрузка…' : 'Загрузить из банка'}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={statements.length === 0}
                  onClick={() => downloadCsv(`vypiska-${stmtApplied.dateFrom}_${stmtApplied.dateTo}.csv`, statements)}
                >
                  <StitchIcon name="download" className="text-lg" /> CSV
                </button>
                <Link to="/accounting/journal" className="btn-secondary text-sm">
                  <StitchIcon name="menu_book" className="text-lg" /> Журнал
                </Link>
              </div>
            </GlassCard>

            <StitchTableShell
              title="Операции"
              toolbar={<span className="text-xs text-on-surface-variant">{statementsData?.total ?? 0} записей</span>}
            >
              <StatementTable rows={statements} loading={statementsLoading} />
            </StitchTableShell>
          </div>
        )}

        {tab === 'payments' && (
          <div className="mt-4 space-y-4">
            <GlassCard className="p-4 sm:p-6">
              <h2 className="font-headline text-headline-sm text-on-surface">Платёжное поручение</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Сформируйте поручение, скачайте файл и проведите оплату в интернет-банке {PARTNER_BANK.name}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => setShowPayment(true)} disabled={!primaryAccount}>
                  <StitchIcon name="add" className="text-lg" /> Новое поручение
                </button>
                <Link to="/counterparties" className="btn-secondary text-sm">
                  <StitchIcon name="handshake" className="text-lg" /> Контрагенты
                </Link>
              </div>
              {lastPaymentOrder ? (
                <div className="mt-4 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
                  <p className="text-xs font-semibold text-on-surface">Последнее поручение</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-on-surface-variant">
                    {lastPaymentOrder.text}
                  </pre>
                  <button
                    type="button"
                    className="btn-secondary mt-3 text-xs"
                    onClick={() => downloadText(`platezhnoe-poruchenie-${lastPaymentOrder.id.slice(0, 8)}.txt`, lastPaymentOrder.text)}
                  >
                    Скачать .txt
                  </button>
                </div>
              ) : null}
            </GlassCard>

            <StitchTableShell
              title="Исходящие платежи"
              toolbar={<span className="text-xs text-on-surface-variant">Списания по выписке за выбранный период</span>}
            >
              <StatementTable rows={paymentRows} loading={statementsLoading} />
            </StitchTableShell>
          </div>
        )}
      </div>

      {showConnect && (
        <AppModal
          title={`Счёт ${PARTNER_BANK.name}`}
          onClose={() => setShowConnect(false)}
          footer={
            <div className="app-form-actions flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowConnect(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={accountNumber.trim().length < 10 || addAccountMutation.isPending}
                onClick={() => addAccountMutation.mutate()}
              >
                {addAccountMutation.isPending ? 'Подключаем…' : 'Подключить'}
              </button>
            </div>
          }
        >
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-outline/40 bg-surface-container-low p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${PARTNER_BANK.color}22` }}>
              <StitchIcon name="account_balance" className="text-xl text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">{PARTNER_BANK.name}</p>
              <p className="text-[11px] text-on-surface-variant">BIC {PARTNER_BANK.bic}</p>
            </div>
          </div>
          <label className="label">Номер расчётного счёта (IBAN)</label>
          <input
            className="input min-h-11 font-mono"
            placeholder="BY__ ____ ____ ____ ____ ____"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
          />
        </AppModal>
      )}

      {showPayment && (
        <AppModal
          title="Платёжное поручение"
          wide
          onClose={() => setShowPayment(false)}
          footer={
            <div className="app-form-actions flex gap-3">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowPayment(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={
                  !paymentForm.amount ||
                  !paymentForm.recipient_name ||
                  !paymentForm.description ||
                  paymentMutation.isPending
                }
                onClick={() => paymentMutation.mutate()}
              >
                {paymentMutation.isPending ? 'Формируем…' : 'Сформировать'}
              </button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Получатель</label>
              <input
                className="input min-h-11"
                placeholder="Наименование организации или ФИО"
                value={paymentForm.recipient_name}
                onChange={(e) => setPaymentForm((f) => ({ ...f, recipient_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">УНП получателя</label>
              <input
                className="input min-h-11 font-mono"
                placeholder="9 цифр"
                value={paymentForm.recipient_unp}
                onChange={(e) => setPaymentForm((f) => ({ ...f, recipient_unp: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
              />
            </div>
            <div>
              <label className="label">Счёт получателя</label>
              <input
                className="input min-h-11 font-mono"
                placeholder="IBAN"
                value={paymentForm.recipient_account}
                onChange={(e) => setPaymentForm((f) => ({ ...f, recipient_account: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <label className="label">
                <CurrencyFieldLabel />
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="input min-h-11"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Назначение платежа</label>
              <input
                className="input min-h-11"
                placeholder="Оплата по договору №…"
                value={paymentForm.description}
                onChange={(e) => setPaymentForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          {primaryAccount ? (
            <p className="mt-3 text-[11px] text-on-surface-variant">
              Списание с счёта {primaryAccount.account_number} · {PARTNER_BANK.name}
            </p>
          ) : null}
        </AppModal>
      )}
    </>
  )
}
