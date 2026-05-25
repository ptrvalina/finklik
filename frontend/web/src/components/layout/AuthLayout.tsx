import type { ReactNode } from 'react'

export function AuthBrandMark({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-8 text-center sm:mb-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#004d40] via-emerald-600 to-[#042f2e] shadow-[0_16px_48px_-12px_rgba(16,185,129,0.45)] ring-2 ring-white/15">
        <span className="material-symbols-outlined text-[32px] text-emerald-100">account_balance</span>
      </div>
      <h1 className="font-headline text-3xl font-bold tracking-tight text-[#0f172a] dark:text-on-surface" style={{ letterSpacing: '-0.035em' }}>
        ФинКлик
      </h1>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">Премиум</p>
      {children}
    </div>
  )
}

type AuthLayoutProps = {
  children: ReactNode
  /** Ширина контейнера формы */
  maxWidthClass?: string
}

export default function AuthLayout({ children, maxWidthClass = 'max-w-sm' }: AuthLayoutProps) {
  return (
    <div className="fc-auth-shell relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className={`relative z-10 mx-auto w-full ${maxWidthClass}`}>{children}</div>
    </div>
  )
}
