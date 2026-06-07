import BynSymbol from './BynSymbol'

/** Подпись поля с символом рубля, напр. «Сумма (₽)». */
export function CurrencyFieldLabel({ children = 'Сумма' }: { children?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children} (<BynSymbol className="inline-block h-[0.85em] w-[0.72em]" />)
    </span>
  )
}
