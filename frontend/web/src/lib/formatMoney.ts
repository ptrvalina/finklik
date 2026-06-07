/** Форматирование сумм для UI (ru-BY). Знак рубля — компонент BynSymbol / MoneyAmount. */

export type FormatMoneyOpts = {
  signed?: boolean
  showCurrency?: boolean
  emptyAsZero?: boolean
  emptyDash?: boolean
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function formatMoneyAmount(
  value: number | string | null | undefined,
  opts?: Pick<
    FormatMoneyOpts,
    'signed' | 'emptyAsZero' | 'emptyDash' | 'minimumFractionDigits' | 'maximumFractionDigits'
  >,
): string {
  const raw = value ?? NaN
  let n = Number(raw)

  if (!Number.isFinite(n)) {
    if (opts?.emptyAsZero) n = 0
    else if (opts?.emptyDash) return '—'
    else return '—'
  }

  const minFrac = opts?.minimumFractionDigits ?? 2
  const maxFrac = opts?.maximumFractionDigits ?? 2
  const abs = Math.abs(n)
  const body = abs.toLocaleString('ru-BY', { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac })
  if (opts?.signed && n > 0) return `+${body}`
  if (opts?.signed && n < 0) return `−${body}`
  if (n < 0) return `−${body}`
  return body
}

/** Строка суммы без знака валюты (для подписей и aria). */
export function formatMoney(
  value: number | string | null | undefined,
  opts?: FormatMoneyOpts,
): string {
  if (opts?.showCurrency === false) {
    return formatMoneyAmount(value, opts)
  }
  return formatMoneyAmount(value, opts)
}
