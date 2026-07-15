import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthGlassCard, StitchIcon } from '../components/stitch'
import AuthLayout, { AuthBrandMark } from '../components/layout/AuthLayout'

export default function PasswordResetPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <AuthLayout maxWidthClass="max-w-[440px]">
      <AuthBrandMark>
        <p className="mt-2 text-sm text-on-surface-variant">Восстановление доступа к аккаунту</p>
      </AuthBrandMark>

      <AuthGlassCard>
        <div className="mb-8">
          <h2 className="font-headline text-display-lg text-on-surface">Восстановление пароля</h2>
          <p className="mt-1 text-body-base text-on-surface-variant">
            Самостоятельный сброс по письму пока готовится. Оставьте почту — мы подскажем, как вернуть доступ.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm text-on-surface">
            <div className="flex items-start gap-2">
              <StitchIcon name="support_agent" className="mt-0.5 text-xl text-primary" />
              <div>
                <p className="font-semibold">Заявка принята</p>
                <p className="mt-1 text-on-surface-variant">
                  Для <span className="font-semibold text-on-surface">{email}</span> доступ восстановит поддержка ФинКлик
                  в пилоте (чат или ответ на приглашение). Обычно в течение рабочего дня.
                </p>
              </div>
            </div>
            <Link to="/login" className="btn-primary inline-flex min-h-11 w-full items-center justify-center">
              Вернуться ко входу
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="label" htmlFor="reset-email">
                Эл. почта аккаунта
              </label>
              <input
                id="reset-email"
                type="email"
                className="input min-h-touch-min"
                placeholder="ivan@company.by"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary min-h-touch-min w-full">
              Оставить заявку
            </button>
          </form>
        )}

        {!sent && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-on-surface-variant">
            <StitchIcon name="arrow_back" className="text-base" />
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Вернуться ко входу
            </Link>
          </div>
        )}
      </AuthGlassCard>
    </AuthLayout>
  )
}
