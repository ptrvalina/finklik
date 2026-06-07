import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Employees() {
  const { pathname } = useLocation()
  const isHub = pathname === '/employees' || pathname === '/employees/'
  const isListArea = pathname.startsWith('/employees/list') || pathname.startsWith('/employees/dossier')

  if (isHub) {
    return <Outlet />
  }

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-20 lg:pb-8">
      {!isListArea && (
        <div className="mb-3">
          <Link to="/employees" className="btn-ghost !px-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined align-middle text-base">arrow_back</span> Команда
          </Link>
        </div>
      )}
      <Outlet />
    </div>
  )
}
