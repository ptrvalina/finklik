import { formatMoney } from './formatMoney'

type Obligation = { id: string; obligation_type: string; amount: string; due_date: string; status?: string }
type TaxEvent = { title: string; event_date: string; event_type?: string }
type Metrics = {
  next_tax_deadline?: string | null
  tax_usn_quarter?: number | string
  tax_vat_month?: number | string
  tax_fsszn_quarter?: number | string
}

const OBLIGATION_RU: Record<string, string> = {
  tax: 'Налог',
  invoice: 'Счёт к оплате',
  salary: 'Зарплата',
  rent: 'Аренда',
}

function amountForTaxTitle(title: string, metrics?: Metrics): number | null {
  if (!metrics) return null
  const t = title.toLowerCase()
  if (t.includes('усн')) return Number(metrics.tax_usn_quarter) || null
  if (t.includes('ндс') || t.includes('vat')) return Number(metrics.tax_vat_month) || null
  if (t.includes('фсзн') || t.includes('fsszn')) return Number(metrics.tax_fsszn_quarter) || null
  return null
}

export type NextTaxDisplay = {
  name: string
  amount: string | null
  dueDate: string
}

/** Ближайшее налоговое обязательство: название + сумма + срок (не дата без контекста). */
export function pickNextTaxObligation(
  obligations: Obligation[] | undefined,
  metrics: Metrics | undefined,
  taxEvents: TaxEvent[] | undefined,
): NextTaxDisplay | null {
  const today = new Date().toISOString().slice(0, 10)

  const pending = (obligations ?? [])
    .filter((o) => o.status !== 'paid' && o.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  const taxOb = pending.find((o) => o.obligation_type === 'tax') ?? pending[0]
  if (taxOb) {
    return {
      name: OBLIGATION_RU[taxOb.obligation_type] ?? taxOb.obligation_type,
      amount: formatMoney(taxOb.amount, { showCurrency: true }),
      dueDate: taxOb.due_date,
    }
  }

  const deadline = metrics?.next_tax_deadline
  if (deadline) {
    const match = (taxEvents ?? [])
      .filter((e) => e.event_date === deadline || e.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .find((e) => e.event_date === deadline) ??
      (taxEvents ?? [])
        .filter((e) => e.event_date >= today)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))[0]

    const title = match?.title ?? 'Налог к уплате'
    const rawAmount = amountForTaxTitle(title, metrics)
    return {
      name: title,
      amount: rawAmount != null && rawAmount > 0 ? formatMoney(rawAmount) : null,
      dueDate: deadline,
    }
  }

  const nextEvent = (taxEvents ?? [])
    .filter((e) => e.event_date >= today && (e.event_type === 'tax' || e.event_type === 'deadline' || e.event_type === 'report'))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0]

  if (nextEvent) {
    const rawAmount = amountForTaxTitle(nextEvent.title, metrics)
    return {
      name: nextEvent.title,
      amount: rawAmount != null && rawAmount > 0 ? formatMoney(rawAmount) : null,
      dueDate: nextEvent.event_date,
    }
  }

  return null
}
