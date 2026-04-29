import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { appBasePath } from './appBase'
import { useAuthStore } from './store/authStore'
import ThemeHydration from './components/ThemeHydration'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import Bank from './pages/Bank'
import Reports from './pages/Reports'
import Employees from './pages/Employees'
import Accounting from './pages/Accounting'
import Counterparties from './pages/Counterparties'
import Websites from './pages/Websites'
import Notes from './pages/Notes'
import Planner from './pages/Planner'
import TransactionsPage from './pages/TransactionsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CalendarPage from './pages/CalendarPage'
import DocumentsPage from './pages/DocumentsPage'
import BankPage from './pages/BankPage'
import ScannerPage from './pages/ScannerPage'
import OnecSyncPage from './pages/OnecSyncPage'
import OnecContourPage from './pages/OnecContourPage'
import SettingsPage from './pages/SettingsPage'
import ReportingPage from './features/reporting/ReportingPage'
import CurrencyPage from './features/currency/CurrencyPage'
import AssistantPage from './pages/AssistantPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import Layout from './components/layout/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}

function RoleRoute({
  allow,
  children,
}: {
  allow: Array<'admin' | 'owner' | 'accountant' | 'manager' | 'viewer'>
  children: React.ReactNode
}) {
  const user = useAuthStore((s) => s.user)
  const role = (user?.role || '').toLowerCase()
  if (allow.includes('admin') && role === 'owner') return <>{children}</>
  return allow.includes(role as any) ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  const useHash = typeof window !== 'undefined' && window.location.hostname === 'ptrvalina.github.io'

  const router = useHash
    ? (
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    )
    : (
      <BrowserRouter basename={appBasePath || undefined}>
        <AppRoutes />
      </BrowserRouter>
    )

  return (
    <>
      <ThemeHydration />
      {router}
    </>
  )
}

function AppRoutes() {
  return (
    <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="bank" element={<RoleRoute allow={['admin', 'accountant']}><Bank /></RoleRoute>} />
          <Route path="reports" element={<RoleRoute allow={['admin', 'accountant']}><Reports /></RoleRoute>} />
          <Route path="employees" element={<RoleRoute allow={['admin', 'accountant']}><Employees /></RoleRoute>} />
          <Route path="accounting" element={<RoleRoute allow={['admin', 'accountant']}><Accounting /></RoleRoute>} />
          <Route path="counterparties" element={<RoleRoute allow={['admin', 'accountant']}><Counterparties /></RoleRoute>} />
          <Route path="websites" element={<Websites />} />
          <Route path="notes" element={<Notes />} />
          <Route path="scan" element={<RoleRoute allow={['admin', 'accountant', 'manager']}><ScannerPage /></RoleRoute>} />
          <Route path="planner" element={<RoleRoute allow={['admin', 'accountant', 'manager']}><Planner /></RoleRoute>} />

          {/* Legacy route aliases kept for compatibility */}
          <Route path="transactions" element={<Navigate to="/accounting" replace />} />
          <Route path="analytics" element={<Navigate to="/reports" replace />} />
          <Route path="calendar" element={<Navigate to="/reports" replace />} />
          <Route path="taxes" element={<Navigate to="/bank" replace />} />
          <Route path="reporting" element={<Navigate to="/reports" replace />} />
          <Route path="reporting/:authority" element={<Navigate to="/reports" replace />} />
          <Route path="documents" element={<Navigate to="/accounting" replace />} />
          <Route path="currency" element={<Navigate to="/bank" replace />} />
          <Route path="scanner" element={<Navigate to="/scan" replace />} />
          <Route path="onec-contour" element={<Navigate to="/settings" replace />} />
          <Route path="onec-sync" element={<Navigate to="/settings" replace />} />

          {/* Existing pages remain available via route aliases */}
          <Route path="legacy/bank" element={<BankPage />} />
          <Route path="legacy/documents" element={<DocumentsPage />} />
          <Route path="legacy/scanner" element={<ScannerPage />} />
          <Route path="legacy/reporting" element={<ReportingPage />} />
          <Route path="legacy/currency" element={<CurrencyPage />} />
          <Route path="legacy/onec-contour" element={<OnecContourPage />} />
          <Route path="legacy/onec-sync" element={<OnecSyncPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="settings" element={<RoleRoute allow={['admin', 'accountant']}><SettingsPage /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  )
}
