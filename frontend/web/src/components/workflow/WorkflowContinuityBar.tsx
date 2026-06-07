import { Link, useLocation } from 'react-router-dom'
import { useOperational } from '../../context/OperationalContext'
import { buildOperationalFlow, type FlowStepId } from '../../lib/operationalFlow'

function stepFromPath(pathname: string): FlowStepId | null {
  if (pathname.startsWith('/scan')) return 'scan'
  if (pathname.startsWith('/accounting')) return 'journal'
  if (pathname.startsWith('/reports') || pathname.startsWith('/reporting')) return 'reporting'
  return null
}

function dotClass(state: string, isHere: boolean) {
  if (state === 'done') return 'bg-emerald-500 text-white'
  if (state === 'active' || isHere) return 'bg-primary text-on-primary ring-2 ring-primary/25'
  return 'bg-surface-container-high text-on-surface-variant'
}

/** Sticky цепочка Скан → Журнал → Отчётность на страницах потока учёта. */
export default function WorkflowContinuityBar() {
  const { pathname } = useLocation()
  const { session } = useOperational()
  const here = stepFromPath(pathname)
  if (!here) return null

  const { steps, suggestedPath } = buildOperationalFlow(session)

  return (
    <nav
      className="sticky top-[var(--fc-header-offset,0px)] z-20 -mx-4 mb-4 border-b border-outline/25 bg-surface/95 px-3 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-4"
      aria-label="Поток учёта"
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="hidden text-[10px] font-bold uppercase tracking-wide text-on-surface-variant sm:inline">
          Поток
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5">
          {steps.map((s, i) => {
            const isHere = s.id === here
            const visualState = isHere && s.state === 'idle' ? 'active' : s.state
            return (
              <div key={s.id} className="flex shrink-0 items-center gap-1">
                <Link
                  to={s.path}
                  title={s.hint}
                  className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 transition hover:bg-primary/5 ${
                    isHere ? 'bg-primary/8 ring-1 ring-primary/20' : ''
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${dotClass(visualState, isHere)}`}
                  >
                    {visualState === 'done' ? '✓' : i + 1}
                  </span>
                  <span className="text-xs font-semibold text-on-surface">{s.title}</span>
                </Link>
                {i < steps.length - 1 && <span className="h-px w-3 shrink-0 bg-outline/40" aria-hidden />}
              </div>
            )
          })}
        </div>
        {suggestedPath && !pathname.startsWith(suggestedPath.split('?')[0]) && (
          <Link to={suggestedPath} className="btn-primary shrink-0 !min-h-9 px-3 text-xs">
            Продолжить
          </Link>
        )}
      </div>
    </nav>
  )
}
