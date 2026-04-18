import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { appBasePath } from './appBase'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CalendarPage from './pages/CalendarPage'
import EmployeesPage from './pages/EmployeesPage'
import DocumentsPage from './pages/DocumentsPage'
import BankPage from './pages/BankPage'
import CounterpartiesPage from './pages/CounterpartiesPage'
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

  return router
}

function AppRoutes() {
  return (
    <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="taxes" element={<Navigate to="/bank" replace />} />
          <Route path="reporting" element={<ReportingPage />} />
          <Route path="reporting/:authority" element={<ReportingPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="bank" element={<BankPage />} />
          <Route path="currency" element={<CurrencyPage />} />
          <Route path="counterparties" element={<CounterpartiesPage />} />
          <Route path="onec-contour" element={<OnecContourPage />} />
          <Route path="onec-sync" element={<OnecSyncPage />} />
          <Route path="scanner" element={<ScannerPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  )
}
