/**
 * Capture fresh presentation screenshots from production (or local) UI.
 * Usage: node scripts/capture-presentation-screenshots.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../docs/presentations/product-presentation/media')

const API = process.env.FC_API_URL || 'https://finklik-api.onrender.com/api/v1'
const BASE = (process.argv[2] || 'https://ptrvalina.github.io/finklik').replace(/\/$/, '')
const USE_HASH = process.argv[3] !== 'browser' && BASE.includes('github.io')
const EMAIL = process.env.FC_DEMO_EMAIL || 'presentation@finklik.by'
const PASS = process.env.FC_DEMO_PASSWORD || 'Present123'

function appUrl(routePath) {
  const p = routePath.startsWith('/') ? routePath : `/${routePath}`
  return USE_HASH ? `${BASE}/#${p}` : `${BASE}${p}`
}

async function apiJson(path, body, method = 'POST') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { ok: res.ok, status: res.status, data }
}

async function ensureSession() {
  let login = await apiJson('/auth/login', { email: EMAIL, password: PASS })
  if (!login.ok) {
    console.log(`Login failed (${login.status}), registering ${EMAIL}…`)
    const reg = await apiJson('/auth/register', {
      email: EMAIL,
      password: PASS,
      full_name: 'Demo Презентация',
      org_name: 'ФинКлик Демо',
      org_unp: '123456789',
      legal_form: 'ip',
      tax_regime: 'usn_no_vat',
    })
    if (!reg.ok) {
      throw new Error(`Register failed: ${reg.status} ${JSON.stringify(reg.data)}`)
    }
    login = { ok: true, data: reg.data }
  }
  const token = login.data?.access_token
  if (!token) throw new Error('No access_token from auth')

  const me = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!me.ok) throw new Error(`auth/me failed: ${me.status}`)
  const user = await me.json()
  await fetch(`${API}/demo/seed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  }).catch(() => {})
  return { token, user }
}

const PAGES = [
  { file: 'dashboard.png', path: '/', label: 'Главная' },
  { file: 'bank.png', path: '/bank', label: 'Банк' },
  { file: 'scanner.png', path: '/scan', label: 'Сканер' },
  { file: 'documents.png', path: '/documents', label: 'Документы' },
  { file: 'calendar.png', path: '/calendar', label: 'Календарь' },
  { file: 'reports.png', path: '/reports', label: 'Отчёты' },
  { file: 'employees.png', path: '/employees', label: 'Команда' },
  { file: 'counterparties.png', path: '/counterparties', label: 'Контрагенты' },
  { file: 'settings.png', path: '/settings', label: 'Настройки' },
  { file: 'assistant.png', path: '/assistant', label: 'Консультант' },
]

async function waitForApp(page) {
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {})
  await page.waitForTimeout(2500)
}

async function login(page, session) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('access_token', token)
    if (user.organization_id) {
      localStorage.setItem('finklik_active_org', user.organization_id)
    }
    localStorage.setItem(
      'finklik-auth',
      JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 }),
    )
  }, session)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForApp(page)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'ru-RU',
  })
  const page = await context.newPage()

  console.log(`Base: ${BASE}`)
  const session = await ensureSession()
  await login(page, session)

  for (const item of PAGES) {
    const url = appUrl(item.path)
    console.log(`→ ${item.label}: ${url}`)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await waitForApp(page)
      await page.screenshot({
        path: path.join(OUT, item.file),
        fullPage: false,
        animations: 'disabled',
      })
      console.log(`  saved ${item.file}`)
    } catch (err) {
      console.error(`  FAILED ${item.file}:`, err.message)
    }
  }

  await browser.close()
  console.log('Done:', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
