import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { pingApi, resolveApiBase } from '../api/client'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [apiReachable, setApiReachable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    pingApi().then((ok) => {
      if (!cancelled) setApiReachable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    try { await login(form) } catch { /* error in store */ }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4">
      <div className="absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="absolute -bottom-48 -left-32 h-[32rem] w-[32rem] rounded-full bg-primary/[0.04] blur-3xl" />
      <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-slate-200/40 blur-3xl dark:bg-zinc-800/30" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="page-heading-brand">
            ФинКлик
          </h1>
          <p className="mt-2.5 text-xs font-semibold tracking-[0.22em] text-on-surface-variant">БИЗНЕС В КАРМАНЕ</p>
        </div>

        <div className="card-elevated border border-outline/80 p-7 dark:border-zinc-700/70">
          <h2 className="mb-6 font-headline text-lg font-bold text-on-surface" style={{ letterSpacing: '-0.02em' }}>
            Войти в аккаунт
          </h2>

          {apiReachable === false && !error && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <Icon name="warning" className="text-base mt-0.5" />
              <span>
                API ({resolveApiBase()}) сейчас недоступен из вашей сети. Откройте его в новой вкладке —
                если страница не открывается, дело в провайдере / VPN / расширениях браузера.
              </span>
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error flex items-start gap-2">
              <Icon name="error" className="text-lg mt-0.5" /> <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" />
                <input type="email" className="input pl-10" placeholder="ivan@company.by"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus />
              </div>
            </div>
            <div>
              <label className="label">Пароль</label>
              <div className="relative">
                <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" />
                <input type="password" className="input pl-10" placeholder="••••••••"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? 'Входим...' : 'Войти'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-variant mt-6">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-primary font-bold hover:underline">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  )
}
