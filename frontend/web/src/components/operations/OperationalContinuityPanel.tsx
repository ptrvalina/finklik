import { Link } from 'react-router-dom'
import { useOperational } from '../../context/OperationalContext'
import { formatNextStepCta } from '../../context/OperationalContext'
import { verbLabel } from '../../lib/operationalVerbs'

function relTime(at: number) {
  const min = Math.round((Date.now() - at) / 60_000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  return `${Math.round(min / 60)} ч назад`
}

function AnchorRow({
  icon,
  label,
  meta,
  to,
}: {
  icon: string
  label: string
  meta: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-2.5 rounded-xl border border-outline/30 bg-surface/80 px-3 py-2.5 transition hover:border-primary/30 hover:bg-primary/5"
    >
      <span className="material-symbols-outlined mt-0.5 text-lg text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-on-surface">{label}</span>
        <span className="text-[10px] text-on-surface-variant">{meta}</span>
      </span>
    </Link>
  )
}

/** Правая operational panel: что в работе и следующий шаг (не чат, не CRM). */
export default function OperationalContinuityPanel({ variant }: { variant: 'rail' | 'drawer' }) {
  const { session, hasAnchors, setPanelOpen, continueNext, setNextStep } = useOperational()
  const step = session.nextStep

  const body = (
    <>
      {hasAnchors && (
        <>
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Сейчас в работе</p>
      <div className="mt-3 space-y-2">
        {session.lastOcrDoc && (
          <AnchorRow
            icon="document_scanner"
            label={session.lastOcrDoc.title}
            meta={`Скан · ${relTime(session.lastOcrDoc.at)}`}
            to={`/scan?doc_id=${encodeURIComponent(session.lastOcrDoc.id)}`}
          />
        )}
        {session.lastTransaction && (
          <AnchorRow
            icon="receipt_long"
            label={session.lastTransaction.title}
            meta={`Журнал · ${relTime(session.lastTransaction.at)}`}
            to={`/accounting/journal?tx_id=${encodeURIComponent(session.lastTransaction.id)}`}
          />
        )}
        {session.activeWorkPack && (
          <AnchorRow
            icon="inventory_2"
            label={session.activeWorkPack.title}
            meta={`Пакет · ${relTime(session.activeWorkPack.at)}`}
            to="/operations"
          />
        )}
        {session.lastReportingBlocker && (
          <AnchorRow
            icon="assignment_turned_in"
            label={session.lastReportingBlocker.label}
            meta={`Отчётность · ${relTime(session.lastReportingBlocker.at)}`}
            to={session.lastReportingBlocker.path}
          />
        )}
      </div>
        </>
      )}

      {step && (
        <div className="mt-4 rounded-xl border border-primary/25 bg-primary/8 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Следующий шаг</p>
          <p className="mt-1 text-sm text-on-surface">{step.label}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-h-10 flex-1 px-3 text-xs" onClick={() => continueNext()}>
              {formatNextStepCta(step)}
            </button>
            <button
              type="button"
              className="btn-ghost min-h-10 px-2 text-xs"
              onClick={() => setNextStep(null)}
            >
              Позже
            </button>
          </div>
        </div>
      )}

      {!step && hasAnchors && (
        <Link to="/operations" className="btn-secondary mt-4 inline-flex min-h-10 w-full justify-center text-xs">
          {verbLabel('continue')} в ленте
        </Link>
      )}
    </>
  )

  if (variant === 'drawer') {
    return (
      <aside className="fixed inset-y-0 right-0 z-[84] flex w-full max-w-sm flex-col border-l border-outline/40 bg-surface/95 p-4 shadow-float backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-headline text-sm font-bold text-on-surface">Контекст работы</h2>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-container-high"
            onClick={() => setPanelOpen(false)}
            aria-label="Закрыть"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </aside>
    )
  }

  return (
    <aside className="hidden w-72 shrink-0 xl:block">
      <div className="sticky top-6 rounded-2xl border border-outline/35 bg-surface/90 p-4">{body}</div>
    </aside>
  )
}
