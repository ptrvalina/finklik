import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { pingApi, PRODUCTION_API_BASE, resolveApiBase, teamApi } from '../api/client'
import { AuthGlassCard, StitchIcon } from '../components/stitch'
import AuthLayout, { AuthBrandMark } from '../components/layout/AuthLayout'

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
    <AuthLayout maxWidthClass="max-w-[440px]">
      <AuthBrandMark>
        <p className="mt-2 text-sm text-on-surface-variant">Финансы, учёт и отчётность для бизнеса Беларуси</p>
      </AuthBrandMark>

      <AuthGlassCard>
        <div className="mb-8">
          <h2 className="font-headline text-display-lg text-on-surface">Вход в аккаунт</h2>
          <p className="mt-1 text-body-base text-on-surface-variant">Добро пожаловать в ФинКлик</p>
        </div>

        {typeof window !== 'undefined' && window.location.hostname === 'ptrvalina.github.io' && (
          <div className="mb-4 rounded-xl border border-primary/25 bg-primary/[0.06] p-3 text-xs leading-snug text-on-surface">
            <span className="font-semibold text-primary">Рекомендуемый адрес:</span> фронт и API на одном домене. Откройте{' '}
            <a className="break-all font-mono font-semibold text-primary underline" href={`${PRODUCTION_API_BASE}/login`}>
              {PRODUCTION_API_BASE}/login
            </a>
          </div>
        )}

        {apiReachable === false && !error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
            <StitchIcon name="warning" className="mt-0.5 text-base" />
            <span>
              API ({resolveApiBase()}) пока не ответил. Проверьте{' '}
              <span className="font-mono break-all">{resolveApiBase()}/docs</span>
            </span>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-error/25 bg-error-container p-3 text-sm text-error">
            <StitchIcon name="error" className="mt-0.5 text-lg" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="label" htmlFor="login-email">
              Эл. почта
            </label>
            <div className="relative">
              <StitchIcon name="alternate_email" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
              <input
                id="login-email"
                type="email"
                className="input min-h-touch-min pl-11"
                placeholder="ivan@company.by"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label mb-0" htmlFor="login-password">
                Пароль
              </label>
              <Link to="/password-reset" className="text-xs font-semibold text-primary hover:underline">
                Забыли пароль?
              </Link>
            </div>
            <div className="relative">
              <StitchIcon name="lock" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
              <input
                id="login-password"
                type="password"
                className="input min-h-touch-min pl-11"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary min-h-touch-min w-full" disabled={isLoading}>
            {isLoading ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </AuthGlassCard>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Нет аккаунта?{' '}
        <Link to="/register" className="font-bold text-primary hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </AuthLayout>
  )
}
