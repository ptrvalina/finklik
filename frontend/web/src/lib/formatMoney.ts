/** Единый формат денег для UI: ru-BY + BYN. */
export function formatMoney(
  value: number | string | null | undefined,
  opts?: { signed?: boolean; showCurrency?: boolean },
): string {
  const n = Number(value ?? NaN)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const body = abs.toLocaleString('ru-BY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const signed =
    opts?.signed && n > 0 ? `+${body}` : opts?.signed && n < 0 ? `−${body}` : n < 0 ? `−${body}` : body
  if (opts?.showCurrency === false) return signed
  return `${signed} BYN`
}
