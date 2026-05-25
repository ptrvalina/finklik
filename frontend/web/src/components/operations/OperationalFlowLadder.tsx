import { Link } from 'react-router-dom'
import { buildOperationalFlow } from '../../lib/operationalFlow'
import type { OperationalSessionV1 } from '../../lib/operationalSession'

function stepDot(state: string) {
  if (state === 'done') return 'bg-emerald-500 text-white'
  if (state === 'active') return 'bg-primary text-primary-on ring-2 ring-primary/30'
  return 'bg-surface-container-high text-on-surface-variant'
}

export default function OperationalFlowLadder({ session }: { session: OperationalSessionV1 }) {
  const { steps, suggestedPath } = buildOperationalFlow(session)

  return (
    <div className="mb-4 rounded-xl border border-outline/30 bg-surface-container-low/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Поток учёта</p>
      <div className="mt-2 flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.id} className="flex min-w-0 flex-1 items-center gap-1">
            <Link
              to={s.path}
              title={s.hint}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition hover:bg-primary/5 ${
                s.state === 'active' ? 'ring-1 ring-primary/25' : ''
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${stepDot(s.state)}`}
              >
                {s.state === 'done' ? '✓' : i + 1}
              </span>
              <span className="max-w-full truncate text-[9px] font-semibold uppercase text-on-surface-variant">
                {s.title}
              </span>
            </Link>
            {i < steps.length - 1 && (
              <span className="h-px w-2 shrink-0 bg-outline/40" aria-hidden />
            )}
          </div>
        ))}
      </div>
      {suggestedPath && (
        <Link to={suggestedPath} className="btn-primary mt-3 inline-flex min-h-9 w-full justify-center text-xs">
          Продолжить поток
        </Link>
      )}
    </div>
  )
}
