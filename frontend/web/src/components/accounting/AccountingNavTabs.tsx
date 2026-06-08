import { NavLink } from 'react-router-dom'
import { getAccountingNav } from '../../pages/accounting/accountingNav'
import { useProductContour } from '../../hooks/useProductContour'

/** Единые вкладки раздела «Учёт» — пользователь всегда видит, где он и куда перейти. */
export default function AccountingNavTabs() {
  const { contour } = useProductContour()
  const tabs = getAccountingNav(contour)

  return (
    <nav
      className="mb-5 -mx-1 overflow-x-auto pb-1"
      aria-label="Раздел учёта"
    >
      <div className="flex min-w-max gap-1 rounded-2xl border border-outline/35 bg-surface/90 p-1">
        {tabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.description}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                isActive
                  ? 'bg-primary text-primary-on shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined text-base sm:text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
