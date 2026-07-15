import { SCANNER_STEPS, activeStepIndex, type ScannerWorkflowPhase } from '../../lib/scannerWorkflow'
import { StitchIcon } from '../stitch'

export default function ScannerWorkflowStepper({ phase }: { phase: ScannerWorkflowPhase }) {
  const activeIdx = activeStepIndex(phase)
  const processing = phase === 'processing'

  return (
    <nav
      className="mb-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Этапы обработки документа"
    >
      <ol className="flex min-w-max items-center gap-1 sm:gap-2">
        {SCANNER_STEPS.map((step, i) => {
          const done = i < activeIdx
          const current = i === activeIdx
          const pending = i > activeIdx
          return (
            <li key={step.id} className="flex items-center gap-1 sm:gap-2">
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition sm:px-4 ${
                  current
                    ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                    : done
                      ? 'border-emerald-400/30 bg-emerald-500/8 text-emerald-800 dark:text-emerald-200'
                      : 'border-outline-variant/35 bg-surface-container-lowest text-on-surface-variant'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    current
                      ? 'bg-primary text-on-primary'
                      : done
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
                        : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {done ? (
                    <StitchIcon name="check" className="text-base" />
                  ) : current && processing ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <StitchIcon name={step.icon} className="text-base" />
                  )}
                </span>
                <span className="whitespace-nowrap">{step.label}</span>
              </div>
              {i < SCANNER_STEPS.length - 1 && (
                <StitchIcon
                  name="chevron_right"
                  className={`hidden text-lg sm:block ${pending ? 'text-outline-variant/50' : 'text-on-surface-variant/60'}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
