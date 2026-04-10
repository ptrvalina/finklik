import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { teamApi } from '../api/client'
import { resolveAppPath } from '../appBase'
import { useAuthStore } from '../store/authStore'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuthStore.getState()
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
      localStorage.setItem('refresh_token', data.refresh_token)
      setSuccess(true)
      setTimeout(() => {
        window.location.href = resolveAppPath('/')
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка принятия приглашения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="absolute top-0 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] translate-x-1/4 translate-y-1/4 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface-container-high border border-outline-variant/20 rounded-xl p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold font-headline text-on-surface">Присоединиться к ФинКлик</h1>
          <p className="text-sm text-on-surface-variant mt-2">Введите код приглашения и создайте пароль</p>
        </div>

        {success ? (
          <div className="text-center py-8">
            <Icon name="check_circle" className="text-5xl text-secondary" />
            <p className="text-lg font-bold text-on-surface mt-4">Добро пожаловать!</p>
            <p className="text-sm text-on-surface-variant mt-1">Перенаправляем...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 bg-error/10 text-error border border-error/20">
                <Icon name="error" className="text-lg" /> {error}
              </div>
            )}

            <div>
              <label className="label">Код приглашения</label>
              <div className="relative">
                <Icon name="key" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" />
                <input className="input pl-10 font-mono" value={form.invite_code} onChange={e => setForm({ ...form, invite_code: e.target.value })} required />
              </div>
            </div>

            <div>
              <label className="label">Ваше полное имя</label>
              <div className="relative">
                <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" />
                <input className="input pl-10" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Иванов Иван Иванович" required />
              </div>
            </div>

            <div>
              <label className="label">Пароль</label>
              <div className="relative">
                <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" />
                <input type="password" className="input pl-10" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Минимум 8 символов" required minLength={8} />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading || !form.invite_code || !form.full_name || !form.password}>
              {loading ? 'Подключаемся...' : 'Присоединиться'}
            </button>

            <p className="text-center text-xs text-on-surface-variant">
              Уже есть аккаунт? <a href="/login" className="text-primary hover:underline">Войти</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
