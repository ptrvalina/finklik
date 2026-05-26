import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ACTIVE_ORG_STORAGE_KEY, authApi, teamApi } from '../api/client'
import { resolveAppPath } from '../appBase'
import AuthLayout, { AuthBrandMark } from '../components/layout/AuthLayout'
import { calmActionError } from '../i18n/messages.ru'
import { formatApiDetail } from '../utils/apiError'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const [form, setForm] = useState({
    invite_code: params.get('code') || '',
    full_name: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await teamApi.acceptInvite(form)
      localStorage.setItem('access_token', data.access_token)
      try {
        const { data: user } = await authApi.me()
        if (user.organization_id) localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, user.organization_id)
      } catch {
        /* me optional */
      }
      setSuccess(true)
      setTimeout(() => {
        window.location.href = resolveAppPath('/')
      }, 1500)
    } catch (err: any) {
      setError(calmActionError('inviteAccept', formatApiDetail(err.response?.data?.detail)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout maxWidthClass="max-w-md">
      <AuthBrandMark>
        <p className="mt-3 text-sm text-on-surface-variant">Код приглашения и пароль для входа в команду</p>
      </AuthBrandMark>

      <div className="card-elevated relative overflow-hidden rounded-3xl border border-outline/60 p-8 shadow-float ring-1 ring-emerald-500/[0.08] backdrop-blur-xl dark:border-white/[0.08]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#00332e] via-primary to-emerald-400/90" aria-hidden />
        <div className="pt-1 text-center">
          <h2 className="font-headline text-xl font-bold text-on-surface">Присоединиться к ФинКлик</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Введите данные из письма-приглашения</p>
        </div>

        {success ? (
          <div className="py-10 text-center">
            <Icon name="check_circle" className="text-5xl text-primary" />
            <p className="mt-4 text-lg font-bold text-on-surface">Добро пожаловать!</p>
            <p className="mt-1 text-sm text-on-surface-variant">Перенаправляем…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-error/25 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
                <Icon name="error" className="text-lg" /> {error}
              </div>
            )}

            <div>
              <label className="label">Код приглашения</label>
              <div className="relative">
                <Icon name="key" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" />
                <input className="input rounded-[1rem] pl-10 font-mono" value={form.invite_code} onChange={(e) => setForm({ ...form, invite_code: e.target.value })} required />
              </div>
            </div>

            <div>
              <label className="label">Ваше полное имя</label>
              <div className="relative">
                <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" />
                <input
                  className="input rounded-[1rem] pl-10"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Пароль</label>
              <div className="relative">
                <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" />
                <input
                  type="password"
                  className="input rounded-[1rem] pl-10"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Минимум 8 символов"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary min-h-12 w-full rounded-[1rem]" disabled={loading || !form.invite_code || !form.full_name || !form.password}>
              {loading ? 'Подключаемся...' : 'Присоединиться'}
            </button>

            <p className="text-center text-xs text-on-surface-variant">
              Уже есть аккаунт?{' '}
              <a href="/login" className="font-bold text-primary hover:underline">
                Войти
              </a>
            </p>
          </form>
        )}
      </div>
    </AuthLayout>
  )
}
