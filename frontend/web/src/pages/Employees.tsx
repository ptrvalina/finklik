import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Employees() {
  const loc = useLocation()
  const subpage = /\/employees\/.+/.test(loc.pathname)

  return (
    <section className="space-y-6">
      <header className="card-elevated p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">Сотрудники</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Приём, увольнение, табель, планер напоминаний и штатное расписание.
            </p>
          </div>
          {subpage ? (
            <Link className="btn-secondary text-sm" to="..">
              ← Все разделы
            </Link>
          ) : null}
        </div>
      </header>
      <Outlet />
    </section>
  )
}
