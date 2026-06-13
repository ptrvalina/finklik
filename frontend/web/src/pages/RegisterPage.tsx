import { useMemo, useState } from 'react'
import { taxModesForLegalForm } from '../lib/productContour'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { AuthSplitLayout, AuthBrandMark } from '../components/layout/AuthLayout'
import { AuthGlassCard, StitchIcon } from '../components/stitch'

const LEGAL_FORMS = [
  { id: 'ip', label: 'ИП', hint: 'Индивидуальный предприниматель', icon: 'person' },
  { id: 'ooo', label: 'ООО', hint: 'Общество с ограниченной ответственностью', icon: 'corporate_fare' },
] as const

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuthStore()
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    org_name: '',
    org_unp: '',
    legal_form: 'ip',
    tax_regime: 'single_tax',
  })

  const taxModes = useMemo(() => taxModesForLegalForm(form.legal_form), [form.legal_form])

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
    <AuthSplitLayout maxWidthClass="max-w-[480px]">
      <div className="lg:hidden">
        <AuthBrandMark>
          <p className="mx-auto mt-3 max-w-[22rem] text-sm leading-relaxed text-on-surface-variant">
            Создайте аккаунт — это займёт 1 минуту
          </p>
        </AuthBrandMark>
      </div>

      <AuthGlassCard>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-primary' : 'w-2 bg-primary'}`} />
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-primary' : 'w-2 bg-outline-variant'}`} />
          </div>
          <span className="font-label text-label-caps uppercase tracking-widest text-outline">
            Шаг {step} из 2
          </span>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-error/25 bg-error-container p-3 text-sm text-error">
            <StitchIcon name="error" className="mt-0.5 text-lg" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <div>
            <header className="mb-8">
              <h2 className="font-headline text-display-lg text-on-surface">Регистрация в ФинКлик</h2>
              <p className="mt-1 text-body-base text-on-surface-variant">
                Выберите форму ведения бизнеса — от этого зависят режим налогообложения и отчётность.
              </p>
            </header>

            <div className="space-y-3">
              {LEGAL_FORMS.map(({ id, label, hint, icon }) => {
                const active = form.legal_form === id
                return (
                  <button
                    key={id}
                    type="button"
                    className={`flex w-full items-center rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                      active
                        ? 'border-primary bg-primary-fixed shadow-[0_0_0_4px_rgba(0,88,190,0.15)]'
                        : 'border-outline-variant hover:border-primary/40 hover:bg-surface'
                    }`}
                    onClick={() => {
                      const modes = taxModesForLegalForm(id)
                      setForm((f) => ({
                        ...f,
                        legal_form: id,
                        tax_regime: modes[0]?.id || f.tax_regime,
                      }))
                    }}
                  >
                    <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high">
                      <StitchIcon name={icon} className="text-xl text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-headline text-headline-sm text-on-surface">{label}</h4>
                      <p className="text-sm text-on-surface-variant">{hint}</p>
                    </div>
                    {active && (
                      <StitchIcon name="check_circle" filled className="ml-2 text-primary" />
                    )}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="btn-primary mt-8 flex min-h-touch-min w-full items-center justify-center gap-2"
              onClick={() => setStep(2)}
            >
              Продолжить
              <StitchIcon name="arrow_forward" className="text-lg" />
            </button>
          </div>
        ) : (
          <div>
            <header className="mb-8">
              <button
                type="button"
                className="mb-4 inline-flex items-center gap-1 font-semibold text-primary transition hover:opacity-80"
                onClick={() => setStep(1)}
              >
                <StitchIcon name="arrow_back" className="text-lg" />
                Назад
              </button>
              <h2 className="font-headline text-display-lg text-on-surface">Ваш профиль</h2>
              <p className="mt-1 text-body-base text-on-surface-variant">
                Заполните контактные данные и реквизиты организации.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="label">Ваше имя</label>
                <input
                  className="input min-h-touch-min"
                  placeholder="Иванов Иван Иванович"
                  value={form.full_name}
                  onChange={set('full_name')}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="label">Эл. почта</label>
                <div className="relative">
                  <StitchIcon name="alternate_email" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    type="email"
                    className="input min-h-touch-min pl-11"
                    placeholder="ivan@company.by"
                    value={form.email}
                    onChange={set('email')}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label">Пароль</label>
                <div className="relative">
                  <StitchIcon name="lock" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                  <input
                    type="password"
                    className="input min-h-touch-min pl-11"
                    placeholder="Мин. 8 символов + заглавная + цифра"
                    value={form.password}
                    onChange={set('password')}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-outline-variant/30 pt-4">
                <p className="font-label text-label-caps uppercase tracking-widest text-outline">
                  {form.legal_form === 'ip' ? 'ИП' : 'ООО'}
                </p>
                <div className="space-y-3.5">
                  <div className="space-y-2">
                    <label className="label">Режим налогообложения</label>
                    <select
                      className="input min-h-touch-min"
                      value={form.tax_regime}
                      onChange={(e) => setForm((f) => ({ ...f, tax_regime: e.target.value }))}
                    >
                      {taxModes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label">Название</label>
                    <input
                      className="input min-h-touch-min"
                      placeholder={form.legal_form === 'ip' ? 'ИП Иванов И.И.' : 'ООО "Ромашка"'}
                      value={form.org_name}
                      onChange={set('org_name')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label">УНП (9 цифр)</label>
                    <input
                      className="input min-h-touch-min font-mono-data"
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

              <button type="submit" className="btn-primary flex min-h-touch-min w-full items-center justify-center gap-2" disabled={isLoading}>
                {isLoading ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
                {!isLoading && <StitchIcon name="rocket_launch" className="text-lg" />}
              </button>
            </form>
          </div>
        )}
      </AuthGlassCard>

      <p className="mt-4 text-center text-xs text-on-surface-variant">
        После регистрации — профиль бизнеса (~2 мин), затем лента работы подскажет следующие шаги.
      </p>
      <p className="mt-4 text-center text-sm text-on-surface-variant">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="font-bold text-primary hover:underline">
          Войти
        </Link>
      </p>
    </AuthSplitLayout>
  )
}
