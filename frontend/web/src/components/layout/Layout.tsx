import { useEffect, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useToastStack } from '../../hooks/useToastStack'
import { formatReportStatusToast } from '../../utils/formatReportStatusToast'
import ToastStack from '../ui/ToastStack'
import { notificationsApi } from '../../api/client'
import {
  ASSISTANT_SHEET_ITEM,
  flattenNavForSheet,
  getMobileBarItemsForRole,
  getNavGroupsForRole,
  type NavItem,
} from './navConfig'
import OrgSwitcher from '../workspace/OrgSwitcher'
import BusinessProfileBanner from '../onboarding/BusinessProfileBanner'
import NetworkStatusBanner from './NetworkStatusBanner'
import { useOperational } from '../../context/OperationalContext'
import OperationalContinuityPanel from '../operations/OperationalContinuityPanel'

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
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const { connected, notifications, dismissNotification } = useWebSocket()
  const { toasts, addToast, dismissToast } = useToastStack()
  const reportToastHandled = useRef(new Set<string>())
  const [moreOpen, setMoreOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)
  const role = (user?.role || '').toLowerCase()
  const isManager = role === 'manager'
  const navGroups = getNavGroupsForRole(role)
  const mobileBarItems = getMobileBarItemsForRole(role)
  const { data: plannerNotifications = [] } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(20).then((r) => r.data ?? []),
  })
  const unreadCount = plannerNotifications.filter((n: any) => !n.is_read).length
  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const { hasAnchors, panelOpen, setPanelOpen } = useOperational()

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
    for (const n of notifications) {
      if (n.event !== 'report_status') continue
      if (reportToastHandled.current.has(n.id)) continue
      reportToastHandled.current.add(n.id)
      const formatted = formatReportStatusToast(n.data)
      addToast({
        title: formatted.title,
        body: formatted.body,
        variant: formatted.variant,
      })
      void qc.invalidateQueries({ queryKey: ['submissions'] })
    }
  }, [notifications, addToast, qc])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (location.pathname.startsWith('/accounting')) return
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [location.pathname])

  const bannerNotifications = notifications.filter((n) => n.event !== 'report_status')

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserOpen(false)
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  async function handleLogout() {
    setUserOpen(false)
    await logout()
    navigate('/login')
  }

  const roleLabel =
    user?.role === 'owner' ? 'Владелец' : user?.role === 'accountant' ? 'Бухгалтер' : user?.role === 'viewer' ? 'Наблюдатель' : user?.role

  function renderSidebarItems(items: NavItem[]) {
    return items.map((item) => {
      const { to, label, icon, end, flyout } = item
      const active =
        pathActive(location.pathname, to, end) || (flyout?.some((c) => pathActive(location.pathname, c.to, true)) ?? false)
      if (flyout?.length) {
        return (
          <div key={to} className="group relative">
            <NavLink
              to={to}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 font-headline text-[13px] font-medium transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                active
                  ? 'bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(110,231,183,0.28),0_10px_36px_-16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/35'
                  : 'text-white/55 hover:bg-white/[0.07] hover:text-white hover:shadow-[0_6px_24px_-12px_rgba(0,0,0,0.35)]'
              }`}
            >
              <Icon name={icon} filled={active} className="text-[22px] opacity-95" />
              <span>{label}</span>
              <Icon
                name="expand_more"
                className={`ml-auto text-lg transition-transform duration-150 ${active ? 'text-emerald-200 rotate-180' : 'text-white/35 group-hover:rotate-180'}`}
              />
            </NavLink>
            <div
              className="pointer-events-none invisible absolute inset-x-0 top-full z-50 mt-1.5 rounded-2xl border border-white/10 bg-[#061f1c]/95 py-1.5 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-200 ease-smooth group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100"
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
                      subActive ? 'bg-emerald-500/15 text-emerald-200' : 'text-white/75 hover:bg-white/[0.06] hover:text-white'
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
          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 font-headline text-[13px] font-medium transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            active
              ? 'bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(110,231,183,0.28),0_10px_36px_-16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/35'
              : 'text-white/55 hover:bg-white/[0.07] hover:text-white hover:shadow-[0_6px_24px_-12px_rgba(0,0,0,0.35)]'
          }`}
        >
          <Icon name={icon} filled={active} className="text-[22px] opacity-95" />
          <span>{label}</span>
          {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" aria-hidden />}
        </NavLink>
      )
    })
  }

  return (
    <div className="app-safe-x flex h-[100dvh] bg-canvas text-on-surface font-body antialiased" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Desktop sidebar — floating glass rail */}
      <aside className="fc-sidebar-glass relative hidden h-full w-[280px] flex-shrink-0 flex-col overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_100%_70%_at_0%_-5%,rgba(16,185,129,0.22),transparent_52%)] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gradient-to-b after:from-emerald-400/35 after:via-white/8 after:to-transparent lg:flex">
        <div className="relative z-[1] px-6 pb-6 pt-9">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/30 via-primary/20 to-white/5 shadow-lg ring-1 ring-white/15">
              <Icon name="account_balance" className="text-[24px] text-emerald-200" filled />
            </div>
            <div className="min-w-0">
              <h1 className="font-headline text-[1.0625rem] font-bold tracking-tight text-white" style={{ letterSpacing: '-0.03em' }}>
                ФинКлик
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/95">Premium</p>
              <p className="truncate text-[11px] text-white/50">{user?.org_name || 'Организация'}</p>
              <div className="mt-2">
                <OrgSwitcher placement="sidebar" />
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.id}>
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{group.label}</p>
                <nav className="space-y-1">{renderSidebarItems(group.items)}</nav>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-[1] mt-auto border-t border-white/10 bg-black/15 px-4 py-4 backdrop-blur-md">
          {!isManager && (
            <NavLink
              to="/assistant"
              title="Консультант"
              aria-label="Консультант"
              className={({ isActive }) =>
                `tap-highlight-none mb-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 font-headline text-[13px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35'
                    : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name="smart_toy" filled={isActive} className="text-[22px]" />
                  <span>Консультант</span>
                </>
              )}
            </NavLink>
          )}
          <div className="flex items-center gap-3 rounded-2xl px-1 py-1">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dim text-sm font-bold text-white shadow-glow ring-2 ring-white/10">
              {(user?.full_name || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-headline text-sm font-semibold text-white">{user?.full_name || 'Профиль'}</p>
              <p className="truncate text-[11px] text-white/45">{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 flex-shrink-0 items-center gap-2 border-b border-outline/45 bg-surface/88 px-3 shadow-soft backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-surface/72 dark:border-white/[0.06] dark:bg-[rgb(var(--color-surface)/0.88)] dark:shadow-none dark:supports-[backdrop-filter]:bg-[rgb(var(--color-surface)/0.78)] sm:h-16 sm:gap-3 sm:px-6 lg:top-4 lg:mx-5 lg:mb-1 lg:rounded-[1.5rem] lg:border lg:border-white/10 lg:bg-surface/75 lg:px-7 lg:shadow-float lg:backdrop-blur-2xl lg:dark:border-white/[0.08] lg:dark:bg-[rgb(var(--color-surface)/0.55)]">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 shrink-0 items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#053028] to-[#062f29] ring-1 ring-emerald-500/25 shadow-soft">
                <Icon name="account_balance" className="text-lg text-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-headline text-sm font-bold text-on-surface">ФинКлик</p>
                <p className="truncate text-[10px] text-on-surface-variant">{user?.org_name}</p>
              </div>
              <OrgSwitcher placement="header" className="min-w-0 flex-shrink" />
            </div>

            <NavLink
              to="/scan"
              end
              title="Сканировать"
              aria-label="Сканировать"
              className={({ isActive }) =>
                `tap-highlight-none flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-outline/75 transition-colors sm:h-10 sm:w-10 ${
                  isActive
                    ? 'bg-primary/10 text-primary ring-primary/25'
                    : 'bg-surface-container-low text-on-surface-variant shadow-soft hover:bg-surface hover:text-on-surface dark:text-on-surface-variant dark:hover:text-on-surface'
                }`
              }
            >
              {({ isActive }) => <Icon name="document_scanner" filled={isActive} className="text-[20px] sm:text-[22px]" />}
            </NavLink>

            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="group hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-outline/60 bg-surface-container-low/80 px-4 py-2.5 text-left text-sm text-on-surface-variant shadow-xs transition hover:border-primary/25 hover:bg-surface lg:flex"
              aria-label="Глобальный поиск по разделам"
            >
              <Icon name="search" className="text-lg text-primary/60 group-hover:text-primary" />
              <span className="truncate">Поиск операций, действий и подсказок…</span>
              <span className="ml-auto rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-semibold text-on-surface-variant/80 ring-1 ring-outline/70">Ctrl + K</span>
            </button>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {hasAnchors && (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="tap-highlight-none hidden min-h-10 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-bold text-primary sm:inline-flex xl:hidden"
                aria-label="Контекст работы"
              >
                <Icon name="playlist_play" className="text-lg" />
                В работе
              </button>
            )}
            <div className="hidden items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1.5 text-[11px] font-semibold text-primary shadow-xs dark:border-primary/30 dark:bg-primary/10 dark:text-emerald-300 sm:flex">
              <span className={`h-2 w-2 rounded-full shadow-[0_0_0_3px_rgb(0_168_107/0.28)] ${connected ? 'bg-primary' : 'bg-on-surface-variant/50 shadow-none'}`} />
              {connected ? 'Онлайн' : 'Офлайн'}
            </div>
            {/* Колокольчик + тема */}
            <div className="relative flex items-center gap-0.5 rounded-2xl border border-outline/60 bg-surface/95 p-1 shadow-card backdrop-blur-md dark:border-outline/45 dark:bg-surface/90 sm:gap-1 sm:p-1.5" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="tap-highlight-none relative flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface hover:text-on-surface sm:h-10 sm:w-10 dark:text-on-surface-variant"
                aria-label="Уведомления"
              >
                <Icon name="notifications" className="text-xl" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-canvas dark:ring-outline/50 sm:right-1.5 sm:top-1.5" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-outline/70 bg-surface p-2 shadow-lift dark:bg-surface">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-sm font-semibold">Уведомления</p>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline disabled:opacity-60"
                      onClick={() => markAllReadMutation.mutate()}
                      disabled={unreadCount === 0 || markAllReadMutation.isPending}
                    >
                      Прочитать все
                    </button>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    {plannerNotifications.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-on-surface-variant">Нет уведомлений</p>
                    ) : (
                      plannerNotifications.map((n: any) => (
                        <button
                          type="button"
                          key={n.id}
                          className={`mb-1 w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-container-low ${n.is_read ? 'opacity-70' : ''}`}
                          onClick={() => {
                            if (!n.is_read) markReadMutation.mutate(n.id)
                            navigate('/planner')
                            setNotifOpen(false)
                          }}
                        >
                          <p className="font-medium">{n.message}</p>
                          <p className="text-xs text-on-surface-variant">{new Date(n.created_at).toLocaleString('ru-RU')}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              <span className="hidden h-6 w-px bg-outline/90 dark:bg-outline-variant sm:block" aria-hidden />
              <button
                type="button"
                onClick={toggleTheme}
                className="tap-highlight-none flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface hover:text-on-surface sm:h-10 sm:w-10 dark:text-on-surface-variant dark:hover:text-on-surface"
                aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              >
                <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-xl" />
              </button>
            </div>
            <button
              type="button"
              className={`tap-highlight-none flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-outline/75 sm:h-11 sm:w-11 dark:border-outline/45 ${
                searchOpen ? 'bg-primary/10 text-primary ring-2 ring-primary/20' : 'bg-surface-container-low text-on-surface-variant shadow-soft hover:bg-surface dark:text-on-surface-variant'
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
                className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dim text-sm font-bold text-on-primary shadow-glow ring-1 ring-white/20 sm:h-11 sm:w-11 dark:ring-primary/30"
                aria-expanded={userOpen}
                aria-haspopup="true"
              >
                {(user?.full_name || '?').slice(0, 1).toUpperCase()}
              </button>
              {userOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-outline/90 bg-surface/98 py-2 shadow-lift backdrop-blur-xl dark:border-outline/45 dark:bg-surface/98">
                  <div className="border-b border-outline/55 px-3 pb-2 dark:border-outline/35">
                    <p className="truncate text-sm font-semibold text-on-surface">{user?.full_name}</p>
                    <p className="truncate text-xs text-on-surface-variant">{user?.email}</p>
                    <p className="truncate text-[11px] text-on-surface-variant">{roleLabel}</p>
                  </div>
                  {!isManager && (
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-low dark:hover:bg-surface-container-high"
                      onClick={() => setUserOpen(false)}
                    >
                      <Icon name="settings" className="text-lg" />
                      Настройки и команда
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
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
          <div className="border-b border-outline/75 bg-surface-container-low/95 px-4 py-3 dark:border-outline/35/80">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                autoFocus
                type="search"
                placeholder="Найти… Enter — операции"
                className="input h-11 w-full rounded-xl pl-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchOpen(false)
                    navigate('/accounting/journal')
                  }
                }}
              />
            </div>
          </div>
        )}

        {bannerNotifications.length > 0 && (
          <div className="space-y-2 px-4 pt-3 sm:px-6 lg:px-8">
            {bannerNotifications.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm shadow-soft"
              >
                <span className="min-w-0 text-on-surface">
                  <span className="font-bold text-primary">{n.event}:</span>{' '}
                  <span className="text-on-surface-variant dark:text-on-surface-variant">
                    {typeof n.data === 'object' ? JSON.stringify(n.data) : String(n.data)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => dismissNotification(n.id)}
                  className="tap-highlight-none ml-2 flex-shrink-0 text-on-surface-variant hover:text-on-surface"
                  aria-label="Закрыть"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <main className="fc-main-atmosphere min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
            <div className="relative z-[1] mx-auto max-w-[1440px] px-4 py-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-7 sm:pb-28 lg:px-8 lg:py-9 lg:pb-10">
              <NetworkStatusBanner />
              <BusinessProfileBanner />
              <Outlet />
            </div>
          </main>
          <OperationalContinuityPanel variant="rail" />
        </div>
      </div>

      {panelOpen && hasAnchors && (
        <>
          <button
            type="button"
            className="fc-modal-backdrop fixed inset-0 z-[83] xl:hidden"
            aria-label="Закрыть контекст"
            onClick={() => setPanelOpen(false)}
          />
          <div className="xl:hidden">
            <OperationalContinuityPanel variant="drawer" />
          </div>
        </>
      )}

      {/* Mobile bottom bar + «Все сервисы» */}
      <nav
        className="fixed bottom-3 left-3 right-3 z-[70] mx-auto max-w-lg rounded-[1.5rem] border border-white/12 bg-surface/88 pb-[max(env(safe-area-inset-bottom,0px),10px)] pt-1.5 shadow-float backdrop-blur-2xl supports-[backdrop-filter]:bg-surface/78 dark:border-white/[0.08] dark:bg-[rgb(var(--color-surface)/0.82)] dark:shadow-[0_-24px_64px_-20px_rgba(0,0,0,0.55)] lg:hidden"
        aria-label="Основная навигация"
      >
        <div className="mx-auto flex max-w-lg items-end justify-between gap-0.5 px-1 pt-0.5">
          {mobileBarItems.map(({ to, label, icon, end }) => {
            const active = pathActive(location.pathname, to, end)
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={`tap-highlight-none flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1.5 pt-2 transition ${
                  active ? 'text-primary drop-shadow-[0_0_14px_rgba(16,185,129,0.45)]' : 'text-on-surface-variant'
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
            className={`tap-highlight-none flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-end gap-0.5 pb-1.5 pt-2 ${
              moreOpen ? 'text-primary' : 'text-on-surface-variant'
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
            className="absolute inset-0 bg-[#021e1c]/30 backdrop-blur-sm"
            aria-label="Закрыть"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[1.25rem] border border-outline/80 bg-surface shadow-lift motion-safe:transition-transform dark:border-outline/45">
            <div className="flex items-center justify-between border-b border-outline/55 px-5 py-4 dark:border-outline/35">
              <div>
                <p className="font-headline text-base font-bold text-on-surface">Сервисы</p>
                <p className="text-xs text-on-surface-variant">Все разделы ФинКлик</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="tap-highlight-none flex h-10 w-10 items-center justify-center rounded-full border border-outline/75 bg-surface-container-low text-on-surface-variant hover:bg-surface dark:border-outline/45 dark:text-on-surface-variant"
                aria-label="Закрыть"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>
            <div className="max-h-[calc(88vh-4rem)] space-y-5 overflow-y-auto p-4">
              {navGroups.map((group) => (
                <div key={`sheet-${group.id}`}>
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{group.label}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {flattenNavForSheet(group.items).map(({ to, label, icon, end, description }) => {
                      const active = pathActive(location.pathname, to, end)
                      return (
                        <NavLink
                          key={`${group.id}-${to}-${label}`}
                          to={to}
                          end={end}
                          onClick={() => setMoreOpen(false)}
                          className={`tap-highlight-none flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors ${
                            active
                              ? 'bg-primary/8 ring-1 ring-primary/25 shadow-soft'
                              : 'border border-outline/70 bg-surface-container-low/80 hover:bg-surface hover:shadow-soft dark:border-outline/40'
                          }`}
                        >
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                              active ? 'bg-primary/12 text-primary' : 'bg-surface text-on-surface-variant ring-1 ring-outline/75 dark:text-on-surface-variant dark:ring-outline/45'
                            }`}
                          >
                            <Icon name={icon} filled={active} className="text-[26px]" />
                          </div>
                          <span className="text-[11px] font-bold leading-tight text-on-surface">{label}</span>
                          {description && <span className="line-clamp-2 text-[9px] leading-tight text-on-surface-variant">{description}</span>}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              ))}
              {!isManager && (
                <div>
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">ИИ</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {[ASSISTANT_SHEET_ITEM].map(({ to, label, icon, end, description }) => {
                      const active = pathActive(location.pathname, to, end)
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          onClick={() => setMoreOpen(false)}
                          className={`tap-highlight-none flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors ${
                            active
                              ? 'bg-primary/8 ring-1 ring-primary/25 shadow-soft'
                              : 'border border-outline/70 bg-surface-container-low/80 hover:bg-surface hover:shadow-soft dark:border-outline/40'
                          }`}
                        >
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                              active ? 'bg-primary/12 text-primary' : 'bg-surface text-on-surface-variant ring-1 ring-outline/75 dark:text-on-surface-variant dark:ring-outline/45'
                            }`}
                          >
                            <Icon name={icon} filled={active} className="text-[26px]" />
                          </div>
                          <span className="text-[11px] font-bold leading-tight text-on-surface">{label}</span>
                          {description && <span className="line-clamp-2 text-[9px] leading-tight text-on-surface-variant">{description}</span>}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
