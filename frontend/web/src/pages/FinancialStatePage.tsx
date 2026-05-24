import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { operationsApi } from '../api/client'
import { orgQueryKey } from '../lib/queryKeys'
import OperationalPage from '../components/shell/OperationalPage'
import FinancialStateHero from '../components/financial-state/FinancialStateHero'
import { CardSkeleton } from '../components/premium'
import { CalmErrorState } from '../components/errors/CalmErrorState'

export default function FinancialStatePage() {
  const { isLoading, isError, refetch } = useQuery({
    queryKey: orgQueryKey('financial-state-bundle'),
    queryFn: () => operationsApi.financialState().then((r) => r.data),
    staleTime: 60_000,
  })

  return (
    <OperationalPage
      eyebrow="Контроль"
      title="Финансовое состояние"
      description="Единый снимок: деньги, первичка, отчётность и очереди — от него строятся приоритеты в ленте."
      primaryAction={
        <Link to="/operations" className="btn-primary fc-btn-thumb text-sm">
          Лента работы
        </Link>
      }
      secondaryActions={
        <Link to="/reports" className="btn-secondary fc-btn-thumb text-sm">
          Отчётность
        </Link>
      }
    >
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
    </OperationalPage>
  )
}
