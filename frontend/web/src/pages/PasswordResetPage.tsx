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
            Укажите эл. почту — мы отправим ссылку для сброса пароля.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-tertiary-fixed/30 bg-tertiary-fixed/10 p-4 text-sm text-tertiary">
            <div className="flex items-start gap-2">
              <StitchIcon name="mark_email_read" className="text-xl" />
              <p>
                Если аккаунт с адресом <span className="font-semibold">{email}</span> существует, письмо уже отправлено.
                Проверьте входящие и папку «Спам».
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="label" htmlFor="reset-email">
                Эл. почта
              </label>
              <div className="relative">
                <StitchIcon name="alternate_email" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
                <input
                  id="reset-email"
                  type="email"
                  className="input pl-11"
                  placeholder="ivan@company.by"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" className="btn-primary min-h-touch-min w-full">
              Отправить ссылку
            </button>
          </form>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-on-surface-variant">
          <StitchIcon name="arrow_back" className="text-base" />
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Вернуться ко входу
          </Link>
        </div>
      </AuthGlassCard>

      <div className="mt-8 flex items-center justify-center gap-6 text-on-surface-variant/70">
        <div className="flex items-center gap-1.5 text-xs">
          <StitchIcon name="verified_user" className="text-sm text-tertiary" />
          Защищённое соединение
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <StitchIcon name="lock" className="text-sm text-tertiary" />
          Шифрование данных
        </div>
      </div>
    </AuthLayout>
  )
}
