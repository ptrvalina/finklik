import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    try { await login(form) } catch { /* error in store */ }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 blur-3xl rounded-full" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary/5 blur-3xl rounded-full" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-cyan-400 font-headline tracking-tight">ФинКлик</h1>
          <p className="text-on-surface-variant text-sm mt-2">БИЗНЕС В КАРМАНЕ</p>
        </div>

        <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold font-headline text-on-surface mb-6">Войти в аккаунт</h2>

          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error flex items-center gap-2">
              <Icon name="error" className="text-lg" /> {error}
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
