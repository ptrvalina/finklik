import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, reportingCalmApi, taxApi, teamApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import MoneyAmount from '../../components/ui/MoneyAmount'
import AccountingNavTabs from '../../components/accounting/AccountingNavTabs'
import { ACCOUNTING_WORKFLOW } from './accountingNav'

function quarterBounds() {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const sm = q * 3
  return {
    start: new Date(now.getFullYear(), sm, 1).toISOString().slice(0, 10),
    end: new Date(now.getFullYear(), sm + 3, 0).toISOString().slice(0, 10),
  }
}

const TAX_MODE_LABEL: Record<string, string> = {
  usn_no_vat: 'УСН без НДС',
  usn_vat: 'УСН с НДС',
  osn: 'Общая система',
}

export default function AccountingHub() {
  const year = new Date().getFullYear()
  const range = { date_from: `${year}-01-01`, date_to: `${year}-12-31` }
  const quarter = quarterBounds()

  const { data: txData } = useQuery({
    queryKey: orgQueryKey(['accounting-hub-tx', year]),
    queryFn: () => dashboardApi.getTransactions({ ...range, limit: 500 }).then((r) => r.data as { items?: { status?: string }[] }),
    staleTime: 30_000,
  })

  const { data: calm } = useQuery({
    queryKey: orgQueryKey('reporting-calm-overview'),
    queryFn: () => reportingCalmApi.overview().then((r) => r.data),
    staleTime: 45_000,
  })

  const { data: tax } = useQuery({
    queryKey: orgQueryKey(['accounting-hub-tax', quarter.start, quarter.end]),
    queryFn: () => taxApi.calculate({ period_start: quarter.start, period_end: quarter.end, with_vat: false }).then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: profile } = useQuery({
    queryKey: orgQueryKey('business-profile'),
    queryFn: () => teamApi.getBusinessProfile().then((r) => r.data as { tax_regime?: string }),
    staleTime: 120_000,
  })

  const items = txData?.items ?? []
  const draftCount = items.filter((t) => t.status === 'draft').length
  const kudirCount = items.filter((t) => t.status !== 'draft').length
  const readiness = calm?.readiness?.score ?? null
  const blockers = calm?.readiness?.blockers?.length ?? 0
  const taxMode = profile?.tax_regime ? TAX_MODE_LABEL[profile.tax_regime] || profile.tax_regime : null

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-20 lg:pb-8">
      <AccountingNavTabs />

      <div className="mb-6">
        <h1 className="page-heading">Учёт</h1>
        <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
          Для ИП и малого бизнеса в Беларуси: сначала журнал операций, затем книга доходов и расходов (КУДиР), налоги и отчёты в
          ИМНС и ФСЗН.
          {taxMode ? (
            <>
              {' '}
              Режим: <span className="font-semibold text-on-surface">{taxMode}</span>.
            </>
          ) : null}
        </p>
      </div>

      <section className="mb-6 glass-card rounded-2xl p-4 sm:p-5" aria-label="Порядок работы">
        <h2 className="text-sm font-semibold text-on-surface">Как вести учёт</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ACCOUNTING_WORKFLOW.map((step) => (
            <li key={step.step}>
              <Link
                to={step.to}
                className="group flex h-full flex-col rounded-xl border border-outline/25 bg-surface-container-low/40 p-3 transition hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {step.step}
                  </span>
                  <span className="material-symbols-outlined text-lg text-primary">{step.icon}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface group-hover:text-primary">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{step.detail}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Требует внимания">
        <Link
          to="/accounting/journal?filter=drafts"
          className={`glass-card rounded-2xl p-4 transition hover:border-primary/40 ${draftCount > 0 ? 'border-amber-500/40' : ''}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Черновики в журнале</p>
          <p className="mt-1 font-headline text-2xl font-extrabold text-on-surface">{draftCount}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {draftCount > 0 ? 'Подтвердите «Провести», чтобы учесть в КУДиР' : 'Все операции проведены'}
          </p>
        </Link>

        <Link
          to="/reports"
          className={`glass-card rounded-2xl p-4 transition hover:border-primary/40 ${blockers > 0 ? 'border-amber-500/40' : ''}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Готовность отчётности</p>
          <p className="mt-1 font-headline text-2xl font-extrabold text-on-surface">
            {readiness != null ? `${readiness}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {blockers > 0
              ? `${blockers} ${blockers === 1 ? 'замечание' : blockers < 5 ? 'замечания' : 'замечаний'} — откройте отчёты`
              : 'Можно готовить пакет для органов'}
          </p>
        </Link>

        <Link to="/accounting/kudir" className="glass-card rounded-2xl p-4 transition hover:border-primary/40">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">КУДиР за {year}</p>
          <p className="mt-1 font-headline text-2xl font-extrabold text-on-surface">{kudirCount}</p>
          <p className="mt-1 text-xs text-on-surface-variant">проведённых операций в книге</p>
        </Link>

        <Link to="/accounting/taxes" className="glass-card rounded-2xl p-4 transition hover:border-primary/40">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">УСН за квартал</p>
          {tax?.usn_to_pay != null ? (
            <MoneyAmount value={tax.usn_to_pay} className="mt-1 font-headline text-2xl font-extrabold text-primary" />
          ) : (
            <p className="mt-1 font-headline text-2xl font-extrabold text-on-surface">—</p>
          )}
          <p className="mt-1 text-xs text-on-surface-variant">расчёт по данным журнала · сроки в календаре</p>
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Разделы учёта">
        <Link to="/accounting/journal" className="glass-card group rounded-2xl p-5 transition hover:border-primary/40">
          <span className="material-symbols-outlined text-3xl text-primary">receipt_long</span>
          <h2 className="mt-2 text-base font-semibold text-on-surface group-hover:text-primary">Журнал операций</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Банк, сканер и ручной ввод. Категории для УСН.</p>
        </Link>
        <Link to="/accounting/kudir" className="glass-card group rounded-2xl p-5 transition hover:border-primary/40">
          <span className="material-symbols-outlined text-3xl text-primary">menu_book</span>
          <h2 className="mt-2 text-base font-semibold text-on-surface group-hover:text-primary">КУДиР</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Книга доходов и расходов — разделы I и II, итоги по кварталам.</p>
        </Link>
        <Link to="/reports" className="glass-card group rounded-2xl p-5 transition hover:border-primary/40 sm:col-span-2 lg:col-span-1">
          <span className="material-symbols-outlined text-3xl text-primary">assignment_turned_in</span>
          <h2 className="mt-2 text-base font-semibold text-on-surface group-hover:text-primary">Отчёты в органы</h2>
          <p className="mt-1 text-sm text-on-surface-variant">ИМНС, ФСЗН, Белгосстрах — пошаговая подготовка и подача.</p>
        </Link>
      </section>

      <p className="mt-6 text-xs text-on-surface-variant">
        Сроки уплаты и сдачи — в{' '}
        <Link to="/calendar" className="font-semibold text-primary hover:underline">
          календаре
        </Link>
        , движение денег — в{' '}
        <Link to="/bank" className="font-semibold text-primary hover:underline">
          банке
        </Link>
        .
      </p>
    </div>
  )
}
