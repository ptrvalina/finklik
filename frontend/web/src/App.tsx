import { BrowserRouter, HashRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { appBasePath } from './appBase'
import { useAuthStore } from './store/authStore'
import ThemeHydration from './components/ThemeHydration'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import Bank from './pages/Bank'
import Reports from './pages/Reports'
import Employees from './pages/Employees'
import EmployeesHub from './pages/employees/Hub'
import EmployeesHire from './pages/employees/Hire'
import EmployeesDismiss from './pages/employees/Dismiss'
import EmployeesTimesheet from './pages/employees/Timesheet'
import EmployeesStaffing from './pages/employees/Staffing'
import EmployeesHrPlanner from './pages/employees/HrPlanner'
import Accounting from './pages/Accounting'
import Counterparties from './pages/Counterparties'
import Websites from './pages/Websites'
import Notes from './pages/Notes'
import Planner from './pages/Planner'
import AnalyticsPage from './pages/AnalyticsPage'
import CalendarPage from './pages/CalendarPage'
import DocumentsPage from './pages/DocumentsPage'
import BankPage from './pages/BankPage'
import BankOAuthCallbackPage from './pages/BankOAuthCallbackPage'
import ScannerPage from './pages/ScannerPage'
import SettingsPage from './pages/SettingsPage'
import ReportingPage from './features/reporting/ReportingPage'
import CurrencyPage from './features/currency/CurrencyPage'
import AssistantPage from './pages/AssistantPage'
import WorkspaceCommandPage from './pages/WorkspaceCommandPage'
import OperationsPage from './pages/OperationsPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import BusinessProfilePage from './pages/BusinessProfilePage'
import ChartOfAccountsPage from './pages/ChartOfAccountsPage'
import FixedAssetsPage from './pages/FixedAssetsPage'
import AccountingHubPage from './pages/AccountingHubPage'
import OpsDiagnosticsPage from './pages/OpsDiagnosticsPage'
import Layout from './components/layout/Layout'
import { AppErrorBoundary } from './components/errors/AppErrorBoundary'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token')
  return isAuthenticated && hasToken && user ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('access_token')
  return isAuthenticated && hasToken && user ? <Navigate to="/" replace /> : <>{children}</>
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

/** Старые ссылки `/reporting/imns` → `/reports/imns` */
function LegacyReportingRedirect() {
  const { authority } = useParams<{ authority: string }>()
  if (!authority) return <Navigate to="/reports" replace />
  return <Navigate to={`/reports/${authority}`} replace />
}

/** Старые ссылки `/accounting` → журнал с сохранением query (контрагент, пресеты). */
function AccountingJournalRedirect() {
  const location = useLocation()
  return <Navigate to={`/accounting/journal${location.search}${location.hash}`} replace />
}

export default function App() {
  const useHash = typeof window !== 'undefined' && window.location.hostname === 'ptrvalina.github.io'

  const router = useHash
    ? (
      <HashRouter>
        <AppErrorBoundary>
          <AppRoutes />
        </AppErrorBoundary>
      </HashRouter>
    )
    : (
      <BrowserRouter basename={appBasePath || undefined}>
        <AppErrorBoundary>
          <AppRoutes />
        </AppErrorBoundary>
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
        <Route path="/onboarding/business-profile" element={<PrivateRoute><BusinessProfilePage /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route
            path="operations"
            element={
              <RoleRoute allow={['admin', 'accountant']}>
                <OperationsPage />
              </RoleRoute>
            }
          />
          <Route
            path="workspace"
            element={
              <RoleRoute allow={['admin', 'accountant']}>
                <WorkspaceCommandPage />
              </RoleRoute>
            }
          />
          <Route path="bank" element={<RoleRoute allow={['admin', 'accountant']}><Bank /></RoleRoute>} />
          <Route path="bank/oauth/callback" element={<RoleRoute allow={['admin', 'accountant']}><BankOAuthCallbackPage /></RoleRoute>} />
          <Route path="reports/:authority" element={<RoleRoute allow={['admin', 'accountant']}><Reports /></RoleRoute>} />
          <Route path="reports" element={<RoleRoute allow={['admin', 'accountant']}><Reports /></RoleRoute>} />
          <Route path="employees" element={<RoleRoute allow={['admin', 'accountant']}><Employees /></RoleRoute>}>
            <Route index element={<EmployeesHub />} />
            <Route path="hire" element={<EmployeesHire />} />
            <Route path="dismiss" element={<EmployeesDismiss />} />
            <Route path="timesheet" element={<EmployeesTimesheet />} />
            <Route path="staffing" element={<EmployeesStaffing />} />
            <Route path="planner" element={<EmployeesHrPlanner />} />
          </Route>
          <Route path="accounting/hub" element={<RoleRoute allow={['admin', 'accountant']}><AccountingHubPage /></RoleRoute>} />
          <Route path="accounting/journal" element={<RoleRoute allow={['admin', 'accountant']}><Accounting /></RoleRoute>} />
          <Route path="accounting/chart" element={<RoleRoute allow={['admin', 'accountant']}><ChartOfAccountsPage /></RoleRoute>} />
          <Route path="accounting/fixed-assets" element={<RoleRoute allow={['admin', 'accountant']}><FixedAssetsPage /></RoleRoute>} />
          <Route path="accounting" element={<AccountingJournalRedirect />} />
          <Route path="counterparties" element={<RoleRoute allow={['admin', 'accountant']}><Counterparties /></RoleRoute>} />
          <Route path="websites" element={<Websites />} />
          <Route path="notes" element={<Notes />} />
          <Route path="scan" element={<RoleRoute allow={['admin', 'accountant', 'manager']}><ScannerPage /></RoleRoute>} />
          <Route path="planner" element={<RoleRoute allow={['admin', 'accountant', 'manager']}><Planner /></RoleRoute>} />

          {/* Legacy route aliases kept for compatibility */}
          <Route path="transactions" element={<Navigate to="/accounting/journal" replace />} />
          <Route path="analytics" element={<RoleRoute allow={['admin', 'accountant']}><AnalyticsPage /></RoleRoute>} />
          <Route path="calendar" element={<RoleRoute allow={['admin', 'accountant']}><CalendarPage /></RoleRoute>} />
          <Route path="taxes" element={<Navigate to="/bank" replace />} />
          <Route path="reporting" element={<Navigate to="/reports" replace />} />
          <Route path="reporting/:authority" element={<LegacyReportingRedirect />} />
          <Route path="documents" element={<Navigate to="/accounting/journal" replace />} />
          <Route path="currency" element={<Navigate to="/bank" replace />} />
          <Route path="scanner" element={<Navigate to="/scan" replace />} />
          <Route path="onec-contour" element={<Navigate to="/settings" replace />} />
          <Route path="onec-sync" element={<Navigate to="/settings" replace />} />

          {/* Existing pages remain available via route aliases */}
          <Route path="legacy/bank" element={<BankPage />} />
          <Route path="legacy/documents" element={<DocumentsPage />} />
          <Route path="legacy/scanner" element={<ScannerPage />} />
          <Route path="legacy/reporting/:authority" element={<ReportingPage basePath="/legacy/reporting" />} />
          <Route path="legacy/reporting" element={<ReportingPage basePath="/legacy/reporting" />} />
          <Route path="legacy/currency" element={<CurrencyPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="settings" element={<RoleRoute allow={['admin', 'accountant']}><SettingsPage /></RoleRoute>} />
          <Route path="admin/ops" element={<RoleRoute allow={['admin']}><OpsDiagnosticsPage /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  )
}
