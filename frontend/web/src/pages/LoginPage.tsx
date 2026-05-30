import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { pingApi, PRODUCTION_API_BASE, resolveApiBase, teamApi } from '../api/client'
import AuthLayout, { AuthBrandMark } from '../components/layout/AuthLayout'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function LoginPage() {
  const navigate = useNavigate()
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
    try {
      await login(form)
      try {
        const { data } = await teamApi.getBusinessProfile()
        if (!data?.business_profile_completed) {
          navigate('/onboarding/business-profile', { replace: true })
          return
        }
      } catch {
        /* профиль опционален */
      }
      navigate('/', { replace: true })
    } catch {
      /* error in store */
    }
  }

  return (
    <AuthLayout>
      <AuthBrandMark>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Бизнес в кармане</p>
      </AuthBrandMark>

      <div className="card-elevated rounded-3xl border border-outline/60 p-8 shadow-float ring-1 ring-primary/[0.08] backdrop-blur-xl dark:border-white/[0.08]">
        <h2 className="mb-6 font-headline text-lg font-bold text-on-surface" style={{ letterSpacing: '-0.02em' }}>
          Войти в аккаунт
        </h2>

        {typeof window !== 'undefined' && window.location.hostname === 'ptrvalina.github.io' && (
          <div className="mb-4 rounded-xl border border-primary/25 bg-primary/[0.06] p-3 text-xs leading-snug text-on-surface">
            <span className="font-semibold text-primary">Рекомендуемый адрес:</span> фронт и API на одном домене (без блокировок cross-origin). Откройте{' '}
            <a className="break-all font-mono font-semibold text-primary underline" href={`${PRODUCTION_API_BASE}/login`}>
              {PRODUCTION_API_BASE}/login
            </a>
          </div>
        )}

        {apiReachable === false && !error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            <Icon name="warning" className="mt-0.5 text-base" />
            <span>
              API ({resolveApiBase()}) пока не ответил на проверку (простой Render 1–2 мин или ограничение сети). Откройте{' '}
              <span className="font-mono break-all">{resolveApiBase()}/docs</span> — если не грузится, попробуйте интернет с телефона или VPN (иногда провайдер режет
              зарубежные хостинги).
            </span>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-error/25 bg-error/10 p-3 text-sm text-error">
            <Icon name="error" className="mt-0.5 text-lg" /> <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Эл. почта</label>
            <div className="relative">
              <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" />
              <input
                type="email"
                className="input pl-10"
                placeholder="ivan@company.by"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="label">Пароль</label>
            <div className="relative">
              <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" />
              <input
                type="password"
                className="input pl-10"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary min-h-12 w-full" disabled={isLoading}>
            {isLoading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Нет аккаунта?{' '}
        <Link to="/register" className="font-bold text-primary hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </AuthLayout>
  )
}
