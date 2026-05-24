import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Step = { id: string; label: string }

type Props = {
  title: string
  subtitle: string
  steps: Step[]
  currentStep: number
  children: ReactNode
  footer: ReactNode
  saveLabel?: string
  saveState?: 'idle' | 'saving' | 'saved' | 'error'
}

export default function OnboardingShell({
  title,
  subtitle,
  steps,
  currentStep,
  children,
  footer,
  saveLabel,
  saveState = 'idle',
}: Props) {
  const progress = steps.length > 1 ? ((currentStep + 1) / steps.length) * 100 : 100

  return (
    <div className="fc-onboarding-shell flex min-h-[100dvh] flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-outline/50 bg-canvas/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link to="/" className="text-xs font-semibold text-on-surface-variant hover:text-primary">
            ← К приложению
          </Link>
          {saveLabel && (
            <span
              className={`text-[11px] font-medium tabular-nums ${
                saveState === 'saved'
                  ? 'text-emerald-600'
                  : saveState === 'saving'
                    ? 'text-on-surface-variant'
                    : saveState === 'error'
                      ? 'text-error'
                      : 'text-on-surface-variant/70'
              }`}
            >
              {saveState === 'saving' ? 'Сохраняем черновик…' : saveState === 'saved' ? 'Черновик сохранён' : saveLabel}
            </span>
          )}
        </div>
        <div className="mx-auto mt-3 max-w-2xl">
          <div className="h-1 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-premium"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {steps.map((s, i) => (
              <li key={s.id} className={i === currentStep ? 'text-emerald-600' : i < currentStep ? 'text-on-surface' : ''}>
                {i + 1}. {s.label}
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main className="fc-section-stack mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <div className="min-h-[12rem]">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600/90">Настройка</p>
          <h1 className="mt-2 font-headline text-2xl font-bold text-on-surface">{title}</h1>
          <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>
        </div>
        <div className="fc-section-stack mt-6">{children}</div>
      </main>

      <footer className="sticky bottom-0 z-30 border-t border-outline/50 bg-canvas/95 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto max-w-2xl space-y-2">{footer}</div>
      </footer>
    </div>
  )
}
