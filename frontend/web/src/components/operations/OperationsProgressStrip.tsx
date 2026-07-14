/** Человекочитаемый прогресс ленты работы — без ERP-метрик. */

export default function OperationsProgressStrip({
  readinessScore,
  pendingCount,
  blockedCount,
  onRefresh,
  refreshing,
}: {
  readinessScore: number | null | undefined
  pendingCount?: number
  blockedCount?: number
  onRefresh?: () => void
  refreshing?: boolean
}) {
  if (readinessScore == null && pendingCount == null) return null

  const score = readinessScore ?? 0
  const pending = pendingCount ?? 0
  const blocked = blockedCount ?? 0

  let headline = 'Всё под контролем'
  if (blocked > 0) {
    headline = `Осталось закрыть ${blocked} ${blocked === 1 ? 'блокер' : blocked < 5 ? 'блокера' : 'блокеров'}`
  } else if (pending > 0) {
    headline = `В очереди ${pending} ${pending === 1 ? 'задача' : pending < 5 ? 'задачи' : 'задач'}`
  } else if (score < 80) {
    headline = 'Данные почти готовы — добейте журнал и документы'
  }

  return (
    <div className="fc-execution-progress rounded-2xl border border-outline/35 bg-surface-container-low/50 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface">{headline}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-outline/25">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          {blocked > 0
            ? `Блокеров: ${blocked}`
            : pending > 0
              ? `В работе: ${pending}`
              : score >= 80
                ? 'Можно переходить к отчётности'
                : 'Дозаполните журнал и документы'}
        </p>
      </div>
      {onRefresh && (
        <button
          type="button"
          className="btn-secondary mt-3 min-h-10 shrink-0 text-xs sm:mt-0"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? 'Обновляем…' : 'Обновить'}
        </button>
      )}
    </div>
  )
}
