import BynSymbol from './BynSymbol'
import { formatMoneyAmount } from '../../lib/formatMoney'

type Props = {
  value: number | string | null | undefined
  signed?: boolean
  /** Пустое / нечисловое значение → 0,00 + знак (для остатков на счетах). */
  emptyAsZero?: boolean
  /** Пустое значение → прочерк (без знака). */
  emptyDash?: boolean
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  className?: string
  symbolClassName?: string
}

/** Сумма + знак белорусского рубля. */
export default function MoneyAmount({
  value,
  signed,
  emptyAsZero,
  emptyDash,
  minimumFractionDigits,
  maximumFractionDigits,
  className = '',
  symbolClassName = 'h-[0.78em] w-[0.68em] shrink-0',
}: Props) {
  const amount = formatMoneyAmount(value, { signed, emptyAsZero, emptyDash, minimumFractionDigits, maximumFractionDigits })

  if (amount === '—') {
    return <span className={className}>—</span>
  }

  return (
    <span className={`inline-flex items-baseline gap-1 tabular-nums ${className}`}>
      <span>{amount}</span>
      <BynSymbol className={symbolClassName} />
    </span>
  )
}
