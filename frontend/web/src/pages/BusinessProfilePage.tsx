import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { okedApi, teamApi } from '../api/client'
import { terminology } from '../i18n'
import { calmError } from '../i18n/messages.ru'

type OkedItem = { code: string; name_ru: string }

const LEGAL_FORMS = [
  { id: 'ip', label: 'ИП' },
  { id: 'ooo', label: 'ООО' },
  { id: 'odo', label: 'ОДО' },
  { id: 'chup', label: 'ЧУП' },
  { id: 'self_employed', label: 'Самозанятый' },
]

const TAX_MODES = [
  { id: 'usn_no_vat', label: 'УСН без НДС' },
  { id: 'usn_vat', label: 'УСН с НДС' },
  { id: 'osn_vat', label: 'Общая система' },
]

const EMP_BANDS = [
  { id: 'none', label: 'Нет' },
  { id: 'up_to_5', label: 'До 5' },
  { id: 'up_to_20', label: 'До 20' },
  { id: 'over_20', label: '20+' },
]

export default function BusinessProfilePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [primary, setPrimary] = useState<OkedItem | null>(null)
  const [secondary, setSecondary] = useState<OkedItem[]>([])
  const [legalForm, setLegalForm] = useState('ip')
  const [taxRegime, setTaxRegime] = useState('usn_no_vat')
  const [empBand, setEmpBand] = useState('none')
  const [err, setErr] = useState<string | null>(null)

  const { data: profile } = useQuery({
    queryKey: ['business-profile'],
    queryFn: () => teamApi.getBusinessProfile().then((r) => r.data),
  })

  const { data: searchData } = useQuery({
    queryKey: ['oked-search', q],
    queryFn: () => okedApi.search(q, 12).then((r) => r.data.items as OkedItem[]),
    enabled: q.trim().length >= 2,
  })

  const { data: popular = [] } = useQuery({
    queryKey: ['oked-popular'],
    queryFn: () => okedApi.popular(12).then((r) => r.data as OkedItem[]),
  })

  useEffect(() => {
    if (!profile) return
    setLegalForm(profile.legal_form || 'ip')
    setTaxRegime(profile.tax_regime || 'usn_no_vat')
    setEmpBand(profile.employee_count_band || 'none')
    if (profile.oked_primary) {
      setPrimary({ code: profile.oked_primary, name_ru: profile.oked_primary })
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: () =>
      teamApi.patchBusinessProfile({
        legal_form: legalForm,
        tax_regime: taxRegime,
        oked_primary: primary?.code,
        oked_secondary: secondary.map((s) => s.code),
        employee_count_band: empBand,
        mark_completed: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-profile'] })
      navigate('/')
    },
    onError: () => setErr(calmError('genericAction')),
  })

  const suggestions = useMemo(() => {
    if (q.trim().length >= 2 && searchData) return searchData
    return popular
  }, [q, searchData, popular])

  function addSecondary(item: OkedItem) {
    if (primary?.code === item.code) return
    if (secondary.some((s) => s.code === item.code)) return
    setSecondary((s) => [...s, item])
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-24">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600/90">Онбординг</p>
        <h1 className="mt-2 font-headline text-2xl font-bold text-on-surface">{terminology.onboarding.businessActivity}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Укажите ОКЭД и режим — система настроит учёт, OCR и {terminology.execution.workPack.toLowerCase()} под ваш бизнес.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-error/25 bg-error/10 p-3 text-sm text-error">{err}</div>
      )}

      <section className="card-elevated space-y-3 rounded-2xl border border-outline/50 p-5">
        <p className="label">Тип бизнеса</p>
        <div className="flex flex-wrap gap-2">
          {LEGAL_FORMS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${legalForm === f.id ? 'bg-emerald-600 text-white' : 'bg-surface-container-high text-on-surface'}`}
              onClick={() => setLegalForm(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card-elevated space-y-3 rounded-2xl border border-outline/50 p-5">
        <p className="label">{terminology.onboarding.primaryOked}</p>
        <input
          className="input min-h-11 w-full rounded-xl"
          placeholder="Поиск: кафе, IT, магазин, доставка…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {primary && (
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Выбран: {primary.code} — {primary.name_ru}
          </p>
        )}
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {suggestions.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-500/10"
                onClick={() => {
                  setPrimary(item)
                  setQ('')
                }}
              >
                <span className="font-mono text-xs text-on-surface-variant">{item.code}</span>
                <span className="ml-2 text-on-surface">{item.name_ru}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-elevated space-y-3 rounded-2xl border border-outline/50 p-5">
        <p className="label">{terminology.onboarding.secondaryOked}</p>
        <div className="flex flex-wrap gap-2">
          {secondary.map((s) => (
            <span key={s.code} className="rounded-full bg-surface-container-high px-2 py-1 text-xs">
              {s.code}
            </span>
          ))}
        </div>
        <p className="text-xs text-on-surface-variant">Нажмите код в списке выше ещё раз, чтобы добавить дополнительный ОКЭД.</p>
        <div className="flex flex-wrap gap-2">
          {popular.slice(0, 6).map((item) => (
            <button
              key={`sec-${item.code}`}
              type="button"
              className="rounded-lg border border-outline/40 px-2 py-1 text-xs"
              onClick={() => addSecondary(item)}
            >
              + {item.code}
            </button>
          ))}
        </div>
      </section>

      <section className="card-elevated space-y-3 rounded-2xl border border-outline/50 p-5">
        <p className="label">{terminology.onboarding.taxMode}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TAX_MODES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded-xl border px-3 py-2 text-left text-sm ${taxRegime === t.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-outline/40'}`}
              onClick={() => setTaxRegime(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card-elevated space-y-3 rounded-2xl border border-outline/50 p-5">
        <p className="label">{terminology.onboarding.hasEmployees}</p>
        <div className="flex flex-wrap gap-2">
          {EMP_BANDS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${empBand === b.id ? 'bg-emerald-600 text-white' : 'bg-surface-container-high'}`}
              onClick={() => setEmpBand(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        className="btn-primary min-h-12 w-full rounded-2xl"
        disabled={!primary || saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? 'Сохраняем…' : 'Завершить настройку'}
      </button>
    </div>
  )
}
