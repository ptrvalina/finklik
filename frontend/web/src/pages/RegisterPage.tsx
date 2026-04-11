import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function RegisterPage() {
  const { register, isLoading, error, clearError } = useAuthStore()
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', org_name: '', org_unp: '',
    legal_form: 'ip', tax_regime: 'usn_no_vat',
  })

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => { clearError(); setForm((f) => ({ ...f, [field]: e.target.value })) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try { await register(form) } catch { /* error in store */ }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-tertiary/5 blur-3xl rounded-full" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/5 blur-3xl rounded-full" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-cyan-400 font-headline tracking-tight">ФинКлик</h1>
          <p className="text-on-surface-variant text-sm mt-2">Создайте аккаунт — это займёт 1 минуту</p>
        </div>

        <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold font-headline text-on-surface mb-6">Регистрация</h2>

          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error flex items-center gap-2">
              <Icon name="error" className="text-lg" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Ваше имя</label>
              <input className="input" placeholder="Иванов Иван Иванович" value={form.full_name} onChange={set('full_name')} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="ivan@company.by" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="label">Пароль</label>
              <input type="password" className="input" placeholder="Мин. 8 символов + заглавная + цифра" value={form.password} onChange={set('password')} required minLength={8} />
            </div>

            <div className="border-t border-outline-variant/20 pt-4">
              <p className="label">Организация / ИП</p>
              <div className="space-y-3">
                <div>
                  <label className="label">Форма</label>
                  <div className="flex gap-2">
                    {([['ip', 'ИП'], ['ooo', 'ООО']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-bold transition-all ${
                          form.legal_form === val
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                        }`}
                        onClick={() => setForm(f => ({ ...f, legal_form: val }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Режим налогообложения</label>
                  <select
                    className="input"
                    value={form.tax_regime}
                    onChange={e => setForm(f => ({ ...f, tax_regime: e.target.value }))}
                  >
                    <option value="usn_no_vat">УСН без НДС</option>
                    <option value="usn_vat">УСН с НДС</option>
                    <option value="osn_vat">Общая с НДС</option>
                  </select>
                </div>
                <div>
                  <label className="label">Название</label>
                  <input className="input" placeholder={form.legal_form === 'ip' ? 'ИП Иванов И.И.' : 'ООО "Ромашка"'} value={form.org_name} onChange={set('org_name')} required />
                </div>
                <div>
                  <label className="label">УНП (9 цифр)</label>
                  <input className="input" placeholder="691234567" value={form.org_unp} onChange={set('org_unp')} required maxLength={9} pattern="\d{9}" />
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-variant mt-6">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">Войти</Link>
        </p>
      </div>
    </div>
  )
}
