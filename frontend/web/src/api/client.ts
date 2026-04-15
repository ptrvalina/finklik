import axios from 'axios'
import { resolveAppPath } from '../appBase'

/** Продакшен API; используется, если VITE_API_URL не задан при сборке (частая причина запросов на localhost). */
const PRODUCTION_API_BASE = 'https://finklik-api.onrender.com'

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'finklik.vercel.app' || host === 'ptrvalina.github.io') {
      return PRODUCTION_API_BASE
    }
  }
  return 'http://localhost:8000'
}

const BASE = resolveApiBase()
type RetryableRequestConfig = {
  _retry?: boolean
  headers?: Record<string, string>
} & Record<string, any>

let refreshPromise: Promise<string> | null = null

export const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original: RetryableRequestConfig = error.config
    if (!original) return Promise.reject(error)

    const status = error.response?.status
    const detail = String(error.response?.data?.detail || '').toLowerCase()
    const isAuthError =
      status === 401 || (status === 403 && detail.includes('not authenticated'))
    const isRefreshRequest = String(original.url || '').includes('/auth/refresh')

    if (isAuthError && !isRefreshRequest && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          if (!refreshPromise) {
            refreshPromise = axios
              .post(`${BASE}/api/v1/auth/refresh`, { refresh_token: refresh })
              .then(({ data }) => {
                localStorage.setItem('access_token', data.access_token)
                localStorage.setItem('refresh_token', data.refresh_token)
                return data.access_token as string
              })
              .finally(() => {
                refreshPromise = null
              })
          }

          const accessToken = await refreshPromise
          original.headers = original.headers ?? {}
          original.headers.Authorization = `Bearer ${accessToken}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = resolveAppPath('/login')
        }
      }
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

export const dashboardApi = {
  getMetrics: () => api.get('/dashboard'),
  getTransactions: (params?: any) => api.get('/transactions', { params }),
  createTransaction: (data: any) => api.post('/transactions', data),
  updateTransaction: (id: string, data: any) => api.put(`/transactions/${id}`, data),
  deleteTransaction: (id: string) => api.delete(`/transactions/${id}`),
}

export const employeesApi = {
  list: (params?: any) => api.get('/employees', { params }),
  create: (data: any) => api.post('/employees', data),
  update: (id: string, data: any) => api.put(`/employees/${id}`, data),
  fire: (id: string, fire_date?: string) => api.delete(`/employees/${id}`, { params: { fire_date } }),
  calculateSalary: (data: any) => api.post('/employees/salary/calculate', data),
  listSalary: (params: { year: number; month: number }) => api.get('/employees/salary/list', { params }),
}

export const taxApi = {
  calculate: (params: { period_start: string; period_end: string; with_vat?: boolean }) =>
    api.get('/tax/calculate', { params }),
  calendar: (year: number) => api.get('/tax/calendar', { params: { year } }),
  validateRules: () => api.get('/tax/rules/validate'),
}

export const reportsApi = {
  counterpartyTurnover: (params?: any) => api.get('/reports/counterparty-turnover', { params }),
  monthlySummary: (year?: number) => api.get('/reports/monthly-summary', { params: { year } }),
  expenseCategories: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/reports/expense-categories', { params }),
  incomeExpenseTrend: (months?: number) =>
    api.get('/reports/income-expense-trend', { params: { months } }),
}

export const counterpartiesApi = {
  list: (params?: any) => api.get('/counterparties', { params }),
  create: (data: any) => api.post('/counterparties', data),
  update: (id: string, data: any) => api.put(`/counterparties/${id}`, data),
  remove: (id: string) => api.delete(`/counterparties/${id}`),
}

export const bankApi = {
  listBanks: () => api.get('/bank/banks'),
  listAccounts: () => api.get('/bank/accounts'),
  createAccount: (data: any) => api.post('/bank/accounts', data),
  updateAccount: (id: string, data: any) => api.put(`/bank/accounts/${id}`, data),
  deleteAccount: (id: string) => api.delete(`/bank/accounts/${id}`),
  getBalance: () => api.get('/bank/balance'),
  getStatements: (limit?: number) => api.get('/bank/statements', { params: { limit } }),
  createPayment: (data: any) => api.post('/bank/payment', data),
  importStatement: (lines: any[]) => api.post('/bank/statement/import', { lines }),
  reconciliation: (date_from: string, date_to: string) =>
    api.get('/bank/reconciliation', { params: { date_from, date_to } }),
  externalStatementPreview: () => api.get('/bank/external-statement'),
}

export const onecApi = {
  getConfig: () => api.get('/onec/config'),
  saveConfig: (data: { endpoint: string; token: string; protocol?: string }) => api.put('/onec/config', data),
  contourStatus: () => api.get('/onec/contour/status'),
  health: () => api.get('/onec/health'),
  lookupCounterparty: (unp: string) => api.get('/onec/counterparty/lookup', { params: { unp } }),
  searchCounterparty: (q: string) => api.get('/onec/counterparty/search', { params: { q } }),
  getAccounts: () => api.get('/onec/accounts'),
  syncTransaction: (data: any) => api.post('/onec/sync-transaction', data),
  listSyncJobs: (status?: string) => api.get('/onec/sync-jobs', { params: { status } }),
  retrySyncJob: (jobId: string) => api.post(`/onec/sync-jobs/${jobId}/retry`),
}

export const scannerApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/scanner/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  parseText: (text: string, doc_type?: string) =>
    api.post('/scanner/parse-text', { text, doc_type }),
  list: (params?: any) => api.get('/scanner/documents', { params }),
  remove: (id: string) => api.delete(`/scanner/documents/${id}`),
}

export const importApi = {
  previewCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/import/transactions-csv/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  importCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/import/transactions-csv', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const demoApi = {
  seed: () => api.post('/demo/seed'),
}

export const teamApi = {
  listMembers: () => api.get('/team/members'),
  listInvitations: () => api.get('/team/invitations'),
  invite: (data: { email: string; role: string }) => api.post('/team/invite', data),
  acceptInvite: (data: { invite_code: string; full_name: string; password: string }) =>
    api.post('/team/accept-invite', data),
  deactivateMember: (userId: string) => api.delete(`/team/members/${userId}`),
  cancelInvitation: (inviteId: string) => api.delete(`/team/invitations/${inviteId}`),
}

export const regulatoryApi = {
  getUpdates: (params?: { authority?: string; category?: string; severity?: string }) =>
    api.get('/regulatory/updates', { params }),
  markRead: (updateId: string) => api.post(`/regulatory/updates/${updateId}/read`),
  markAllRead: () => api.post('/regulatory/updates/read-all'),
  getAuthorities: () => api.get('/regulatory/authorities'),
}

export const submissionsApi = {
  list: (params?: { authority?: string; status?: string }) =>
    api.get('/submissions', { params }),
  getReportTypes: () => api.get('/submissions/report-types'),
  create: (data: { authority: string; report_type: string; report_period: string }) =>
    api.post('/submissions', data),
  confirm: (id: string) => api.post(`/submissions/${id}/confirm`),
  submit: (id: string) => api.post(`/submissions/${id}/submit`),
  reject: (id: string, reason?: string) =>
    api.post(`/submissions/${id}/reject`, null, { params: { reason } }),
}

export type AssistantChatMessage = { role: 'user' | 'assistant'; content: string }

export const assistantApi = {
  status: () => api.get<{ llm_enabled: boolean; model: string | null }>('/assistant/status'),
  chat: (messages: AssistantChatMessage[]) =>
    api.post<{ reply: string; mode: 'demo' | 'llm' }>('/assistant/chat', { messages }),
}

export const billingApi = {
  plans: () => api.get('/billing/plans'),
  subscription: () => api.get('/billing/subscription'),
  changePlan: (planCode: string) => api.post('/billing/change-plan', null, { params: { plan_code: planCode } }),
}

export const documentsApi = {
  transactionsCsv: (date_from: string, date_to: string) =>
    api.get('/export/transactions.csv', { params: { date_from, date_to }, responseType: 'blob' }),
  salaryCsv: (year: number, month: number) =>
    api.get('/export/salary.csv', { params: { year, month }, responseType: 'blob' }),
  taxReport: (period_start: string, period_end: string) =>
    api.get('/export/tax-report.txt', { params: { period_start, period_end }, responseType: 'blob' }),
  vatDeclaration: (quarter: number, year: number) =>
    api.get('/export/vat-declaration.txt', { params: { quarter, year }, responseType: 'blob' }),
  fssznPu3: (quarter: number, year: number) =>
    api.get('/export/fsszn-pu3.txt', { params: { quarter, year }, responseType: 'blob' }),
  financialReportPdf: (date_from: string, date_to: string) =>
    api.get('/export/financial-report.pdf', { params: { date_from, date_to }, responseType: 'blob' }),
}

export const primaryDocumentsApi = {
  list: (params?: { doc_type?: string; status?: string }) => api.get('/primary-documents', { params }),
  nextNumber: (doc_type: string) =>
    api.get<{ doc_type: string; suggested_number: string }>('/primary-documents/next-number', { params: { doc_type } }),
  create: (data: any) => api.post('/primary-documents', data),
  update: (id: string, data: any) => api.put(`/primary-documents/${id}`, data),
  remove: (id: string) => api.delete(`/primary-documents/${id}`),
  print: (id: string) => api.get(`/primary-documents/${id}/print`, { responseType: 'blob' }),
  paymentQr: (id: string) => api.get(`/primary-documents/${id}/payment-qr`),
  paymentStatus: (id: string) => api.get(`/primary-documents/${id}/payment-status`),
  markPaid: (id: string) => api.post(`/primary-documents/${id}/mark-paid`),
  paymentEvents: (id: string) => api.get(`/primary-documents/${id}/payment-events`),
  sendPaymentLink: (id: string, email: string) =>
    api.post(`/primary-documents/${id}/payment-link/send`, { email }),
}
