import { Link, useLocation } from 'react-router-dom'
import { useOperational } from '../../context/OperationalContext'
import { buildOperationalFlow, type FlowStepId } from '../../lib/operationalFlow'

function stepFromPath(pathname: string, search: string): FlowStepId | null {
  if (pathname.startsWith('/scan')) {
    return search.includes('doc_id=') ? 'verify' : 'scan'
  }
  if (pathname.startsWith('/accounting')) return 'journal'
  if (/^\/reports\/[^/]+/.test(pathname)) return 'signing'
  if (pathname.startsWith('/reports') || pathname.startsWith('/reporting')) return 'reporting'
  return null
}

function dotClass(state: string, isHere: boolean) {
  if (state === 'done') return 'bg-emerald-500 text-white'
  if (state === 'active' || isHere) return 'bg-primary text-on-primary ring-2 ring-primary/25'
  return 'bg-surface-container-high text-on-surface-variant'
}

/** Sticky: Скан → Проверка → Журнал → Отчётность → Подпись. */
export default function WorkflowContinuityBar() {
  const { pathname, search } = useLocation()
  const { session } = useOperational()
  const here = stepFromPath(pathname, search)
  if (!here) return null

  const { steps, suggestedPath } = buildOperationalFlow(session)
  const suggestedBase = suggestedPath?.split('?')[0] ?? ''

  return (
    <nav
      className="sticky top-[var(--fc-header-offset,0px)] z-20 -mx-4 mb-4 border-b border-outline/25 bg-surface/95 px-3 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-4"
      aria-label="Поток учёта: скан, проверка, журнал, отчётность, подпись"
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="hidden text-[10px] font-bold uppercase tracking-wide text-on-surface-variant sm:inline">
          Поток
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pb-0.5 sm:gap-1">
          {steps.map((s, i) => {
            const isHere = s.id === here
            const visualState = isHere && s.state === 'idle' ? 'active' : s.state
            return (
              <div key={s.id} className="flex shrink-0 items-center gap-0.5">
                <Link
                  to={s.path}
                  title={s.hint}
                  className={`flex items-center gap-1 rounded-lg px-1.5 py-1 transition hover:bg-primary/5 sm:gap-1.5 sm:px-2 sm:py-1.5 ${
                    isHere ? 'bg-primary/8 ring-1 ring-primary/20' : ''
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold sm:h-6 sm:w-6 sm:text-[10px] ${dotClass(visualState, isHere)}`}
                  >
                    {visualState === 'done' ? '✓' : i + 1}
                  </span>
                  <span className="text-[10px] font-semibold text-on-surface sm:text-xs">{s.title}</span>
                </Link>
                {i < steps.length - 1 && <span className="h-px w-1.5 shrink-0 bg-outline/40 sm:w-2" aria-hidden />}
              </div>
            )
          })}
        </div>
        {suggestedPath && suggestedBase !== pathname && (
          <Link to={suggestedPath} className="btn-primary shrink-0 !min-h-9 px-3 text-xs">
            Продолжить
          </Link>
        )}
      </div>
    </nav>
  )
}
