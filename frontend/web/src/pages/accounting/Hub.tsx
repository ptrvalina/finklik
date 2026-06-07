import { Link } from 'react-router-dom'

const cards = [
  {
    to: '/accounting/journal',
    title: 'Журнал',
    desc: 'Операции, категории и проводки — из банка и сканов',
    icon: 'receipt_long',
  },
  {
    to: '/accounting/kudir',
    title: 'КУДиР',
    desc: 'Книга учёта доходов и расходов за год',
    icon: 'menu_book',
  },
  {
    to: '/reports',
    title: 'Отчёты',
    desc: 'Готовность данных и подача в ИМНС, ФСЗН и другие органы',
    icon: 'assignment_turned_in',
  },
] as const

export default function AccountingHub() {
  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-20 lg:pb-8">
      <div className="mb-6">
        <h1 className="page-heading">Учёт</h1>
        <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
          Журнал операций, книга доходов и расходов, подготовка отчётов. Сроки — в разделе «Календарь», деньги на счёте — в «Банке».
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="glass-card group flex flex-col gap-2 rounded-2xl p-5 transition hover:border-primary/40"
          >
            <span className="material-symbols-outlined text-3xl text-primary">{c.icon}</span>
            <h2 className="text-base font-semibold text-on-surface group-hover:text-primary">{c.title}</h2>
            <p className="text-sm text-on-surface-variant">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
