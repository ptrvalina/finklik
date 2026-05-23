import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import AuthLayout, { AuthBrandMark } from '../components/layout/AuthLayout'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuthStore()
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    org_name: '',
    org_unp: '',
    legal_form: 'ip',
    tax_regime: 'usn_no_vat',
  })

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      clearError()
      setForm((f) => ({ ...f, [field]: e.target.value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await register(form)
      navigate('/onboarding/business-profile', { replace: true })
    } catch {
      /* error in store */
    }
  }

  return (
    <AuthLayout maxWidthClass="max-w-md">
      <AuthBrandMark>
        <p className="mx-auto mt-3 max-w-[22rem] text-sm leading-relaxed text-on-surface-variant">Создайте аккаунт — это займёт 1 минуту</p>
      </AuthBrandMark>

      <div className="card-elevated rounded-3xl border border-outline/60 p-8 shadow-float ring-1 ring-emerald-500/[0.08] backdrop-blur-xl dark:border-white/[0.08]">
        <h2 className="mb-6 font-headline text-lg font-bold text-on-surface" style={{ letterSpacing: '-0.02em' }}>
          Регистрация
        </h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-error/25 bg-error/10 p-3 text-sm text-error">
            <Icon name="error" className="text-lg" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="label">Ваше имя</label>
            <input className="input min-h-11 rounded-[1rem]" placeholder="Иванов Иван Иванович" value={form.full_name} onChange={set('full_name')} required />
          </div>
          <div className="space-y-1.5">
            <label className="label">Email</label>
            <input type="email" className="input min-h-11 rounded-[1rem]" placeholder="ivan@company.by" value={form.email} onChange={set('email')} required />
          </div>
          <div className="space-y-1.5">
            <label className="label">Пароль</label>
            <input
              type="password"
              className="input min-h-11 rounded-[1rem]"
              placeholder="Мин. 8 символов + заглавная + цифра"
              value={form.password}
              onChange={set('password')}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-3 border-t border-outline/60 pt-4">
            <p className="label">Организация / ИП</p>
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="label">Форма</label>
                <div className="flex gap-2">
                  {(
                    [
                      ['ip', 'ИП'],
                      ['ooo', 'ООО'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`inline-flex h-11 flex-1 items-center justify-center rounded-[1rem] border px-3 text-sm font-bold transition-all ${
                        form.legal_form === val
                          ? 'border-primary bg-primary/12 text-primary ring-1 ring-primary/25'
                          : 'border-outline-variant/40 text-on-surface-variant hover:border-primary/30'
                      }`}
                      onClick={() => setForm((f) => ({ ...f, legal_form: val }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="label">Режим налогообложения</label>
                <select className="input min-h-11 rounded-[1rem]" value={form.tax_regime} onChange={(e) => setForm((f) => ({ ...f, tax_regime: e.target.value }))}>
                  <option value="usn_no_vat">УСН без НДС</option>
                  <option value="usn_vat">УСН с НДС</option>
                  <option value="osn_vat">Общая с НДС</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label">Название</label>
                <input
                  className="input min-h-11 rounded-[1rem]"
                  placeholder={form.legal_form === 'ip' ? 'ИП Иванов И.И.' : 'ООО "Ромашка"'}
                  value={form.org_name}
                  onChange={set('org_name')}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="label">УНП (9 цифр)</label>
                <input
                  className="input min-h-11 rounded-[1rem]"
                  placeholder="691234567"
                  value={form.org_unp}
                  onChange={set('org_unp')}
                  required
                  maxLength={9}
                  pattern="\d{9}"
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary min-h-12 w-full rounded-[1rem]" disabled={isLoading}>
            {isLoading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="font-bold text-primary hover:underline">
          Войти
        </Link>
      </p>
    </AuthLayout>
  )
}
