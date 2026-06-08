import { Link } from 'react-router-dom'

const cards = [
  { to: 'documents', title: 'Документы', desc: 'Приказы о приёме, увольнении и отпусках', icon: 'description' },
  { to: 'labor-book', title: 'Книга учёта движения трудовых книжек', desc: 'Записи о приёме, переводе и увольнении', icon: 'menu_book' },
  { to: 'timesheet', title: 'Табель', desc: 'Учёт рабочего времени, связь с приказами об отпуске', icon: 'calendar_month' },
  { to: 'hire', title: 'Приём сотрудников', desc: 'Анкета, приказ, ПУ-2, карточка', icon: 'person_add' },
  { to: 'dismiss', title: 'Увольнение', desc: 'Приказ и основание по ТК РБ', icon: 'person_remove' },
  { to: 'staffing', title: 'Штатное расписание', desc: 'Должности, оклады, подразделения', icon: 'account_tree' },
] as const

const externalCards = [{ to: '/planner', title: 'Задачи команды', desc: 'Поручения бухгалтеру и менеджерам', icon: 'task_alt' }] as const

export default function EmployeesHub() {
  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-20 lg:pb-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-heading">Команда</h1>
          <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
            Кадровые процессы: документы, трудовые книжки, табель и штатное расписание.
          </p>
        </div>
        <Link to="/employees/list" className="btn-primary text-sm w-full sm:w-auto">
          <span className="material-symbols-outlined align-middle text-lg">groups</span> Сотрудники
        </Link>
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
        {externalCards.map((c) => (
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
