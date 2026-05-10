import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Employees() {
  const loc = useLocation()
  const subpage = /\/employees\/.+/.test(loc.pathname)

  return (
    <section className="fc-page-shell fc-page-shell-asymmetric">
      <header className="fc-hero">
        <div className="fc-hero-strip" aria-hidden />
        <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-heading">HR и кадры</h1>
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
