import { useEffect, useState, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { ALL_NAV_ITEMS, flattenNavForSheetWithAssistant, MOBILE_BAR_ITEMS } from './navConfig'

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  )
}

function pathActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { connected, notifications, dismissNotification } = useWebSocket()
  const [moreOpen, setMoreOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen && !searchOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [moreOpen, searchOpen])

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  function handleLogout() {
    setUserOpen(false)
    logout()
    navigate('/login')
  }

  const roleLabel =
    user?.role === 'owner' ? 'Владелец' : user?.role === 'accountant' ? 'Бухгалтер' : user?.role === 'viewer' ? 'Наблюдатель' : user?.role

  return (
    <div className="flex h-[100dvh] bg-[#070a10] text-on-surface font-body">
      {/* Desktop sidebar — нейтральный «премиум» контур */}
      <aside className="hidden lg:flex h-full w-[260px] flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0d14]">
        <div className="px-5 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400/20 to-cyan-500/10 ring-1 ring-white/10">
              <Icon name="account_balance" className="text-xl text-teal-300" filled />
            </div>
            <div className="min-w-0">
              <h1 className="font-headline text-lg font-bold tracking-tight text-white">ФинКлик</h1>
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                {user?.org_name || 'Организация'}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <nav className="space-y-0.5">
          {ALL_NAV_ITEMS.map((item) => {
            const { to, label, icon, end, flyout } = item
            const active =
              pathActive(location.pathname, to, end) ||
              (flyout?.some((c) => pathActive(location.pathname, c.to, true)) ?? false)
            if (flyout?.length) {
              return (
                <div key={to} className="group relative">
                  <NavLink
                    to={to}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-headline text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white/[0.07] text-white shadow-sm ring-1 ring-white/[0.06]'
                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                    }`}
                  >
                    <Icon name={icon} filled={active} className="text-[22px] opacity-90" />
                    <span>{label}</span>
                    <Icon
                      name="expand_more"
                      className={`ml-auto text-lg transition-transform duration-150 ${active ? 'text-teal-400/90 rotate-180' : 'text-zinc-500 group-hover:rotate-180'}`}
                    />
                  </NavLink>
                  <div
                    className="pointer-events-none invisible absolute inset-x-0 top-full z-50 mt-1 rounded-xl border border-white/[0.08] bg-[#12161f] py-1.5 opacity-0 shadow-2xl ring-1 ring-black/40 transition-all duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100"
                    role="menu"
                    aria-label={`${label}: подразделы`}
                  >
                    {flyout.map((c) => {
                      const subActive = pathActive(location.pathname, c.to, true)
                      return (
                        <NavLink
                          key={c.to}
                          to={c.to}
                          role="menuitem"
                          className={`block px-3 py-2 text-sm font-medium transition-colors ${
                            subActive ? 'bg-teal-500/15 text-teal-200' : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                          }`}
                        >
                          {c.label}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              )
            }
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-headline text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/[0.07] text-white shadow-sm ring-1 ring-white/[0.06]'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <Icon name={icon} filled={active} className="text-[22px] opacity-90" />
                <span>{label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden />}
              </NavLink>
            )
          })}
          </nav>
        </div>

        <div className="flex justify-center border-t border-white/[0.06] p-3">
          <NavLink
            to="/assistant"
            title="Консультант"
            aria-label="Консультант"
            className={({ isActive }) =>
              `tap-highlight-none flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-white/[0.06] transition-colors ${
                isActive
                  ? 'bg-violet-500/15 text-teal-200 ring-violet-500/30'
                  : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08]'
              }`
            }
          >
            {({ isActive }) => <Icon name="smart_toy" filled={isActive} className="text-[20px]" />}
          </NavLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 flex-shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#070a10]/90 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 shrink-0 items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
                <Icon name="account_balance" className="text-lg text-teal-300" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-headline text-sm font-bold text-white">ФинКлик</p>
                <p className="truncate text-[10px] text-zinc-500">{user?.org_name}</p>
              </div>
            </div>

            <NavLink
              to="/scanner"
              end
              title="Сканировать"
              aria-label="Сканировать"
              className={({ isActive }) =>
                `tap-highlight-none flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/[0.06] transition-colors sm:h-10 sm:w-10 ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-200 ring-teal-500/35'
                    : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08] hover:text-zinc-100'
                }`
              }
            >
              {({ isActive }) => <Icon name="document_scanner" filled={isActive} className="text-[20px] sm:text-[22px]" />}
            </NavLink>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-400 sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              {connected ? 'Онлайн' : 'Офлайн'}
            </div>
            <button
              type="button"
              className="tap-highlight-none relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300 ring-1 ring-white/[0.06] sm:h-11 sm:w-11"
              aria-label="Уведомления"
            >
              <Icon name="notifications" className="text-xl" />
              {notifications.length > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal-400 ring-2 ring-[#070a10]" />
              )}
            </button>
            <button
              type="button"
              className={`tap-highlight-none flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-white/[0.06] sm:h-11 sm:w-11 ${
                searchOpen ? 'bg-teal-500/15 text-teal-300 ring-teal-500/30' : 'bg-white/[0.05] text-zinc-300'
              }`}
              aria-label={searchOpen ? 'Закрыть поиск' : 'Поиск'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Icon name="search" className="text-xl" />
            </button>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 text-sm font-bold text-white ring-1 ring-white/10 sm:h-11 sm:w-11"
                aria-expanded={userOpen}
                aria-haspopup="true"
              >
                {(user?.full_name || '?').slice(0, 1).toUpperCase()}
              </button>
              {userOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/[0.08] bg-[#12161f] py-2 shadow-2xl ring-1 ring-black/40">
                  <div className="border-b border-white/[0.06] px-3 pb-2">
                    <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
                    <p className="truncate text-xs text-zinc-500">{user?.email}</p>
                    <p className="truncate text-[11px] text-zinc-600">{roleLabel}</p>
                  </div>
                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05]"
                    onClick={() => setUserOpen(false)}
                  >
                    <Icon name="settings" className="text-lg" />
                    Настройки и команда
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10"
                  >
                    <Icon name="logout" className="text-lg" />
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile expanded search */}
        {searchOpen && (
          <div className="border-b border-white/[0.06] bg-[#0a0d14] px-4 py-3">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                autoFocus
                type="search"
                placeholder="Найти… Enter — операции"
                className="input h-11 w-full rounded-xl bg-white/[0.06] pl-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchOpen(false)
                    navigate('/transactions')
                  }
                }}
              />
            </div>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="space-y-2 px-4 pt-3 sm:px-6 lg:px-8">
            {notifications.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3 text-sm"
              >
                <span className="min-w-0 text-on-surface">
                  <span className="font-bold text-teal-300">{n.event}:</span>{' '}
                  <span className="text-zinc-300">
                    {typeof n.data === 'object' ? JSON.stringify(n.data) : String(n.data)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => dismissNotification(n.id)}
                  className="tap-highlight-none ml-2 flex-shrink-0 text-zinc-500 hover:text-white"
                  aria-label="Закрыть"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </div>
            ))}
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="mx-auto max-w-[1600px] px-4 py-5 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom bar + «Все сервисы» */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[70] border-t border-white/[0.08] bg-[#0a0d14]/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
        aria-label="Основная навигация"
      >
        <div className="mx-auto flex max-w-lg items-end justify-between gap-0.5 px-0.5 pt-1">
          {MOBILE_BAR_ITEMS.map(({ to, label, icon, end }) => {
            const active = pathActive(location.pathname, to, end)
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={`tap-highlight-none flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1.5 pt-2 ${
                  active ? 'text-teal-300' : 'text-zinc-500'
                }`}
              >
                <Icon name={icon} filled={active} className="text-[22px]" />
                <span className="max-w-[3.25rem] truncate text-[9px] font-semibold sm:max-w-[4rem] sm:text-[10px]">{label}</span>
              </NavLink>
            )
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`tap-highlight-none flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1.5 pt-2 ${
              moreOpen ? 'text-teal-300' : 'text-zinc-500'
            }`}
          >
            <Icon name="apps" className="text-[24px]" />
            <span className="text-[10px] font-semibold">Сервисы</span>
          </button>
        </div>
      </nav>

      {/* Super-app sheet: все разделы */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[80] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Все сервисы"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Закрыть"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[1.25rem] border border-white/[0.08] bg-[#0f1219] shadow-2xl motion-safe:transition-transform">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="font-headline text-base font-bold text-white">Сервисы</p>
                <p className="text-xs text-zinc-500">Все разделы ФинКлик</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300"
                aria-label="Закрыть"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>
            <div className="grid max-h-[calc(88vh-4rem)] grid-cols-3 gap-2 overflow-y-auto p-4 sm:grid-cols-4">
              {flattenNavForSheetWithAssistant(ALL_NAV_ITEMS).map(({ to, label, icon, end, description }) => {
                const active = pathActive(location.pathname, to, end)
                return (
                  <NavLink
                    key={to + label}
                    to={to}
                    end={end}
                    onClick={() => setMoreOpen(false)}
                    className={`tap-highlight-none flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors ${
                      active
                        ? 'bg-teal-500/15 ring-1 ring-teal-500/30'
                        : 'bg-white/[0.03] ring-1 ring-white/[0.05] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        active ? 'bg-teal-500/20 text-teal-300' : 'bg-white/[0.06] text-zinc-300'
                      }`}
                    >
                      <Icon name={icon} filled={active} className="text-[26px]" />
                    </div>
                    <span className="text-[11px] font-bold leading-tight text-white">{label}</span>
                    {description && <span className="line-clamp-2 text-[9px] leading-tight text-zinc-500">{description}</span>}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
