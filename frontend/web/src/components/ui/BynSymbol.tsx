/** Знак белорусского рубля — кириллическая «Б» с горизонтальным перечёркиванием у основания. */
export default function BynSymbol({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 18 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      {/* Вертикальный стержень «Б» */}
      <path d="M4 2v20h3V2H4z" />
      {/* Верхняя перекладина */}
      <path d="M4 2h10v3H4V2z" />
      {/* Нижняя полукруглая чаша */}
      <path d="M7 11.5c5.5-.3 8 2.2 8 5.8 0 3.2-2.5 5.2-8 5.7V11.5z" />
      {/* Перечёркивание у основания стержня */}
      <path d="M1.5 16.25h7.25v2.5H1.5z" />
    </svg>
  )
}
