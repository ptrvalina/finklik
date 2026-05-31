import { Link } from 'react-router-dom'
import { FocusStrip } from '../shell/FocusStrip'

type Props = {
  draftCount: number
  pendingOcr: number
  overdueCount: number
  daysLeft: number | null
  profileIncomplete?: boolean
}

/** Один доминирующий следующий шаг на главной. */
export default function DashboardFocusStrip({
  draftCount,
  pendingOcr,
  overdueCount,
  daysLeft,
  profileIncomplete,
}: Props) {
  if (profileIncomplete) {
    return (
      <FocusStrip
        headline="Завершите профиль бизнеса (ОКЭД и режим)"
        supporting="Это займёт около двух минут и настроит учёт под вашу отрасль."
        ctaLabel="Продолжить настройку"
        ctaTo="/onboarding/business-profile"
      />
    )
  }

  if (overdueCount > 0) {
    return (
      <FocusStrip
        tone="amber"
        headline={`${overdueCount} просроченных обязательств`}
        supporting="Сначала закройте критичные платежи и отчётность — иначе растёт риск штрафов."
        ctaLabel="К операциям"
        ctaTo="/operations"
      />
    )
  }

  if (pendingOcr > 0) {
    return (
      <FocusStrip
        headline={`${pendingOcr} ${pendingOcr === 1 ? 'документ ждёт' : 'документов ждут'} проверки OCR`}
        supporting="Подтвердите распознанные поля — система предложит проводки."
        ctaLabel="Открыть сканер"
        ctaTo="/scan"
      />
    )
  }

  if (draftCount > 0) {
    return (
      <FocusStrip
        headline={`${draftCount} ${draftCount === 1 ? 'черновик' : 'черновика'} в журнале`}
        supporting="Проведите операции — отчётность и прогноз станут точнее."
        ctaLabel="Открыть журнал"
        ctaTo="/accounting/journal"
      />
    )
  }

  if (daysLeft != null && daysLeft <= 7) {
    return (
      <FocusStrip
        tone="amber"
        headline={`До налогового дедлайна ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`}
        supporting="Проверьте начисления и подготовьте отчётность заранее."
        ctaLabel="Отчётность"
        ctaTo="/reports"
      />
    )
  }

  return (
    <FocusStrip
      tone="neutral"
      headline="Контур в порядке — можно работать спокойно"
      supporting="Сканируйте документы или добавьте операцию в журнал."
      ctaLabel="Что сделать сегодня"
      ctaTo="/operations"
    />
  )
}
