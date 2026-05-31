import { Link } from 'react-router-dom'

const cards = [
  { to: 'hire', title: 'Приём сотрудников', desc: 'Анкета, приказ, ПУ-2, карточка', icon: 'person_add' },
  { to: 'dismiss', title: 'Увольнение сотрудников', desc: 'Приказ, причина по ТК РБ, групповой ПУ-2', icon: 'person_remove' },
  { to: 'timesheet', title: 'Табель учёта рабочего времени', desc: 'Месяц/год, учёт по нормам РБ', icon: 'calendar_month' },
  { to: 'planner', title: 'Планер', desc: 'ПУ-2, сроки документов, напоминания', icon: 'event_note' },
  { to: 'staffing', title: 'Штатное расписание', desc: 'Подразделения, оклады, надбавки', icon: 'account_tree' },
] as const

export default function EmployeesHub() {
  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link to="/employees" className="btn-secondary text-sm">
          Сотрудники
        </Link>
        <Link to="/taxes" className="btn-primary text-sm">
          ФСЗН / налоги
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Разделы</p>
          <p className="mt-1 font-headline text-xl font-extrabold tabular-nums text-on-surface sm:text-2xl">{cards.length}</p>
          <p className="text-[11px] text-on-surface-variant">Кадровый контур</p>
        </div>
        <div className="glass-card rounded-2xl p-4 sm:col-span-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Команда</p>
          <p className="mt-1 text-sm font-semibold text-on-surface">Приём, табель, штатное расписание и планер</p>
          <p className="text-[11px] text-primary">Без лишних разделов ERP</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="glass-card group flex flex-col gap-2 rounded-2xl p-5 transition hover:border-primary/40"
          >
            <span className="material-symbols-outlined text-3xl text-primary">{c.icon}</span>
            <h2 className="text-lg font-semibold text-on-surface group-hover:text-primary">{c.title}</h2>
            <p className="text-sm text-on-surface-variant">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
