import axios from 'axios'
import { resolveAppPath } from '../appBase'

/** Продакшен API; используется, если VITE_API_URL не задан при сборке (частая причина запросов на localhost). */
export const PRODUCTION_API_BASE = 'https://finklik-api.onrender.com'

/** GitHub Pages отдаёт только статику: POST на тот же origin даёт 405. Частая ошибка — указать URL Pages в VITE_API_URL. */
function isGithubPagesOrigin(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.github.io')
  } catch {
    return false
  }
}

function isCloudStaticHost(host: string): boolean {
  return host.endsWith('.github.io') || host.endsWith('.vercel.app')
}

function isStaticFrontendUrl(url: string): boolean {
  try {
    return isCloudStaticHost(new URL(url).hostname)
  } catch {
    return false
  }
}

function resolveEnvApiBase(fromEnv: unknown): string | null {
  if (!fromEnv || !String(fromEnv).trim()) return null
  const candidate = String(fromEnv).trim().replace(/\/$/, '')
  if (isGithubPagesOrigin(candidate) || isStaticFrontendUrl(candidate)) return PRODUCTION_API_BASE
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return candidate
    }
  } catch {
    // Ignore malformed env value and use stable fallbacks below.
  }
  return null
}

function resolveRuntimeOverrideBase(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.__FINKLIK_API_BASE__
  if (!raw || !String(raw).trim()) return null
  const candidate = String(raw).trim().replace(/\/$/, '')
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return candidate
    }
  } catch {
    return null
  }
  return null
}

export function resolveApiBase(): string {
  const override = resolveRuntimeOverrideBase()
  if (override) return override
  const envBase = resolveEnvApiBase(import.meta.env.VITE_API_URL)
  if (envBase) return envBase
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (isCloudStaticHost(host)) {
      return PRODUCTION_API_BASE
    }
    // SPA раздаётся с того же хоста, что и API (Docker на Render) — без cross-origin к другому домену.
    if (host.endsWith('.onrender.com')) {
      return window.location.origin
    }
  }
  return 'http://localhost:8000'
}
type RetryableRequestConfig = {
  _retry?: boolean
  headers?: Record<string, string>
} & Record<string, any>

let refreshPromise: Promise<string> | null = null

export const api = axios.create({
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const base = resolveApiBase()
  config.baseURL = `${base}/api/v1`
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Default Content-Type: application/json ломает multipart: браузер должен сам подставить boundary.
  if (config.data instanceof FormData) {
    const h = config.headers
    if (h && typeof (h as { delete?: (k: string) => void }).delete === 'function') {
      ;(h as { delete: (k: string) => void }).delete('Content-Type')
    } else {
      delete (h as Record<string, unknown>)?.['Content-Type']
    }
  }
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
    const url = String(original.url || '')
    const isRefreshRequest = url.includes('/auth/refresh')
    // Не уводим пользователя на /login и не пробуем refresh для самого логина/регистрации:
    // 401 здесь означает "неверные данные", его нужно показать как есть.
    const isAuthEntryRequest =
      url.includes('/auth/login') || url.includes('/auth/register')

    if (
      isAuthError &&
      !isRefreshRequest &&
      !isAuthEntryRequest &&
      !original._retry
    ) {
      original._retry = true
      try {
        if (!refreshPromise) {
          let body: { organization_id?: string } = {}
          try {
            const oid = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
            if (oid) body = { organization_id: oid }
          } catch {
            /* localStorage */
          }
          refreshPromise = axios
            .post(`${resolveApiBase()}/api/v1/auth/refresh`, body, { withCredentials: true })
            .then(({ data }) => {
              localStorage.setItem('access_token', data.access_token)
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
    return Promise.reject(error)
  },
)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Render free tier «спит» ~15 мин: прокси может рвать соединение или долго отвечать.
 *  Делаем несколько попыток с паузами и длинным таймаутом на login/health. */
const COLD_START_LOGIN_TIMEOUT_MS = 120_000

type TokenBundle = { access_token: string; refresh_token?: string; expires_in?: number }

function parseFastApiDetail(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined
  const p = parsed as { detail?: unknown }
  const d = p.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d))
    return d
      .map((x: unknown) =>
        typeof x === 'object' && x && 'msg' in x ? String((x as { msg: string }).msg) : String(x),
      )
      .join('; ')
  return undefined
}

/** Вход/регистрация через fetch: на части сетей axios даёт ERR_NETWORK, тогда как fetch проходит. */
async function fetchAuthTokens(path: '/auth/login' | '/auth/register', body: unknown): Promise<{ data: TokenBundle }> {
  const base = resolveApiBase()
  const url = `${base}/api/v1${path}`
  const controller = new AbortController()
  const tid = window.setTimeout(() => controller.abort(), COLD_START_LOGIN_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    const text = await res.text()
    let parsed: unknown = {}
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = { detail: text?.slice(0, 200) || 'Некорректный ответ сервера' }
    }
    if (!res.ok) {
      const err: any = new Error(parseFastApiDetail(parsed) || res.statusText || 'Ошибка запроса')
      err.response = { status: res.status, data: parsed }
      throw err
    }
    return { data: parsed as TokenBundle }
  } catch (e: any) {
    if (e?.response) throw e
    const name = e?.name
    const msg = String(e?.message || e || '')
    const wrapped: any = new Error(msg)
    wrapped.code = name === 'AbortError' ? 'ECONNABORTED' : 'ERR_NETWORK'
    throw wrapped
  } finally {
    window.clearTimeout(tid)
  }
}

async function fetchHealthWarmup(): Promise<void> {
  const base = resolveApiBase()
  const controller = new AbortController()
  const tid = window.setTimeout(() => controller.abort(), 45_000)
  try {
    await fetch(`${base}/api/v1/health`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(tid)
  }
}

function isTransientNetworkError(e: any): boolean {
  const code = e?.code
  const status = e?.response?.status
  const msg = String(e?.message || '').toLowerCase()
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  )
}

async function withColdStartRetry<T>(fn: () => Promise<T>): Promise<T> {
  const attempts = 5
  const delays = [0, 2000, 5000, 10000, 15000]
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    if (delays[i]) await sleep(delays[i])
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      if (!isTransientNetworkError(e)) throw e
      try {
        await fetchHealthWarmup()
      } catch {
        /* прогрев best-effort */
      }
    }
  }
  throw lastErr
}

export async function pingApi(): Promise<boolean> {
  const attempts = 4
  const delays = [0, 2500, 6000, 12_000]
  const base = resolveApiBase()
  for (let i = 0; i < attempts; i++) {
    if (delays[i]) await sleep(delays[i])
    const controller = new AbortController()
    const tid = window.setTimeout(() => controller.abort(), 45_000)
    try {
      const res = await fetch(`${base}/api/v1/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      })
      if (res.ok) return true
    } catch {
      /* следующая попытка */
    } finally {
      window.clearTimeout(tid)
    }
  }
  return false
}

/** Сохраняем активную организацию для refresh тела запроса (мульти-клиенты). */
export const ACTIVE_ORG_STORAGE_KEY = 'finklik_active_org'

export const authApi = {
  // Без cookies: кросс-доменный вход (Pages→Render) надёжнее; refresh-cookie всё равно часто
  // режется как third-party — токен доступа приходит в JSON.
  register: (data: any) => withColdStartRetry(() => fetchAuthTokens('/auth/register', data)),
  login: (data: any) => withColdStartRetry(() => fetchAuthTokens('/auth/login', data)),
  me: () => api.get('/auth/me'),
  patchNotifications: (data: { telegram_chat_id?: string | null }) =>
    api.patch('/auth/me/notifications', data),
}

/** Мульти-орг, inbox, согласования, комментарии (Flow 3). */
export const workspaceApi = {
  memberships: () => api.get('/workspace/memberships'),
  switchOrg: (organization_id: string) => api.post('/workspace/switch', { organization_id }),
  pinMembership: (organization_id: string, pinned: boolean) =>
    api.patch(`/workspace/memberships/${organization_id}/pin`, { pinned }),
  accountantOverview: () => api.get('/workspace/accountant/overview'),
  inbox: (params?: { status?: string }) => api.get('/workspace/inbox', { params }),
  approvals: (params?: { status_filter?: string }) =>
    api.get('/workspace/approvals', { params }),
  comments: (params?: { target_kind?: string; target_id?: string }) =>
    api.get('/workspace/comments', { params }),
}

/** Flow 4–6: лента исполнения + каноническое состояние + пакеты автономности. */
export const operationsApi = {
  executionFeed: () => api.get('/operations/execution-feed'),
  financialState: () => api.get('/operations/financial-state'),
  ackWorkPack: (packId: string) => api.post(`/operations/work-packs/${encodeURIComponent(packId)}/ack`),
}

export const dashboardApi = {
  getMetrics: () => api.get('/dashboard'),
  getTransactions: (params?: any) => api.get('/transactions', { params }),
  createTransaction: (data: any) => api.post('/transactions', data),
  updateTransaction: (id: string, data: any) => api.put(`/transactions/${id}`, data),
  deleteTransaction: (id: string) => api.delete(`/transactions/${id}`),
}

/** Business OS: единый снимок состояния, доменные сущности, обязательства, сверка. */
export const businessOsApi = {
  getState: () => api.get('/business/state'),
  listEntities: () => api.get('/business/entities'),
  createEntity: (data: { name: string; entity_type: string; counterparty_id?: string | null }) =>
    api.post('/business/entities', data),
  listCostCenters: () => api.get('/business/cost-centers'),
  createCostCenter: (data: { name: string; center_type: string }) =>
    api.post('/business/cost-centers', data),
  listRevenueStreams: () => api.get('/business/revenue-streams'),
  createRevenueStream: (data: { name: string; source?: string | null }) =>
    api.post('/business/revenue-streams', data),
  listObligations: () => api.get('/business/obligations'),
  createObligation: (data: any) => api.post('/business/obligations', data),
  patchObligation: (id: string, data: any) => api.patch(`/business/obligations/${id}`, data),
  listReconciliationMatches: () => api.get('/business/reconciliation-matches'),
  createReconciliationMatch: (data: any) => api.post('/business/reconciliation-matches', data),
  listWorkflowActions: () => api.get('/business/workflow-actions'),
  logWorkflowAction: (data: any) => api.post('/business/workflow-actions', data),
  listAiMemory: () => api.get('/business/ai-memory'),
  appendAiMemory: (data: { memory_type: string; payload_json: string }) =>
    api.post('/business/ai-memory', data),
  analyzeTransaction: (transactionId: string) =>
    api.post(`/business/transactions/${transactionId}/analyze`),
}

/** Журнал domain_events + превью производных данных (гибрид CRUD + события). */
export const eventsApi = {
  recent: (params?: { limit?: number }) => api.get('/events/recent', { params }),
  derivedPreview: () => api.get('/events/derived-preview'),
}

export const employeesApi = {
  list: (params?: any) => api.get('/employees', { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  create: (data: any) => api.post('/employees', data),
  update: (id: string, data: any) => api.put(`/employees/${id}`, data),
  fire: (id: string, fire_date?: string) => api.delete(`/employees/${id}`, { params: { fire_date } }),
  calculateSalary: (data: any) => api.post('/employees/salary/calculate', data),
  listSalary: (params: { year: number; month: number }) => api.get('/employees/salary/list', { params }),
  hrSequences: () => api.get('/employees/hr/sequences'),
  salaryRecords: (
    id: string,
    params: { year_from: number; month_from: number; year_to: number; month_to: number },
  ) => api.get(`/employees/${id}/salary-records`, { params }),
  downloadHireOrder: (
    id: string,
    params?: { city?: string; director_initials?: string; employee_initials?: string; application_number?: string },
  ) =>
    api.get(`/employees/${id}/documents/order-hire`, { params, responseType: 'blob' }),
}

export const workforceApi = {
  terminate: (
    id: string,
    body: {
      termination_date: string
      dismissal_reason_code?: string | null
      dismissal_reason_label?: string | null
      fire_order_number?: string | null
    },
  ) => api.post(`/employees/${id}/terminate`, body),
  bulkTerminate: (body: {
    employee_ids: string[]
    termination_date: string
    dismissal_reason_code?: string | null
    dismissal_reason_label?: string | null
    fire_order_number?: string | null
  }) => api.post('/employees/bulk-terminate', body),
  sendPu2: (data: { employee_id?: string; period?: string; xml_data?: string }) =>
    api.post('/fszn/pu2', data),
  sendPu3: (data: { employee_id?: string; period?: string; xml_data?: string }) =>
    api.post('/fszn/pu3', data),
  calculateSalary: (data: { employee_id: string; period_start: string; period_end: string }) =>
    api.post('/salary/calculate', data),
  listSalaryCalculations: () => api.get('/salary/calculations'),
  runMonthlyPayroll: (data: { period_year: number; period_month: number; work_days_plan?: number }) =>
    api.post('/salary/run-month', data),
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

/** Спокойная операционная отчётность: готовность, шкала времени, проверки. */
export const reportingCalmApi = {
  overview: () => api.get('/reporting/calm/overview'),
  startPreparation: (body?: { period?: string | null }) => api.post('/reporting/calm/preparation/start', body ?? {}),
  validate: () => api.post('/reporting/calm/validate'),
}

export const counterpartiesApi = {
  list: (params?: { q?: string; active_only?: boolean; include_stats?: boolean }) =>
    api.get('/counterparties', { params }),
  quickUnp: (data: { unp: string; name?: string | null }) => api.post('/counterparties/quick-unp', data),
  reconciliationCsv: (id: string, params: { date_from: string; date_to: string }) =>
    api.get(`/counterparties/${id}/reconciliation`, { params, responseType: 'blob' }),
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
  oauthUrl: (account_id: string) => api.get('/bank/oauth/url', { params: { account_id } }),
  oauthCallback: (data: { account_id: string; code: string; state: string; provider?: string }) => api.post('/bank/oauth/callback', data),
  oauthStatus: (account_id: string) => api.get('/bank/oauth/status', { params: { account_id } }),
  oauthImport: (data: { account_id: string; date_from: string; date_to: string }) => api.post('/bank/oauth/import', data),
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
  processSyncJobs: (batch_size = 20, recover_stuck = true) =>
    api.post('/onec/sync-jobs/process', null, { params: { batch_size, recover_stuck } }),
}

export const scannerApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    // Не задавать Content-Type вручную: boundary обязателен для multipart, иначе сервер не парсит тело.
    return api.post('/scanner/upload', form)
  },
  parseText: (text: string, doc_type?: string) =>
    api.post('/scanner/parse-text', { text, doc_type }),
  list: (params?: any) => api.get('/scanner/documents', { params }),
  reviewQueue: (limit?: number) => api.get('/scanner/review-queue', { params: { limit } }),
  remove: (id: string) => api.delete(`/scanner/documents/${id}`),
  uploadToKudir: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/scanner/upload-to-kudir', form)
  },
}

export const plannerApi = {
  listTasks: (mode: 'all' | 'mine' | 'assigned' = 'all') => api.get('/planner/tasks', { params: { mode } }),
  createTask: (data: { title: string; description?: string; attachments?: string[]; assignee_id: string }) =>
    api.post('/planner/tasks', data),
  closeTask: (id: string) => api.post(`/planner/tasks/${id}/close`),
  createReport: (id: string, data: { content: string; attachments?: string[] }) =>
    api.post(`/planner/tasks/${id}/report`, data),
  listComments: (id: string) => api.get(`/planner/tasks/${id}/comments`),
  addComment: (id: string, data: { content: string }) => api.post(`/planner/tasks/${id}/comments`, data),
}

export const calendarApi = {
  listEvents: (params: { date_from: string; date_to: string }) => api.get('/calendar/events', { params }),
  createEvent: (data: any) => api.post('/calendar/events', data),
  updateEvent: (id: string, data: any) => api.put(`/calendar/events/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/calendar/events/${id}`),
  completeEvent: (id: string, done: boolean) => api.post(`/calendar/events/${id}/complete`, { done }),
  productivitySummary: (params: { period_start: string; period_end: string }) =>
    api.get('/calendar/productivity-summary', { params }),
}

export const notificationsApi = {
  list: (limit = 20) => api.get('/notifications', { params: { limit } }),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
}

export const notesApi = {
  list: () => api.get('/notes'),
  create: (data: { title?: string; body?: string }) => api.post('/notes', data),
  update: (id: string, data: { title?: string | null; body?: string | null }) =>
    api.patch(`/notes/${id}`, data),
  remove: (id: string) => api.delete(`/notes/${id}`),
}

export const importApi = {
  previewCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/import/transactions-csv/preview', form)
  },
  importCsv: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/import/transactions-csv', form)
  },
}

export const categorizationRulesApi = {
  list: () => api.get('/categorization-rules'),
  create: (data: {
    name: string
    category: string
    transaction_type?: string | null
    counterparty_id?: string | null
    description_pattern?: string | null
    min_amount?: number | null
    max_amount?: number | null
    vat_required?: boolean | null
    priority?: number
    is_active?: boolean
  }) => api.post('/categorization-rules', data),
  remove: (id: string) => api.delete(`/categorization-rules/${id}`),
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
  getOrgRequisites: () => api.get('/team/organization/requisites'),
  patchOrgRequisites: (data: { legal_address?: string | null; ceo_name?: string | null }) =>
    api.patch('/team/organization/requisites', data),
  exportOrgRequisites: () => api.get('/team/organization/requisites-export', { responseType: 'blob' }),
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
  get: (id: string, params?: { include_snapshot?: boolean }) =>
    api.get(`/submissions/${id}`, { params }),
  getReportTypes: () => api.get('/submissions/report-types'),
  create: (data: { authority: string; report_type: string; report_period: string }) =>
    api.post('/submissions', data),
  confirm: (id: string) => api.post(`/submissions/${id}/confirm`),
  submit: (id: string, opts?: { portal_sim?: 'accept' | 'reject' }) =>
    api.post(`/submissions/${id}/submit`, null, { params: opts }),
  reject: (id: string, reason?: string) =>
    api.post(`/submissions/${id}/reject`, null, { params: { reason } }),
  readiness: (id: string) => api.get(`/submissions/${id}/readiness`),
  autoSubmit: (limit = 20) => api.post('/submissions/auto-submit', null, { params: { limit } }),
}

export type AssistantSource = {
  id: string | null
  title: string | null
  url: string | null
  authority?: string
  kinds?: string[]
}

export type AssistantChatMessage = { role: 'user' | 'assistant'; content: string; sources?: AssistantSource[] }

export type AssistantLlmKeySource = 'none' | 'organization' | 'platform'

export const assistantApi = {
  status: () =>
    api.get<{
      llm_enabled: boolean
      model: string | null
      key_source: AssistantLlmKeySource
      org_key_configured: boolean
      isolation_note: string | null
    }>('/assistant/status'),
  sourcesCatalog: () =>
    api.get<{ version?: number; groups?: Array<{ id: string; title: string; entries: Array<{ title: string; url: string | null; note?: string }> }> }>(
      '/assistant/sources',
    ),
  chat: (messages: AssistantChatMessage[]) =>
    api.post<{
      reply: string
      mode: 'demo' | 'llm'
      llm_key_source: AssistantLlmKeySource
      sources?: AssistantSource[]
      rag?: boolean
    }>('/assistant/chat', { messages }),
  setOrganizationKey: (body: { api_key: string; base_url?: string | null; model?: string | null }) =>
    api.post<{ ok: boolean; message?: string }>('/assistant/organization-key', body),
  deleteOrganizationKey: () => api.delete<{ ok: boolean }>('/assistant/organization-key'),
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

/** Официальные курсы НБ РБ (без отдельной авторизации; те же CORS, что и у API). */
export type NbrbRateRow = {
  code: string
  name: string
  scale: number
  official_rate_byn: string
  byn_per_unit: string
  rates_date: string
}

export type NbrbRatesPayload = {
  source: string
  source_url: string
  rates_date: string
  fetched_at: string
  stale: boolean
  refresh_interval_sec: number | null
  rates: NbrbRateRow[]
}

export type NbrbConvertPayload = {
  amount: string
  from_currency: string
  to_currency: string
  result: string
  rates_date: string
  fetched_at: string
  stale: boolean
}

export const fxApi = {
  nbrbStatus: () => api.get('/fx/nbrb/status'),
  nbrbRates: () => api.get<NbrbRatesPayload>('/fx/nbrb/rates'),
  nbrbConvert: (params: { amount: string; from: string; to: string }) =>
    api.get<NbrbConvertPayload>('/fx/nbrb/convert', { params }),
}

export const integrationsApi = {
  capabilities: () => api.get('/integrations/capabilities'),
}

export const automationApi = {
  issues: (limit = 100) => api.get('/automation/issues', { params: { limit } }),
  policy: () => api.get('/automation/policy'),
  updatePolicy: (data: {
    mode: 'assist' | 'checkpoints' | 'autopilot'
    allow_auto_reporting: boolean
    allow_auto_workforce: boolean
    max_auto_submissions_per_run: number
  }) => api.put('/automation/policy', data),
  scenarios: () => api.get('/automation/scenarios'),
  health: () => api.get('/automation/health'),
  audit: (limit = 100) => api.get('/automation/audit', { params: { limit } }),
  kpi: () => api.get('/automation/kpi'),
  dataQuality: () => api.get('/automation/data-quality'),
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
