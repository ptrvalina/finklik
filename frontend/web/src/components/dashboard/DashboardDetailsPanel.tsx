import type { ReactNode } from 'react'

/** Сворачиваемый блок «Подробнее» на главной — меньше шума для solo/operator. */
export default function DashboardDetailsPanel({
  title = 'Подробнее',
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <details className="group mt-8 rounded-2xl border border-outline/50 bg-surface/80 open:shadow-[var(--fc-shadow-calm)] dark:border-white/[0.07]">
      <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-on-surface marker:content-none sm:px-5">
        <span className="flex items-center justify-between gap-2">
          {title}
          <span className="material-symbols-outlined text-lg text-on-surface-variant transition group-open:rotate-180">
            expand_more
          </span>
        </span>
      </summary>
      <div className="border-t border-outline/40 px-4 pb-6 pt-4 sm:px-5">{children}</div>
    </details>
  )
}
