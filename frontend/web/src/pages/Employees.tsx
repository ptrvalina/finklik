import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Employees() {
  const loc = useLocation()
  const subpage = /\/employees\/.+/.test(loc.pathname)

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {!subpage ? (
          <p className="text-sm text-on-surface-variant">
            Приём, увольнение, табель, планер и штатное расписание.
          </p>
        ) : (
          <Link className="btn-secondary text-sm" to="/employees">
            ← Все разделы кадров
          </Link>
        )}
        <Link to="/employees" className="btn-primary text-sm">
          Хаб кадров
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
