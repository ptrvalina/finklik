import type { ReactNode } from 'react'

export function AuthBrandMark({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-8 text-center sm:mb-10">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#053028] to-[#062f29] shadow-lg ring-1 ring-emerald-400/30">
        <span className="material-symbols-outlined text-[28px] text-emerald-200">account_balance</span>
      </div>
      <h1 className="font-headline text-3xl font-bold tracking-tight text-[#0d302a] dark:text-on-surface" style={{ letterSpacing: '-0.03em' }}>
        ФинКлик
      </h1>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Premium</p>
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_-18%,rgba(0,168,107,0.12),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary/[0.04] to-transparent" />
      <div className="absolute -right-28 -top-36 h-[26rem] w-[26rem] rounded-full bg-[#00332e]/[0.09] blur-3xl" />
      <div className="absolute -bottom-44 -left-32 h-[30rem] w-[30rem] rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="absolute left-1/2 top-[15%] h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/25 blur-3xl dark:bg-emerald-950/30" />

      <div className={`relative z-10 mx-auto w-full ${maxWidthClass}`}>{children}</div>
    </div>
  )
}
