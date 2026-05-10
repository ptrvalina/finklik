import clsx from 'clsx'

function ShimmerBlock({ className }: { className?: string }) {
  return <div className={clsx('fc-skeleton-shimmer rounded-xl', className)} aria-hidden />
}

/** Строки-плейсхолдеры под таблицу / списки */
export function TableSkeleton({
  rows = 8,
  cols = 5,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div className={clsx('space-y-3 p-4 sm:p-5', className)} aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <ShimmerBlock key={j} className={clsx('h-10 flex-1', j === 0 && 'max-w-[28%]')} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Одна текстовая линия */
export function LineSkeleton({ className }: { className?: string }) {
  return <ShimmerBlock className={clsx('h-4 w-full max-w-md', className)} aria-hidden />
}

/** Карточка-заглушка */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-3xl border border-white/[0.06] p-6', className)} aria-busy="true">
      <ShimmerBlock className="mb-4 h-5 w-2/5" />
      <ShimmerBlock className="mb-2 h-3 w-full" />
      <ShimmerBlock className="h-3 w-4/5" />
    </div>
  )
}
