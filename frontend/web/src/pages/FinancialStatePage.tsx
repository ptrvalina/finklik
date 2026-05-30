import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import FinancialStateHero from '../components/financial-state/FinancialStateHero'
import { CardSkeleton } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'

export default function FinancialStatePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
  })

  const riskLevel = data?.risk_level ?? '—'
  const readiness = data?.operational_readiness?.score ?? null

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link to="/control/trust" className="btn-secondary fc-btn-thumb text-sm">
          Надёжность
        </Link>
        <Link to="/operations" className="btn-primary fc-btn-thumb text-sm">
          Лента работы
        </Link>
      </div>

      {!isLoading && !isError && data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Риск</p>
            <p className="mt-1 font-headline text-xl font-extrabold capitalize text-on-surface sm:text-2xl">{riskLevel}</p>
            <p className="text-[11px] text-on-surface-variant">Сводный уровень</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Готовность</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-primary sm:text-2xl">
              {readiness != null ? `${readiness}%` : '—'}
            </p>
            <p className="text-[11px] text-on-surface-variant">{data.operational_readiness?.label ?? 'Процессы'}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">OCR</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">
              {data.document_completeness?.pending_ocr ?? 0}
            </p>
            <p className="text-[11px] text-on-surface-variant">В очереди</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Согласования</p>
            <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">
              {data.compliance_state?.pending_approvals ?? 0}
            </p>
            <p className="text-[11px] text-on-surface-variant">Ожидают</p>
          </div>
        </div>
      )}

      {isLoading && <CardSkeleton className="min-h-[160px]" />}
      {isError && (
        <CalmErrorState
          title="Состояние недоступно"
          fallbackMessage="Не удалось загрузить снимок. Проверьте организацию и повторите."
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !isError && <FinancialStateHero />}
      {!isLoading && !isError && (
        <p className="mt-6 text-sm text-on-surface-variant">
          Прогнозы и аудит изменений состояния — в разделе «Надёжность» или в ленте при включённой диагностике.
        </p>
      )}
    </div>
  )
}
