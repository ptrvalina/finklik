import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/**
 * Last-resort boundary for unexpected render errors — calm recovery, no raw stack traces in UI.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FinClick] render boundary', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-6 py-16 text-on-surface">
          <div className="w-full max-w-md rounded-3xl border border-outline/40 bg-surface/95 p-8 text-center shadow-soft backdrop-blur-xl dark:border-white/[0.08] dark:bg-[rgb(var(--color-surface)/0.55)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Стабильность</p>
            <h1 className="mt-3 font-headline text-xl font-semibold tracking-tight sm:text-2xl">
              Интерфейс временно сбился
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              Данные на сервере в порядке — это локальный сбой отображения. Обновите страницу: контекст
              журнала и фильтры в этой сессии сохраняются там, где это предусмотрено.
            </p>
            <button
              type="button"
              className="btn-primary mt-6 w-full sm:w-auto"
              onClick={() => window.location.reload()}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
