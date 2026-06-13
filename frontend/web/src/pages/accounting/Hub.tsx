import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi, reportingCalmApi, taxApi, teamApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'
import MoneyAmount from '../../components/ui/MoneyAmount'
import AccountingNavTabs from '../../components/accounting/AccountingNavTabs'
import { ACCOUNTING_WORKFLOW } from './accountingNav'
import {
  BentoGrid,
  GlassCard,
  HeroGradient,
  PageHeader,
  StatCard,
  StatusChip,
  StitchIcon,
} from '../../components/stitch'

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
  const readyForReports = readiness != null && readiness >= 80 && blockers === 0

  return (
    <div className="fc-page-shell pb-20 lg:pb-8">
      <AccountingNavTabs />

      <PageHeader
        title="Учёт"
        subtitle={
          <>
            Для ИП и малого бизнеса в Беларуси: сначала журнал операций, затем книга доходов и расходов (КУДиР), налоги и отчёты в
            ИМНС и ФСЗН.
            {taxMode ? (
              <>
                {' '}
                Режим: <span className="font-semibold text-on-surface">{taxMode}</span>.
              </>
            ) : null}
          </>
        }
        badge={
          readyForReports ? (
            <StatusChip variant="ready">
              <StitchIcon name="verified" filled className="mr-1 text-sm" />
              Готово
            </StatusChip>
          ) : draftCount > 0 || blockers > 0 ? (
            <StatusChip variant="pending">Требует внимания</StatusChip>
          ) : null
        }
        actions={
          <>
            <Link
              to="/accounting/kudir"
              className="inline-flex min-h-touch-min items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest"
            >
              <StitchIcon name="ios_share" className="text-lg" />
              Экспорт КУДиР
            </Link>
            <Link to="/accounting/journal?focus=capture" className="btn-primary inline-flex min-h-touch-min items-center gap-2 rounded-full px-6 py-2 text-sm">
              <StitchIcon name="add" className="text-lg" />
              Новая операция
            </Link>
          </>
        }
      />

      <HeroGradient className="relative mb-section-sm overflow-hidden shadow-xl">
        <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <p className="font-label text-label-caps uppercase tracking-widest text-white/70">УСН за квартал</p>
            <h2 className="font-display-lg text-display-lg text-white">
              {tax?.usn_to_pay != null ? <MoneyAmount value={tax.usn_to_pay} className="text-inherit" /> : '—'}
            </h2>
            <div className="flex items-center gap-2 text-tertiary-fixed">
              <StitchIcon name="calculate" className="text-sm" />
              <span className="text-xs font-medium">расчёт по журналу</span>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-label text-label-caps uppercase tracking-widest text-white/70">КУДиР за {year}</p>
            <h2 className="font-display-lg text-display-lg text-white">{kudirCount}</h2>
            <p className="text-xs font-medium text-white/70">проведённых операций в книге</p>
          </div>
          <div className="space-y-2">
            <p className="font-label text-label-caps uppercase tracking-widest text-white/70">Готовность отчётности</p>
            <h2 className="font-display-lg text-display-lg text-white">{readiness != null ? `${readiness}%` : '—'}</h2>
            <div className="flex items-center gap-2 text-tertiary-fixed">
              <StitchIcon name={blockers > 0 ? 'warning' : 'check_circle'} className="text-sm" />
              <span className="text-xs font-medium">
                {blockers > 0 ? `${blockers} замечаний — откройте отчёты` : 'можно готовить пакет для органов'}
              </span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-0 opacity-20">
          <svg fill="none" height="100" viewBox="0 0 400 100" width="400" aria-hidden>
            <path d="M0 80C50 70 80 20 120 40C160 60 200 10 250 30C300 50 350 20 400 50" fill="none" stroke="white" strokeLinecap="round" strokeWidth="4" />
          </svg>
        </div>
      </HeroGradient>

      <GlassCard hover={false} className="mb-section-sm p-4 sm:p-5" aria-label="Порядок работы">
        <h2 className="font-headline text-headline-sm text-on-surface">Как вести учёт</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ACCOUNTING_WORKFLOW.map((step) => (
            <li key={step.step}>
              <Link
                to={step.to}
                className="group flex h-full flex-col rounded-xl border border-outline-variant/30 bg-surface-container-low/40 p-3 transition hover:border-primary/40"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {step.step}
                  </span>
                  <StitchIcon name={step.icon} className="text-lg text-primary" />
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface group-hover:text-primary">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{step.detail}</p>
              </Link>
            </li>
          ))}
        </ol>
      </GlassCard>

      <section className="mb-section-sm grid gap-gutter sm:grid-cols-2 xl:grid-cols-4" aria-label="Требует внимания">
        <Link to="/accounting/journal?filter=drafts" className="block">
          <StatCard
            icon="edit_note"
            iconTint={draftCount > 0 ? 'error' : 'primary'}
            label="Черновики в журнале"
            value={draftCount}
            hint={draftCount > 0 ? 'Подтвердите «Провести», чтобы учесть в КУДиР' : 'Все операции проведены'}
            className={draftCount > 0 ? 'border-amber-500/40' : ''}
          />
        </Link>
        <Link to="/reports" className="block">
          <StatCard
            icon="assignment_turned_in"
            iconTint={blockers > 0 ? 'error' : 'tertiary'}
            label="Готовность отчётности"
            value={readiness != null ? `${readiness}%` : '—'}
            hint={
              blockers > 0
                ? `${blockers} ${blockers === 1 ? 'замечание' : blockers < 5 ? 'замечания' : 'замечаний'} — откройте отчёты`
                : 'Можно готовить пакет для органов'
            }
            className={blockers > 0 ? 'border-amber-500/40' : ''}
          />
        </Link>
        <Link to="/accounting/kudir" className="block">
          <StatCard icon="menu_book" label={`КУДиР за ${year}`} value={kudirCount} hint="проведённых операций в книге" />
        </Link>
        <Link to="/accounting/taxes" className="block">
          <StatCard
            icon="payments"
            label="УСН за квартал"
            value={tax?.usn_to_pay != null ? <MoneyAmount value={tax.usn_to_pay} className="text-inherit" /> : '—'}
            hint="расчёт по данным журнала · сроки в календаре"
          />
        </Link>
      </section>

      <BentoGrid className="pb-4" aria-label="Разделы учёта">
        <Link to="/accounting/journal" className="group col-span-12 sm:col-span-6 lg:col-span-4">
          <GlassCard className="h-full p-5">
            <StitchIcon name="receipt_long" className="text-3xl text-primary" />
            <h2 className="mt-2 text-base font-semibold text-on-surface group-hover:text-primary">Журнал операций</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Банк, сканер и ручной ввод. Категории для УСН.</p>
          </GlassCard>
        </Link>
        <Link to="/accounting/kudir" className="group col-span-12 sm:col-span-6 lg:col-span-4">
          <GlassCard className="h-full p-5">
            <StitchIcon name="menu_book" className="text-3xl text-primary" />
            <h2 className="mt-2 text-base font-semibold text-on-surface group-hover:text-primary">КУДиР</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Книга доходов и расходов — разделы I и II, итоги по кварталам.</p>
          </GlassCard>
        </Link>
        <Link to="/reports" className="group col-span-12 sm:col-span-12 lg:col-span-4">
          <GlassCard className="h-full p-5">
            <StitchIcon name="assignment_turned_in" className="text-3xl text-primary" />
            <h2 className="mt-2 text-base font-semibold text-on-surface group-hover:text-primary">Отчёты в органы</h2>
            <p className="mt-1 text-sm text-on-surface-variant">ИМНС, ФСЗН, Белгосстрах — пошаговая подготовка и подача.</p>
          </GlassCard>
        </Link>
      </BentoGrid>

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
