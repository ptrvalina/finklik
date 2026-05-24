import { Link } from 'react-router-dom'
import OperationalPage from '../../components/shell/OperationalPage'

const cards = [
  { to: 'hire', title: 'Приём сотрудников', desc: 'Анкета, приказ, ПУ-2, карточка', icon: 'person_add' },
  { to: 'dismiss', title: 'Увольнение сотрудников', desc: 'Приказ, причина по ТК РБ, групповой ПУ-2', icon: 'person_remove' },
  { to: 'timesheet', title: 'Табель учёта рабочего времени', desc: 'Месяц/год, учёт по нормам РБ', icon: 'calendar_month' },
  { to: 'planner', title: 'Планер', desc: 'ПУ-2, сроки документов, напоминания', icon: 'event_note' },
  { to: 'staffing', title: 'Штатное расписание', desc: 'Подразделения, оклады, надбавки', icon: 'account_tree' },
] as const

export default function EmployeesHub() {
  return (
    <OperationalPage
      eyebrow="Команда"
      title="Кадры и ФСЗН"
      description="Приём, табель, штатное расписание и кадровый планер — без лишних разделов ERP."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="card-elevated group flex flex-col gap-2 rounded-3xl p-5 shadow-card ring-1 ring-primary/[0.05] transition hover:border-primary/40"
          >
            <span className="material-symbols-outlined text-3xl text-primary">{c.icon}</span>
            <h2 className="text-lg font-semibold text-on-surface group-hover:text-primary">{c.title}</h2>
            <p className="text-sm text-on-surface-variant">{c.desc}</p>
          </Link>
        ))}
      </div>
    </OperationalPage>
  )
}
