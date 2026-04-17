import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamApi, regulatoryApi, submissionsApi, billingApi, onecApi } from '../api/client'
import { formatApiDetail } from '../utils/apiError'
import { useAuthStore } from '../store/authStore'
import AppModal from '../components/ui/AppModal'

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{name}</span>
}

type Tab = 'profile' | 'billing' | 'team' | 'regulatory' | 'submissions' | 'integrations'

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

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-variant text-on-surface-variant',
  pending_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  submitted: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  accepted: 'bg-secondary/10 text-secondary border-secondary/20',
  rejected: 'bg-error/10 text-error border-error/20',
}

const LEGAL_FORM_LABELS: Record<string, string> = { ip: 'ИП', ooo: 'ООО' }
const TAX_REGIME_LABELS: Record<string, string> = {
  usn_no_vat: 'УСН без НДС',
  usn_vat: 'УСН с НДС',
  osn_vat: 'Общая с НДС',
  usn_3: 'УСН (3%)',
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')
  const user = useAuthStore(s => s.user)

  return (
    <div className="max-w-7xl space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Настройки</h1>
        <p className="mt-1 text-sm text-zinc-500">Профиль, интеграции 1С, команда, законодательство и отчёты</p>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max gap-1 rounded-xl bg-surface-container-high p-1 ring-1 ring-white/[0.05] sm:inline-flex sm:min-w-0">
          {([
            { key: 'profile' as Tab, label: 'Профиль', icon: 'business' },
            { key: 'integrations' as Tab, label: 'Интеграции', icon: 'integration_instructions' },
            { key: 'billing' as Tab, label: 'Тариф', icon: 'payments' },
            { key: 'team' as Tab, label: 'Команда', icon: 'group' },
            { key: 'regulatory' as Tab, label: 'Законодательство', icon: 'gavel' },
            { key: 'submissions' as Tab, label: 'Подача отчётов', icon: 'send' },
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
      {tab === 'integrations' && <IntegrationsSection />}
      {tab === 'billing' && <BillingSection />}
      {tab === 'team' && <TeamSection isOwner={user?.role === 'owner'} />}
      {tab === 'regulatory' && <RegulatorySection />}
      {tab === 'submissions' && <SubmissionsSection />}
    </div>
  )
}

function ProfileSection() {
  const user = useAuthStore(s => s.user)

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
      <div className="rounded-xl bg-surface-container-low p-5 ring-1 ring-white/[0.05]">
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
    </div>
  )
}

function IntegrationsSection() {
  const qc = useQueryClient()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [endpoint, setEndpoint] = useState('')
  const [token, setToken] = useState('')
  const [protocol, setProtocol] = useState('custom-http')

  const { data: cfg, isLoading } = useQuery({
    queryKey: ['onec-config'],
    queryFn: () => onecApi.getConfig().then((r) => r.data as any),
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
      setMessage({ type: 'success', text: 'Подключение 1С сохранено' })
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

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Загрузка…</p>
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === 'success' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="rounded-xl bg-surface-container-low p-5 ring-1 ring-white/[0.05]">
        <h3 className="mb-1 text-sm font-bold text-on-surface">1С: HTTP-сервис</h3>
        <p className="mb-4 text-[11px] text-on-surface-variant">
          Endpoint и токен для обмена с конфигурацией 1С (см. docs/integrations/onec-contract.md). В продакшене только HTTPS.
        </p>
        {cfg?.configured && (
          <p className="mb-3 text-xs text-teal-300/90">
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
              placeholder="https://1c.example.com/api/finklik/"
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
      <p className="text-[11px] text-zinc-600">
        Реестр контура и health: раздел «Контур 1С» в меню. Очередь синхронизации — «Синхронизация 1С».
      </p>
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
        <div className="bg-surface-container-low rounded-xl p-12 text-center text-on-surface-variant text-sm">Загрузка...</div>
      ) : (
        <>
          <div className="rounded-xl bg-surface-container-low p-5 ring-1 ring-white/[0.05]">
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
            <div className="rounded-xl bg-surface-container-low p-5 ring-1 ring-white/[0.05]">
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

      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
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

      <div className="overflow-hidden rounded-xl bg-surface-container-low ring-1 ring-white/[0.05]">
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
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
              <tr><td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant text-sm sm:px-6">Загрузка...</td></tr>
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
      </div>

      {invitations.length > 0 && (
        <div className="space-y-3 rounded-xl bg-surface-container-low p-4 sm:p-5">
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
      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
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
        <div className="bg-surface-container-low rounded-xl p-12 text-center text-on-surface-variant text-sm">Загрузка...</div>
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
            <button type="button" className="btn-primary min-h-12 w-full" onClick={() => setSelectedUpdate(null)}>
              Закрыть
            </button>
          }
        >
          <div className="space-y-4">
            <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border ${AUTHORITY_COLORS[selectedUpdate.authority] || ''}`}>
              {selectedUpdate.authority_name}
            </span>
            <p className="text-sm leading-relaxed text-zinc-400">{selectedUpdate.summary}</p>
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

function SubmissionsSection() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ authority: 'fsszn', report_type: 'pu-3', report_period: `${new Date().getFullYear()}-Q1` })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['submissions'],
    queryFn: () => submissionsApi.list().then(r => r.data),
  })

  const { data: reportTypesData } = useQuery({
    queryKey: ['report-types'],
    queryFn: () => submissionsApi.getReportTypes().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => submissionsApi.create(createForm),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      setShowCreate(false)
      setPreviewData(res.data)
      flash('success', 'Отчёт сформирован — проверьте и подтвердите')
    },
    onError: (e: any) => flash('error', formatApiDetail(e.response?.data?.detail) || 'Ошибка'),
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => submissionsApi.confirm(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); flash('success', 'Отчёт подтверждён') },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => submissionsApi.submit(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['submissions'] }); flash('success', res.data.message || 'Отчёт отправлен') },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => submissionsApi.reject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); flash('success', 'Отчёт отклонён') },
  })

  function flash(type: 'success' | 'error', text: string) { setMessage({ type, text }); setTimeout(() => setMessage(null), 6000) }

  const submissions = data?.submissions ?? []
  const reportTypes: Record<string, Record<string, string>> = reportTypesData?.report_types ?? {}
  const currentAuthorityTypes = reportTypes[createForm.authority] || {}

  return (
    <div className="space-y-4">
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
          message.type === 'success' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-error/10 text-error border border-error/20'
        }`}>
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" /> {message.text}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-bold text-on-surface">Автоматическая подача отчётов</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">ФСЗН · ИМНС · Белгосстрах · Белстат</p>
        </div>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          <Icon name="add" className="text-lg" /> Сформировать отчёт
        </button>
      </div>

      <div className="rounded-xl bg-surface-container-low p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {['fsszn', 'imns', 'belgosstrakh', 'belstat'].map(auth => {
            const count = submissions.filter((s: any) => s.authority === auth).length
            const pending = submissions.filter((s: any) => s.authority === auth && s.status === 'pending_review').length
            return (
              <div key={auth} className="bg-surface-container-high p-4 rounded-lg text-center">
                <p className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border inline-block ${AUTHORITY_COLORS[auth]}`}>
                  {auth === 'fsszn' ? 'ФСЗН' : auth === 'imns' ? 'ИМНС' : auth === 'belgosstrakh' ? 'Белгосстрах' : 'Белстат'}
                </p>
                <p className="text-2xl font-bold text-on-surface mt-2">{count}</p>
                <p className="text-[10px] text-on-surface-variant">отчётов</p>
                {pending > 0 && <p className="text-[10px] text-amber-400 mt-1">{pending} на проверке</p>}
              </div>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-surface-container-low rounded-xl p-12 text-center text-on-surface-variant text-sm">Загрузка...</div>
      ) : submissions.length === 0 ? (
        <div className="bg-surface-container-low rounded-xl p-16 text-center">
          <Icon name="send" className="text-5xl text-on-surface-variant/20" />
          <p className="text-on-surface-variant text-sm mt-4">Отчётов ещё нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s: any) => (
            <div key={s.id} className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/10">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border ${AUTHORITY_COLORS[s.authority] || ''}`}>
                      {s.authority_name}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${STATUS_STYLES[s.status] || ''}`}>
                      {s.status_label}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-on-surface">{s.report_type_name}</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Период: {s.report_period} · Создан: {new Date(s.created_at).toLocaleDateString('ru-BY')}</p>
                  {s.submission_ref && <p className="text-xs text-secondary mt-1">Референс: {s.submission_ref}</p>}
                  {s.rejection_reason && <p className="text-xs text-error mt-1">Причина: {s.rejection_reason}</p>}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  {s.status === 'pending_review' && (
                    <>
                      <button type="button" onClick={() => setPreviewData(s)} className="btn-ghost !text-xs">
                        <Icon name="visibility" className="text-sm" /> Просмотр
                      </button>
                      <button type="button" onClick={() => confirmMutation.mutate(s.id)} className="btn-primary !text-xs !py-1.5" disabled={confirmMutation.isPending}>
                        <Icon name="check" className="text-sm" /> Подтвердить
                      </button>
                      <button type="button" onClick={() => rejectMutation.mutate(s.id)} className="btn-ghost !text-xs text-error" disabled={rejectMutation.isPending}>
                        <Icon name="close" className="text-sm" />
                      </button>
                    </>
                  )}
                  {s.status === 'confirmed' && (
                    <button type="button" onClick={() => submitMutation.mutate(s.id)} className="btn-primary !text-xs !py-1.5" disabled={submitMutation.isPending}>
                      <Icon name="send" className="text-sm" /> Отправить
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <AppModal
          title="Сформировать отчёт"
          wide
          onClose={() => setShowCreate(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" className="btn-secondary min-h-12 flex-1" onClick={() => setShowCreate(false)}>
                Отмена
              </button>
              <button type="button" className="btn-primary min-h-12 flex-1" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Формируем...' : 'Сформировать'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">Орган</label>
              <select
                className="input min-h-11 rounded-xl"
                value={createForm.authority}
                onChange={(e) => {
                  const auth = e.target.value
                  const types = reportTypes[auth] || {}
                  setCreateForm({ ...createForm, authority: auth, report_type: Object.keys(types)[0] || '' })
                }}
              >
                <option value="fsszn">ФСЗН</option>
                <option value="imns">ИМНС</option>
                <option value="belgosstrakh">Белгосстрах</option>
                <option value="belstat">Белстат</option>
              </select>
            </div>
            <div>
              <label className="label">Тип отчёта</label>
              <select
                className="input min-h-11 rounded-xl"
                value={createForm.report_type}
                onChange={(e) => setCreateForm({ ...createForm, report_type: e.target.value })}
              >
                {Object.entries(currentAuthorityTypes).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Период</label>
              <select
                className="input min-h-11 rounded-xl"
                value={createForm.report_period}
                onChange={(e) => setCreateForm({ ...createForm, report_period: e.target.value })}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={`${new Date().getFullYear()}-Q${q}`}>{new Date().getFullYear()} Q{q}</option>
                ))}
              </select>
            </div>
          </div>
        </AppModal>
      )}

      {previewData && (
        <AppModal
          title="Предпросмотр отчёта"
          wide
          onClose={() => setPreviewData(null)}
          footer={
            previewData.status === 'pending_review' ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  className="btn-ghost min-h-12 flex-1 text-error"
                  onClick={() => {
                    rejectMutation.mutate(previewData.id)
                    setPreviewData(null)
                  }}
                >
                  Отклонить
                </button>
                <button
                  type="button"
                  className="btn-primary min-h-12 flex-1"
                  onClick={() => {
                    confirmMutation.mutate(previewData.id)
                    setPreviewData(null)
                  }}
                >
                  Подтвердить
                </button>
              </div>
            ) : (
              <button type="button" className="btn-primary min-h-12 w-full" onClick={() => setPreviewData(null)}>
                Закрыть
              </button>
            )
          }
        >
          <div className="space-y-1 rounded-lg bg-surface-container-low p-4 font-mono text-xs text-on-surface-variant">
            {previewData.report_data &&
              Object.entries(previewData.report_data).map(([k, v]: [string, any]) => (
                <div key={k}>
                  {typeof v === 'object' && Array.isArray(v) ? (
                    <div className="mt-2">
                      <p className="mb-1 font-bold text-on-surface">{k}:</p>
                      {v.map((row: any, i: number) => (
                        <p key={i} className="pl-4">
                          {JSON.stringify(row)}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p>
                      <span className="font-bold text-on-surface">{k}:</span> {String(v)}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </AppModal>
      )}
    </div>
  )
}
