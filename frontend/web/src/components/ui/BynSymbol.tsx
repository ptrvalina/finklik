/** Официальный знак белорусского рубля (стилизованная «Б»). */
export default function BynSymbol({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M5 2.5V21.5M5 2.5H15.5M2.5 17H8.5M15.5 2.5Q15.5 21.5 5 21.5"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  )
}
