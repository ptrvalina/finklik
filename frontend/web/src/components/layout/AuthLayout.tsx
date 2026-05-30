import type { ReactNode } from 'react'

export function AuthBrandMark({ children }: { children?: ReactNode }) {
  return (
    <div className="mb-8 text-center sm:mb-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0058be] via-[#2170e4] to-[#131b2e] shadow-[0_16px_48px_-12px_rgba(33,112,228,0.45)] ring-2 ring-white/15">
        <span className="material-symbols-outlined text-[32px] text-white">account_balance</span>
      </div>
      <h1 className="font-headline text-3xl font-bold tracking-tight text-[#0f172a] dark:text-on-surface" style={{ letterSpacing: '-0.035em' }}>
        ФинКлик
      </h1>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Премиум</p>
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

/**
 * Stitch split-экран входа: слева брендовая панель с превью, справа форма.
 * На мобиле панель скрыта — форма занимает весь экран.
 */
export function AuthSplitLayout({ children, maxWidthClass = 'max-w-md' }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-surface">
      <aside className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0058be] via-[#2170e4] to-[#131b2e] p-10 lg:flex xl:w-[48%]">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 -left-10 h-72 w-72 rounded-full bg-[#4edea3]/20 blur-3xl" aria-hidden />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <span className="material-symbols-outlined text-[26px] text-white">account_balance</span>
          </div>
          <span className="font-headline text-2xl font-bold tracking-tight text-white">ФинКлик</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-headline text-[2.5rem] font-bold leading-[1.1] text-white" style={{ letterSpacing: '-0.02em' }}>
            Операционная система для вашего бизнеса
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-white/80">
            Автопилот финансовых потоков. Управляйте деньгами, командой и отчётностью в едином пространстве.
          </p>
          <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">Готово к сдаче</span>
              <span className="material-symbols-outlined text-[#6ffbbe]">check_circle</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-4/5 rounded-full bg-[#4edea3]" />
            </div>
            <p className="mt-2 text-sm text-white/80">Налоговая отчётность сформирована на 80%</p>
          </div>
        </div>
        <p className="relative z-10 text-xs text-white/50">© 2026 ФинКлик — сделано для бизнеса Беларуси</p>
      </aside>
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className={`w-full ${maxWidthClass}`}>{children}</div>
      </section>
    </div>
  )
}
