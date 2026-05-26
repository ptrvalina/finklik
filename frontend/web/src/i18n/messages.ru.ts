/** Calm UX — сообщения об ошибках и системные фразы. */
export const calmErrors = {
  genericAction:
    'Не удалось завершить действие. Данные не потеряны — попробуйте ещё раз или обновите страницу.',
  network:
    'Связь с сервером прервалась. Проверьте интернет и повторите попытку.',
  auth:
    'Сессия завершена. Войдите снова — ваши данные сохранены.',
  ocr:
    'Документ распознан частично. Проверьте поля, выделенные жёлтым, и подтвердите.',
  saveFailed:
    'Не удалось сохранить изменения. Черновик на сервере не обновлён.',
  chartLoad:
    'Не удалось загрузить план счетов. Обновите страницу или проверьте роль бухгалтера.',
  amortization:
    'Не удалось начислить амортизацию. Проверьте реестр ОС и закрытие периода.',
  reportingSubmit:
    'Не удалось отправить отчёт. Проверьте обязательные поля и повторите — черновик сохранён.',
  reportingAutopilot:
    'Автоподача не запустилась. Проверьте настройки и статус организации.',
  reportingDownload:
    'Не удалось скачать файл. Повторите или откройте заявку позже.',
} as const

/** Спокойное сообщение для toast/flash: detail с API или код из calmErrors. */
export function calmActionError(
  code: keyof typeof calmErrors,
  apiDetail?: string | null,
): string {
  const d = apiDetail?.trim()
  if (d && d.length > 0 && !/^error$/i.test(d) && !/^invalid$/i.test(d)) return d
  return calmErrors[code]
}

export function calmError(code: keyof typeof calmErrors): string {
  return calmErrors[code]
}
