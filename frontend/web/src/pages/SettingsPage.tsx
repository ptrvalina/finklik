import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamApi, regulatoryApi, billingApi, onecApi, assistantApi, automationApi, integrationsApi, authApi, accountingApi } from '../api/client'
import { Link } from 'react-router-dom'
import { formatApiDetail } from '../utils/apiError'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import AppModal from '../components/ui/AppModal'
import { CardSkeleton, TableSkeleton } from '../components/premium'
import OperationalPage from '../components/shell/OperationalPage'

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{name}</span>
}

type Tab = 'profile' | 'billing' | 'team' | 'regulatory' | 'integrations'

const AUTHORITY_COLORS: Record<string, string> = {
  fsszn: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  imns: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  belgosstrakh: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  belstat: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

const SEVERITY_ICONS: Record<string, { icon: string; color: string }> = {
  critical: { icon: 'error', color: 'text-error' },
  warning: { icon: 'warning', color: 'text-amber-400' },
  info: { icon: 'info', color: 'text-primary' },
}

const LEGAL_FORM_LABELS: Record<string, string> = { ip: 'ИП', ooo: 'ООО' }
const TAX_REGIME_LABELS: Record<string, string> = {
  usn_no_vat: 'УСН без НДС',
  usn_vat: 'УСН с НДС',
  osn_vat: 'Общая с НДС',
  usn_6: 'УСН (6%)',
}

type DeploymentCaps = {
  queried_at?: string
  organization_id?: string | null
  submission_portal?: {
    mode?: string
    base_url_configured?: boolean
    async_submit_enabled?: boolean
    http_timeout_sec?: number
  }
  signing?: {
    digest_endpoint?: string
    mock_signature_in_digest?: boolean
  }
  nbrb_fx?: Record<string, unknown>
  authorities?: Array<{
    code: string
    label: string
    submission_adapter?: string
    direct_api?: string
    detail?: string
  }>
}

function DeploymentOverviewSection({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: DeploymentCaps | null
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  if (loading && !data) {
    return (
      <div className="page-section p-5">
        <p className="text-sm text-on-surface-variant">Загрузка сводки развёртывания API…</p>
      </div>
    )
  }
  if (error && !data) {
    return (
      <div className="page-section border border-error/25 bg-error/5 p-5">
        <p className="text-sm font-bold text-error">Не удалось загрузить сводку интеграций</p>
        <button type="button" className="btn-secondary mt-2 text-xs" onClick={onRetry}>
          Повторить
        </button>
      </div>
    )
  }
  if (!data) return null

  const sp = data.submission_portal || {}
  const nbrb = data.nbrb_fx || {}
  const sig = data.signing || {}
  const modeLabel = sp.mode === 'http' ? 'HTTP-адаптер' : sp.mode === 'mock' ? 'Мок-портал' : String(sp.mode || '—')
  const nbrbCount =
    typeof nbrb.currencies_count === 'number' ? nbrb.currencies_count : null
  const nbrbErr = typeof nbrb.stale_error === 'string' ? nbrb.stale_error : null

  return (
    <div className="page-section p-5">
      <h3 className="mb-1 text-sm font-bold text-on-surface">Сводка контуров API</h3>
      <p className="mb-4 text-[11px] leading-relaxed text-on-surface-variant">
        Режимы на стороне сервера (без секретов). Полезно при проверке деплоя и подачи отчётов.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-outline/70 bg-surface-container-low p-4">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Подача отчётов</p>
          <p className="mt-1 text-sm font-bold text-on-surface">{modeLabel}</p>
          <ul className="mt-2 space-y-1 text-[11px] text-on-surface-variant">
            <li>URL адаптера задан: {sp.base_url_configured ? 'да' : 'нет'}</li>
            <li>Фоновая подача (SUBMISSION_ASYNC): {sp.async_submit_enabled ? 'включена' : 'выключена'}</li>
            {typeof sp.http_timeout_sec === 'number' && <li>Таймаут HTTP: {sp.http_timeout_sec} с</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-outline/70 bg-surface-container-low p-4">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Курсы НБ РБ</p>
          <p className="mt-1 text-sm font-bold text-on-surface">
            {nbrb.enabled === false ? 'Отключено' : 'Опрос API'}
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-on-surface-variant">
            {nbrb.last_fetch_at && (
              <li>Последний снимок: {new Date(String(nbrb.last_fetch_at)).toLocaleString('ru-BY')}</li>
            )}
            {nbrbCount !== null && <li>Валют в кэше: {nbrbCount}</li>}
            {nbrbErr && (
              <li className="text-amber-800 dark:text-amber-300">Предупреждение: {nbrbErr}</li>
            )}
            {nbrb.note && typeof nbrb.note === 'string' && <li>{nbrb.note}</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-outline/70 bg-surface-container-low p-4 sm:col-span-2">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Подпись отчётов (ЭЦП)</p>
          <p className="mt-1 break-all font-mono text-[11px] text-on-surface">
            {sig.digest_endpoint || '—'}
          </p>
          <p className="mt-2 text-[11px] text-on-surface-variant">
            Дайджест SHA-256 для внешнего модуля подписи. Демо-подпись в ответе:{' '}
            {sig.mock_signature_in_digest ? 'включена (только отладка)' : 'выключена'}.
          </p>
        </div>
      </div>
      {data.authorities && data.authorities.length > 0 && (
        <div className="fc-premium-table mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-outline/50 bg-surface-container-high text-on-surface-variant">
                <th className="px-3 py-2 font-semibold">Орган</th>
                <th className="px-3 py-2 font-semibold">Подача (режим)</th>
                <th className="px-3 py-2 font-semibold">Прямой API</th>
              </tr>
            </thead>
            <tbody>
              {data.authorities.map((a) => (
                <tr key={a.code} className="border-b border-outline/40 last:border-0">
                  <td className="px-3 py-2 font-bold text-on-surface">{a.label}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{a.submission_adapter || '—'}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{a.direct_api || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.queried_at && (
        <p className="mt-3 text-[10px] text-on-surface-variant/80">
          Запрос сводки: {new Date(data.queried_at).toLocaleString('ru-BY')}
        </p>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')
  const user = useAuthStore(s => s.user)
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <OperationalPage
      eyebrow="Аккаунт"
      title="Настройки"
      description="Профиль, интеграции, команда, биллинг и нормативные обновления."
      secondaryActions={
        <Link to="/onboarding/business-profile" className="btn-secondary w-full sm:w-auto">
          <Icon name="badge" className="text-lg" /> Профиль бизнеса
        </Link>
      }
    >
      <div className="page-section p-4 dark:border-outline/45 sm:p-5">
        <h2 className="mb-3 text-sm font-bold text-on-surface">Тема оформления</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`tap-highlight-none flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors sm:flex-initial ${
              theme === 'light'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline/75 bg-surface text-on-surface-variant hover:border-primary/35 dark:border-outline/45'
            }`}
          >
            <Icon name="light_mode" className="text-lg" />
            Светлая
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`tap-highlight-none flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors sm:flex-initial ${
              theme === 'dark'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline/75 bg-surface text-on-surface-variant hover:border-primary/35 dark:border-outline/45'
            }`}
          >
            <Icon name="dark_mode" className="text-lg" />
            Тёмная
          </button>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">Сохраняется только в этом браузере.</p>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max gap-1 rounded-xl bg-surface-container-high p-1 border border-outline/75 shadow-soft sm:inline-flex sm:min-w-0">
          {([
            { key: 'profile' as Tab, label: 'Профиль', icon: 'business' },
            { key: 'integrations' as Tab, label: 'Интеграции', icon: 'integration_instructions' },
            { key: 'billing' as Tab, label: 'Тариф', icon: 'payments' },
            { key: 'team' as Tab, label: 'Команда', icon: 'group' },
            { key: 'regulatory' as Tab, label: 'Законодательство', icon: 'gavel' },
          ]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`tap-highlight-none flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all sm:px-4 sm:py-1.5 ${
                tab === t.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={t.icon} className="text-sm" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'profile' && <ProfileSection />}
      {tab === 'integrations' && <IntegrationsSection isOwner={user?.role === 'owner'} />}
      {tab === 'billing' && <BillingSection />}
      {tab === 'team' && <TeamSection isOwner={user?.role === 'owner'} />}
      {tab === 'regulatory' && <RegulatorySection />}
    </OperationalPage>
  )
}

function ProfileSection() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const [tgChatId, setTgChatId] = useState('')
  const [tgMsg, setTgMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setTgChatId(user?.telegram_chat_id?.trim() || '')
  }, [user?.telegram_chat_id])

  const saveTgMutation = useMutation({
    mutationFn: () =>
      authApi.patchNotifications({
        telegram_chat_id: tgChatId.trim() === '' ? null : tgChatId.trim(),
      }),
    onSuccess: async () => {
      setTgMsg({ type: 'success', text: 'Telegram сохранён' })
      const { data } = await authApi.me()
      useAuthStore.setState({ user: data })
      qc.invalidateQueries({ queryKey: ['auth-me'] })
    },
    onError: (e: any) =>
      setTgMsg({
        type: 'error',
        text: e?.response?.data?.detail || 'Не удалось сохранить chat_id',
      }),
  })

  const rows = [
    { icon: 'person', label: 'Владелец', value: user?.full_name },
    { icon: 'mail', label: 'Email', value: user?.email },
    { icon: 'business', label: 'Организация', value: user?.org_name },
    { icon: 'badge', label: 'Форма', value: LEGAL_FORM_LABELS[user?.legal_form || ''] || user?.legal_form || '—' },
    { icon: 'receipt_long', label: 'Режим', value: TAX_REGIME_LABELS[user?.tax_regime || ''] || user?.tax_regime || '—' },
    { icon: 'shield_person', label: 'Роль', value: user?.role === 'owner' ? 'Владелец' : user?.role === 'accountant' ? 'Бухгалтер' : 'Наблюдатель' },
  ]

  return (
    <div className="space-y-4">
      <div className="page-section p-5">
        <h3 className="text-sm font-bold text-on-surface mb-4">Профиль организации</h3>
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-highest">
                <Icon name={r.icon} className="text-lg text-on-surface-variant" />
              </div>
              <div>
                <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">{r.label}</p>
                <p className="text-sm font-bold text-on-surface">{r.value || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-section p-5">
        <h3 className="text-sm font-bold text-on-surface mb-1">Telegram для напоминаний</h3>
        <p className="mb-4 text-[11px] leading-relaxed text-on-surface-variant">
          Укажите ваш личный chat_id, чтобы напоминания календаря и уведомления планера приходили в личку бота, а не только в общий чат.
          Откройте бота в Telegram, отправьте команду /start, затем узнайте chat_id (например через @userinfobot) и вставьте сюда только цифры.
        </p>
        {tgMsg && (
          <p
            className={`mb-3 text-xs ${tgMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'}`}
            role="status"
          >
            {tgMsg.text}
          </p>
        )}
        <label className="block">
          <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">chat_id</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="mt-1 w-full max-w-md rounded-lg border border-outline bg-surface px-3 py-2 text-sm text-on-surface"
            placeholder="Например 123456789"
            value={tgChatId}
            onChange={(e) => setTgChatId(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-primary mt-3 text-xs"
          disabled={saveTgMutation.isPending}
          onClick={() => saveTgMutation.mutate()}
        >
          {saveTgMutation.isPending ? 'Сохранение…' : 'Сохранить Telegram'}
        </button>
      </div>

      <AccountingModeCard />
      <OrgRequisitesCard />
    </div>
  )
}

function AccountingModeCard() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const role = (user?.role || '').toLowerCase()
  const allowed = role === 'owner' || role === 'admin' || role === 'accountant'
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-mode'],
    queryFn: () => accountingApi.getMode().then((r) => r.data as { accounting_mode?: string }),
    enabled: allowed,
  })

  const modeMutation = useMutation({
    mutationFn: (accounting_mode: 'simple' | 'advanced') => accountingApi.setMode(accounting_mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-mode'] })
      setMsg({ type: 'success', text: 'Режим учёта обновлён' })
    },
    onError: (e: unknown) =>
      setMsg({ type: 'error', text: formatApiDetail((e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) || 'Ошибка' }),
  })

  if (!allowed) return null
  const mode = (data?.accounting_mode || 'simple') as 'simple' | 'advanced'

  return (
    <div className="page-section p-5">
      <h3 className="mb-1 text-sm font-bold text-on-surface">Режим учёта</h3>
      <p className="mb-4 text-[11px] leading-relaxed text-on-surface-variant">
        <strong>Простой</strong> — журнал операций для SMB. <strong>Расширенный</strong> — план счетов и проводки для бухгалтера.
      </p>
      {isLoading ? (
        <p className="text-xs text-on-surface-variant">Загрузка…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['simple', 'Простой (журнал)'],
              ['advanced', 'Расширенный (план счетов)'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              disabled={modeMutation.isPending}
              onClick={() => modeMutation.mutate(val)}
              className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                mode === val
                  ? 'border-primary bg-primary/12 text-primary ring-1 ring-primary/25'
                  : 'border-outline-variant/40 text-on-surface-variant hover:border-primary/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === 'advanced' && (
        <Link to="/accounting/chart" className="mt-3 inline-flex text-xs font-bold text-primary hover:underline">
          Открыть план счетов →
        </Link>
      )}
      {msg && (
        <p className={`mt-3 text-xs ${msg.type === 'success' ? 'text-emerald-600' : 'text-error'}`}>{msg.text}</p>
      )}
    </div>
  )
}

function OrgRequisitesCard() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const role = (user?.role || '').toLowerCase()
  const allowed = role === 'owner' || role === 'admin' || role === 'accountant'
  const [legalAddress, setLegalAddress] = useState('')
  const [ceoName, setCeoName] = useState('')
  const [orgMsg, setOrgMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const reqQuery = useQuery({
    queryKey: ['org-requisites'],
    queryFn: () => teamApi.getOrgRequisites().then((r) => r.data as any),
    enabled: allowed,
  })

  useEffect(() => {
    const d = reqQuery.data
    if (!d) return
    setLegalAddress(d.legal_address || '')
    setCeoName(d.ceo_name || '')
  }, [reqQuery.data])

  const saveOrgMutation = useMutation({
    mutationFn: () =>
      teamApi.patchOrgRequisites({
        legal_address: legalAddress.trim() || null,
        ceo_name: ceoName.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-requisites'] })
      setOrgMsg({ type: 'success', text: 'Реквизиты сохранены' })
    },
    onError: (e: any) =>
      setOrgMsg({ type: 'error', text: formatApiDetail(e?.response?.data?.detail) || 'Ошибка' }),
  })

  async function downloadExport() {
    try {
      const res = await teamApi.exportOrgRequisites()
      const blob = new Blob([res.data], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rekvizity-organizacii.txt'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setOrgMsg({ type: 'error', text: formatApiDetail(e?.response?.data?.detail) || 'Не удалось скачать' })
    }
  }

  if (!allowed) return null

  return (
    <div className="page-section p-5">
      <h3 className="text-sm font-bold text-on-surface mb-1">Реквизиты для контрагентов</h3>
      <p className="mb-4 text-[11px] leading-relaxed text-on-surface-variant">
        Юридический адрес и ФИО руководителя для договоров и счетов. Банковские счета подтягиваются из раздела «Банк» (активные счета организации).
      </p>
      {orgMsg && (
        <p
          className={`mb-3 text-xs ${orgMsg.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-error'}`}
          role="status"
        >
          {orgMsg.text}
        </p>
      )}
      {reqQuery.isLoading ? (
        <p className="text-xs text-on-surface-variant">Загрузка…</p>
      ) : (
        <>
          <label className="block">
            <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Юридический адрес</span>
            <textarea
              className="mt-1 w-full max-w-xl rounded-lg border border-outline bg-surface px-3 py-2 text-sm text-on-surface"
              rows={2}
              value={legalAddress}
              onChange={(e) => setLegalAddress(e.target.value)}
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
              Руководитель (ФИО){' '}
              {reqQuery.data?.director_fallback && (
                <span className="font-normal text-on-surface-variant">подсказка: {reqQuery.data.director_fallback}</span>
              )}
            </span>
            <input
              type="text"
              className="mt-1 w-full max-w-xl rounded-lg border border-outline bg-surface px-3 py-2 text-sm text-on-surface"
              value={ceoName}
              onChange={(e) => setCeoName(e.target.value)}
              placeholder="Как в ЕГР"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={saveOrgMutation.isPending}
              onClick={() => saveOrgMutation.mutate()}
            >
              {saveOrgMutation.isPending ? 'Сохранение…' : 'Сохранить реквизиты'}
            </button>
            <button type="button" className="btn-primary text-xs" onClick={() => downloadExport()}>
              Скачать текстовый файл
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function IntegrationsSection({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [endpoint, setEndpoint] = useState('')
  const [token, setToken] = useState('')
  const [protocol, setProtocol] = useState('custom-http')
  const [llmKey, setLlmKey] = useState('')
  const [llmBase, setLlmBase] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [automationMode, setAutomationMode] = useState<'assist' | 'checkpoints' | 'autopilot'>('assist')
  const [autoReporting, setAutoReporting] = useState(false)
  const [autoWorkforce, setAutoWorkforce] = useState(false)
  const [autoSubmitLimit, setAutoSubmitLimit] = useState(20)

  const { data: cfg, isLoading } = useQuery({
    queryKey: ['onec-config'],
    queryFn: () => onecApi.getConfig().then((r) => r.data as any),
  })

  const { data: llmStatus } = useQuery({
    queryKey: ['assistant-status'],
    queryFn: () => assistantApi.status().then((r) => r.data),
    enabled: isOwner,
  })
  const { data: automationPolicy } = useQuery({
    queryKey: ['automation-policy'],
    queryFn: () => automationApi.policy().then((r) => r.data as any),
    enabled: isOwner,
  })
  const { data: automationScenarios } = useQuery({
    queryKey: ['automation-scenarios'],
    queryFn: () => automationApi.scenarios().then((r) => r.data as any),
    enabled: isOwner,
  })

  const { data: deployCaps, isLoading: capsLoading, isError: capsError, refetch: refetchCaps } = useQuery({
    queryKey: ['integrations-capabilities'],
    queryFn: () => integrationsApi.capabilities().then((r) => r.data as DeploymentCaps),
    staleTime: 60_000,
  })

  const saveLlmMutation = useMutation({
    mutationFn: () =>
      assistantApi.setOrganizationKey({
        api_key: llmKey.trim(),
        base_url: llmBase.trim() || null,
        model: llmModel.trim() || null,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['assistant-status'] })
      setLlmKey('')
      setMessage({ type: 'success', text: res.data.message || 'Ключ ИИ сохранён' })
    },
    onError: (e: any) =>
      setMessage({ type: 'error', text: e?.response?.data?.detail || 'Ошибка сохранения ключа ИИ' }),
  })
  const saveAutomationMutation = useMutation({
    mutationFn: () =>
      automationApi.updatePolicy({
        mode: automationMode,
        allow_auto_reporting: autoReporting,
        allow_auto_workforce: autoWorkforce,
        max_auto_submissions_per_run: autoSubmitLimit,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-policy'] })
      qc.invalidateQueries({ queryKey: ['automation-scenarios'] })
      setMessage({ type: 'success', text: 'Политика автоматизации сохранена' })
    },
    onError: (e: any) =>
      setMessage({ type: 'error', text: e?.response?.data?.detail || 'Ошибка сохранения политики автоматизации' }),
  })

  const clearLlmMutation = useMutation({
    mutationFn: () => assistantApi.deleteOrganizationKey(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistant-status'] })
      setMessage({ type: 'success', text: 'Ключ ИИ организации удалён' })
    },
    onError: (e: any) =>
      setMessage({ type: 'error', text: e?.response?.data?.detail || 'Ошибка' }),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      onecApi.saveConfig({
        endpoint: endpoint.trim(),
        token: token.trim(),
        protocol: protocol || 'custom-http',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onec-config'] })
      setToken('')
      setMessage({ type: 'success', text: 'Подключение сохранено' })
    },
    onError: (e: any) =>
      setMessage({ type: 'error', text: e?.response?.data?.detail || 'Ошибка сохранения' }),
  })

  useEffect(() => {
    if (cfg?.configured && cfg.endpoint) {
      setEndpoint(String(cfg.endpoint))
      setProtocol(cfg.protocol || 'custom-http')
    }
  }, [cfg?.configured, cfg?.endpoint, cfg?.protocol])
  useEffect(() => {
    if (!automationPolicy) return
    setAutomationMode((automationPolicy.mode || 'assist') as 'assist' | 'checkpoints' | 'autopilot')
    setAutoReporting(Boolean(automationPolicy.allow_auto_reporting))
    setAutoWorkforce(Boolean(automationPolicy.allow_auto_workforce))
    setAutoSubmitLimit(Number(automationPolicy.max_auto_submissions_per_run || 20))
  }, [automationPolicy])

  return (
    <div className="space-y-4">
      <DeploymentOverviewSection
        data={deployCaps}
        loading={capsLoading}
        error={capsError}
        onRetry={() => refetchCaps()}
      />
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === 'success' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="page-section p-5">
        <h3 className="mb-1 text-sm font-bold text-on-surface">Внешний HTTP-сервис</h3>
        <p className="mb-4 text-[11px] text-on-surface-variant">
          Endpoint и токен для обмена через внешний API (см. docs/integrations/onec-contract.md). В продакшене только HTTPS.
        </p>
        {isLoading && (
          <p className="mb-3 text-xs text-on-surface-variant">Загрузка параметров подключения 1С…</p>
        )}
        {cfg?.configured && (
          <p className="mb-3 text-xs text-primary">
            Сейчас: подключено · токен: {cfg.token_masked || '***'}
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="label">Endpoint (URL)</label>
            <input
              className="input min-h-11 w-full rounded-xl font-mono text-sm"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/finklik/"
            />
          </div>
          <div>
            <label className="label">Токен (введите новый или оставьте пустым при первом сохранении из формы)</label>
            <input
              type="password"
              className="input min-h-11 w-full rounded-xl"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={cfg?.configured ? 'Оставьте пустым, чтобы не менять' : 'Bearer-токен'}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Протокол</label>
            <select className="input min-h-11 w-full rounded-xl" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
              <option value="custom-http">custom-http</option>
              <option value="odata">odata</option>
            </select>
          </div>
          <button
            type="button"
            className="btn-primary min-h-11"
            disabled={!endpoint.trim() || !token.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Сохраняем…' : 'Сохранить подключение'}
          </button>
        </div>
      </div>

      {isOwner && (
        <div className="page-section p-5">
          <h3 className="mb-1 text-sm font-bold text-on-surface">ИИ-консультант: изолированный ключ (BYOK)</h3>
          <p className="mb-4 text-[11px] leading-relaxed text-on-surface-variant">
            Сохраните API-ключ вашего LLM-провайдера (OpenAI-совместимый Chat Completions) — он шифруется и привязан только к вашей
            организации: другие клиенты ФинКлика его не видят, в логах он не хранится открытым текстом, расшифровка только на время
            запроса к провайдеру. Если ключ не задан, может использоваться общий ключ платформы (если настроен на сервере API).
          </p>
          {llmStatus?.org_key_configured && (
            <p className="mb-3 flex items-center gap-2 text-xs font-bold text-primary">
              <Icon name="lock" className="text-base" filled />
              Ключ организации сохранён · источник в чате: «организация»
            </p>
          )}
          {!llmStatus?.org_key_configured && llmStatus?.key_source === 'platform' && (
            <p className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Сейчас для ИИ используется платформенный ключ API (если задан у хостинга).
            </p>
          )}
          <div className="space-y-3">
            <div>
              <label className="label">API-ключ провайдера</label>
              <input
                type="password"
                className="input min-h-11 w-full rounded-xl font-mono text-sm"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-… или ключ совместимого API"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Base URL (необязательно)</label>
              <input
                className="input min-h-11 w-full rounded-xl font-mono text-sm"
                value={llmBase}
                onChange={(e) => setLlmBase(e.target.value)}
                placeholder="По умолчанию https://api.openai.com/v1"
              />
            </div>
            <div>
              <label className="label">Модель (необязательно)</label>
              <input
                className="input min-h-11 w-full rounded-xl font-mono text-sm"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="Например gpt-4o-mini"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary min-h-11"
                disabled={llmKey.trim().length < 8 || saveLlmMutation.isPending}
                onClick={() => saveLlmMutation.mutate()}
              >
                {saveLlmMutation.isPending ? 'Сохраняем…' : 'Сохранить ключ'}
              </button>
              <button
                type="button"
                className="btn-ghost min-h-11 border border-outline/75"
                disabled={!llmStatus?.org_key_configured || clearLlmMutation.isPending}
                onClick={() => clearLlmMutation.mutate()}
              >
                Удалить ключ организации
              </button>
            </div>
          </div>
        </div>
      )}
      {isOwner && (
        <div className="page-section p-5">
          <h3 className="mb-1 text-sm font-bold text-on-surface">Центр автопилота</h3>
          <p className="mb-4 text-[11px] text-on-surface-variant">
            Режимы: Assist, Checkpoints, Autopilot. Включайте только те сценарии, которые готовы к полностью автоматическому циклу.
          </p>
          <div className="space-y-3">
            <div>
              <label className="label">Режим</label>
              <select className="input min-h-11 w-full rounded-xl" value={automationMode} onChange={(e) => setAutomationMode(e.target.value as any)}>
                <option value="assist">Assist</option>
                <option value="checkpoints">Auto with checkpoints</option>
                <option value="autopilot">Autopilot</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="checkbox" className="rounded" checked={autoReporting} onChange={(e) => setAutoReporting(e.target.checked)} />
              Автоотчётность (автоподача подтверждённых отчётов)
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="checkbox" className="rounded" checked={autoWorkforce} onChange={(e) => setAutoWorkforce(e.target.checked)} />
              Автосценарии workforce (кадровые follow-up задачи)
            </label>
            <div>
              <label className="label">Лимит автоподач за запуск</label>
              <input
                type="number"
                min={1}
                max={100}
                className="input min-h-11 w-full rounded-xl"
                value={autoSubmitLimit}
                onChange={(e) => setAutoSubmitLimit(Math.max(1, Math.min(100, Number(e.target.value || 20))))}
              />
            </div>
            {Array.isArray(automationScenarios?.items) && automationScenarios.items.length > 0 && (
              <div className="rounded-lg border border-outline-variant/20 bg-surface p-3 text-xs text-on-surface-variant">
                {automationScenarios.items.map((s: any) => (
                  <p key={s.id}>
                    {s.enabled ? '●' : '○'} {s.title} ({s.schedule})
                  </p>
                ))}
              </div>
            )}
            <button type="button" className="btn-primary min-h-11" disabled={saveAutomationMutation.isPending} onClick={() => saveAutomationMutation.mutate()}>
              {saveAutomationMutation.isPending ? 'Сохраняем…' : 'Сохранить политику автоматизации'}
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-on-surface-variant">Интеграции можно временно отключить, оставив пустой endpoint.</p>
    </div>
  )
}

function BillingSection() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isOwner = user?.role === 'owner'
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: () => billingApi.subscription().then(r => r.data),
  })
  const { data: plansData } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => billingApi.plans().then(r => r.data),
  })

  const changePlanMutation = useMutation({
    mutationFn: (code: string) => billingApi.changePlan(code),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['billing-subscription'] })
      setMessage({ type: 'success', text: res.data.message })
    },
    onError: (e: any) => setMessage({ type: 'error', text: formatApiDetail(e.response?.data?.detail) || 'Ошибка' }),
  })

  const plans = plansData?.plans ?? []
  const currentPlan = subData?.plan
  const usage = subData?.usage
  const sub = subData?.subscription

  return (
    <div className="space-y-4">
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
        }`}>
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" /> {message.text}
        </div>
      )}

      {subLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Загрузка тарифа">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          <div className="page-section p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-on-surface">Текущий тариф</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                sub?.status === 'trial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : sub?.status === 'active' ? 'bg-secondary/10 text-secondary border border-secondary/20'
                : 'bg-error/10 text-error border border-error/20'
              }`}>
                {sub?.status === 'trial' ? 'Пробный период' : sub?.status === 'active' ? 'Активен' : sub?.status || '—'}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-primary">{currentPlan?.name || 'Бесплатный'}</p>
            <p className="text-xs text-on-surface-variant mt-1">
              {currentPlan?.price_byn ? `${(currentPlan.price_byn / 100).toFixed(2)} BYN/мес` : 'Бесплатно'}
            </p>
            {sub?.trial_ends_at && (
              <p className="text-xs text-amber-400 mt-2">
                <Icon name="schedule" className="text-xs align-middle mr-1" />
                Пробный период до {new Date(sub.trial_ends_at).toLocaleDateString('ru-BY')}
              </p>
            )}
          </div>

          {usage && currentPlan && (
            <div className="page-section p-5">
              <h3 className="text-sm font-bold text-on-surface mb-3">Использование</h3>
              <div className="space-y-2">
                {([
                  { label: 'Операции', used: usage.transactions, max: currentPlan.max_transactions },
                  { label: 'Сотрудники', used: usage.employees, max: currentPlan.max_employees },
                  { label: 'Контрагенты', used: usage.counterparties, max: currentPlan.max_counterparties },
                ] as const).map(u => {
                  const pct = Math.min((u.used / u.max) * 100, 100)
                  return (
                    <div key={u.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-on-surface-variant">{u.label}</span>
                        <span className="font-bold text-on-surface">{u.used} / {u.max}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-container-highest">
                        <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-error' : pct >= 70 ? 'bg-amber-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p: any) => {
              const isCurrent = currentPlan?.code === p.code
              return (
                <div key={p.code} className={`rounded-xl p-5 border transition-all ${
                  isCurrent ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/30'
                }`}>
                  <h4 className="text-sm font-bold text-on-surface">{p.name}</h4>
                  <p className="text-xl font-extrabold text-primary mt-1">
                    {p.price_byn ? `${(p.price_byn / 100).toFixed(0)} BYN` : 'Бесплатно'}
                    {p.price_byn > 0 && <span className="text-xs font-normal text-on-surface-variant">/мес</span>}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-on-surface-variant">
                    <li>{p.max_transactions} операций</li>
                    <li>{p.max_employees} сотрудников</li>
                    <li>{p.max_counterparties} контрагентов</li>
                    <li>{p.max_users} пользователей</li>
                    {p.has_reports && <li className="text-secondary">Отчётность</li>}
                    {p.has_bank_integration && <li className="text-secondary">Банк</li>}
                    {p.has_ai_assistant && <li className="text-secondary">ИИ-ассистент</li>}
                  </ul>
                  {isOwner && !isCurrent && (
                    <button
                      type="button"
                      className="btn-primary mt-3 w-full !text-xs"
                      disabled={changePlanMutation.isPending}
                      onClick={() => changePlanMutation.mutate(p.code)}
                    >
                      Выбрать
                    </button>
                  )}
                  {isCurrent && (
                    <p className="mt-3 text-center text-xs font-bold text-primary">Текущий</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function TeamSection({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'accountant' })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['team-members'], queryFn: () => teamApi.listMembers().then(r => r.data) })
  const { data: invData } = useQuery({ queryKey: ['team-invitations'], queryFn: () => teamApi.listInvitations().then(r => r.data) })

  const inviteMutation = useMutation({
    mutationFn: () => teamApi.invite(inviteForm),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['team-invitations'] })
      setShowInvite(false)
      setInviteForm({ email: '', role: 'accountant' })
      setMessage({ type: 'success', text: `Приглашение создано. Код: ${res.data.invite_code}` })
    },
    onError: (e: any) => setMessage({ type: 'error', text: formatApiDetail(e.response?.data?.detail) || 'Ошибка' }),
  })

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => teamApi.deactivateMember(userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-members'] }); setMessage({ type: 'success', text: 'Пользователь деактивирован' }) },
  })

  const cancelInvMutation = useMutation({
    mutationFn: (id: string) => teamApi.cancelInvitation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-invitations'] }); setMessage({ type: 'success', text: 'Приглашение отменено' }) },
  })

  const members = data?.members ?? []
  const invitations = invData?.invitations ?? []
  const maxUsers = data?.max_users ?? 2
  const currentCount = data?.current_count ?? 0

  return (
    <div className="space-y-4">
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
        }`}>
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" /> {message.text}
        </div>
      )}

      <div className="page-section flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-bold text-on-surface">Пользователи: {currentCount} из {maxUsers}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">Тариф позволяет до {maxUsers} пользователей в организации</p>
        </div>
        {isOwner && currentCount < maxUsers && (
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setShowInvite(true)}>
            <Icon name="person_add" className="text-lg" /> Пригласить
          </button>
        )}
      </div>

      <div className="fc-premium-table overflow-x-auto [-webkit-overflow-scrolling:touch] shadow-soft">
          <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-[10px] font-label text-on-surface-variant tracking-widest uppercase bg-surface-container-high/50">
              <th className="px-4 py-3 text-left sm:px-6 sm:py-4">Пользователь</th>
              <th className="px-4 py-3 text-left sm:px-6 sm:py-4">Роль</th>
              <th className="px-4 py-3 text-left sm:px-6 sm:py-4">Последний вход</th>
              <th className="px-4 py-3 text-left sm:px-6 sm:py-4">Статус</th>
              {isOwner && <th className="px-4 py-3 text-right sm:px-6 sm:py-4">Действия</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {isLoading ? (
              <tr>
                <td colSpan={isOwner ? 5 : 4} className="p-0">
                  <TableSkeleton rows={5} cols={isOwner ? 5 : 4} />
                </td>
              </tr>
            ) : members.map((m: any) => (
              <tr key={m.id} className="hover:bg-surface-container-high transition-colors">
                <td className="px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${m.role === 'owner' ? 'bg-primary/10' : 'bg-surface-container-highest'}`}>
                      <Icon name={m.role === 'owner' ? 'shield_person' : 'person'} className={`text-lg ${m.role === 'owner' ? 'text-primary' : 'text-on-surface-variant'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{m.full_name}</p>
                      <p className="text-xs text-on-surface-variant">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 sm:px-6 sm:py-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                    m.role === 'owner' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-variant text-on-surface-variant border border-outline-variant/20'
                  }`}>{m.role === 'owner' ? 'Владелец' : m.role === 'accountant' ? 'Бухгалтер' : 'Наблюдатель'}</span>
                </td>
                <td className="px-4 py-3 text-xs text-on-surface-variant sm:px-6 sm:py-4">
                  {m.last_login ? new Date(m.last_login).toLocaleString('ru-BY') : 'Ещё не входил'}
                </td>
                <td className="px-4 py-3 sm:px-6 sm:py-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                    m.is_active ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
                  }`}>{m.is_active ? 'Активен' : 'Отключён'}</span>
                </td>
                {isOwner && (
                  <td className="px-4 py-3 text-right sm:px-6 sm:py-4">
                    {m.role !== 'owner' && m.is_active && (
                      <button type="button" onClick={() => deactivateMutation.mutate(m.id)} className="btn-ghost !text-xs text-error hover:text-error">
                        <Icon name="person_off" className="text-sm" /> Отключить
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invitations.length > 0 && (
        <div className="page-section space-y-3 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-on-surface">Ожидающие приглашения</h3>
          {invitations.map((inv: any) => (
            <div key={inv.id} className="flex flex-col gap-2 rounded-lg bg-surface-container-high p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface">{inv.email}</p>
                <p className="text-xs text-on-surface-variant">Роль: {inv.role === 'accountant' ? 'Бухгалтер' : 'Наблюдатель'} · Код: <code className="rounded bg-surface-variant px-1 text-[10px]">{inv.invite_code}</code></p>
              </div>
              <button type="button" onClick={() => cancelInvMutation.mutate(inv.id)} className="btn-ghost !text-xs text-error hover:text-error sm:self-start">
                <Icon name="close" className="text-sm" /> Отменить
              </button>
            </div>
          ))}
        </div>
      )}

      {showInvite && (
        <AppModal
          title="Пригласить пользователя"
          onClose={() => setShowInvite(false)}
          footer={
            <div className="app-form-actions -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-3">
                <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setShowInvite(false)}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn-primary min-h-12 flex-1"
                  disabled={!inviteForm.email || inviteMutation.isPending}
                  onClick={() => inviteMutation.mutate()}
                >
                  {inviteMutation.isPending ? 'Отправляем...' : 'Пригласить'}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input min-h-11 rounded-xl"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="colleague@company.by"
              />
            </div>
            <div>
              <label className="label">Роль</label>
              <select
                className="input min-h-11 rounded-xl"
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              >
                <option value="accountant">Бухгалтер</option>
                <option value="viewer">Наблюдатель</option>
              </select>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}

function RegulatorySection() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<string>('')
  const [selectedUpdate, setSelectedUpdate] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['regulatory-updates', filter],
    queryFn: () => regulatoryApi.getUpdates(filter ? { authority: filter } : undefined).then(r => r.data),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => regulatoryApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regulatory-updates'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => regulatoryApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regulatory-updates'] }),
  })

  const updates = data?.updates ?? []
  const unreadCount = data?.unread_count ?? 0

  return (
    <div className="space-y-4">
      <div className="page-section flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <select className="input min-h-11 w-full rounded-xl sm:w-44" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Все органы</option>
            <option value="imns">ИМНС</option>
            <option value="fsszn">ФСЗН</option>
            <option value="belgosstrakh">Белгосстрах</option>
            <option value="belstat">Белстат</option>
          </select>
          {unreadCount > 0 && (
            <span className="text-xs bg-error/10 text-error px-2 py-1 rounded-md border border-error/20 font-bold">
              {unreadCount} непрочитанных
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button type="button" className="btn-ghost min-h-11 w-full text-xs sm:w-auto" onClick={() => markAllReadMutation.mutate()}>
            <Icon name="done_all" className="text-sm" /> Прочитать все
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Загрузка обновлений">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : updates.length === 0 ? (
        <div className="bg-surface-container-low rounded-xl p-16 text-center">
          <Icon name="gavel" className="text-5xl text-on-surface-variant/20" />
          <p className="text-on-surface-variant text-sm mt-4">Обновлений не найдено</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u: any) => {
            const sev = SEVERITY_ICONS[u.severity] || SEVERITY_ICONS.info
            return (
              <div key={u.id} className={`bg-surface-container-low rounded-xl p-5 border transition-all cursor-pointer hover:border-outline-variant/40 ${
                u.is_read ? 'border-outline-variant/10 opacity-70' : 'border-outline-variant/20'
              }`} onClick={() => { setSelectedUpdate(u); if (!u.is_read) markReadMutation.mutate(u.id) }}>
                <div className="flex items-start gap-4">
                  <Icon name={sev.icon} filled className={`text-xl mt-0.5 ${sev.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border ${AUTHORITY_COLORS[u.authority] || ''}`}>
                        {u.authority_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase bg-surface-variant text-on-surface-variant border border-outline-variant/20">
                        {u.category === 'law_change' ? 'Закон' : u.category === 'form_update' ? 'Форма' : u.category === 'rate_change' ? 'Ставка' : 'Срок'}
                      </span>
                      {!u.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <h3 className="text-sm font-bold text-on-surface">{u.title}</h3>
                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{u.summary}</p>
                    {u.effective_date && (
                      <p className="text-[10px] text-on-surface-variant mt-2">
                        <Icon name="event" className="text-xs align-middle mr-1" />
                        Вступает в силу: {new Date(u.effective_date).toLocaleDateString('ru-BY')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedUpdate && (
        <AppModal
          title={selectedUpdate.title}
          wide
          onClose={() => setSelectedUpdate(null)}
          footer={
            <div className="app-form-actions -mx-4 px-4 sm:mx-0 sm:px-0">
              <button type="button" className="btn-primary min-h-12 w-full" onClick={() => setSelectedUpdate(null)}>
                Закрыть
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border ${AUTHORITY_COLORS[selectedUpdate.authority] || ''}`}>
              {selectedUpdate.authority_name}
            </span>
            <p className="text-sm leading-relaxed text-on-surface-variant">{selectedUpdate.summary}</p>
            {selectedUpdate.effective_date && (
              <div className="rounded-lg bg-surface-container-low p-3">
                <p className="text-xs text-on-surface-variant">
                  <Icon name="event" className="mr-1 align-middle text-sm" /> Дата вступления в силу:{' '}
                  <span className="font-bold text-on-surface">{new Date(selectedUpdate.effective_date).toLocaleDateString('ru-BY')}</span>
                </p>
              </div>
            )}
          </div>
        </AppModal>
      )}
    </div>
  )
}

