import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { accountingApi, teamApi } from '../api/client'
import OnboardingShell from '../components/onboarding/OnboardingShell'
import OkedSelector, { hydrateOkedFromProfile, type OkedItem } from '../components/onboarding/OkedSelector'
import { guidanceForLegalForm } from '../lib/businessProfileGuidance'
import { activeOrgId, orgQueryKey } from '../lib/queryKeys'
import { useFormDraft } from '../lib/useFormDraft'
import { terminology } from '../i18n'
import { calmError } from '../i18n/messages.ru'

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

const STEPS = [
  { id: 'business', label: 'Бизнес' },
  { id: 'oked', label: 'ОКЭД' },
  { id: 'tax', label: 'Режим' },
]

type DraftShape = {
  legalForm: string
  taxRegime: string
  empBand: string
  step: number
}

export default function BusinessProfilePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [primary, setPrimary] = useState<OkedItem | null>(null)
  const [secondary, setSecondary] = useState<OkedItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const { value: draft, setValue: setDraft, clearDraft } = useFormDraft<DraftShape>(
    { legalForm: 'ip', taxRegime: 'usn_no_vat', empBand: 'none', step: 0 },
    { key: `finklik_bp_draft_${activeOrgId()}`, debounceMs: 450 },
  )

  const legalForm = draft.legalForm
  const taxRegime = draft.taxRegime
  const empBand = draft.empBand

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: orgQueryKey('business-profile'),
    queryFn: () => teamApi.getBusinessProfile().then((r) => r.data),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!profile || hydrated) return
    let cancelled = false
    void (async () => {
      const { primary: p, secondary: s } = await hydrateOkedFromProfile(profile.oked_primary, profile.oked_secondary)
      if (cancelled) return
      setPrimary(p)
      setSecondary(s)
      setDraft((d) => ({
        ...d,
        legalForm: profile.legal_form || d.legalForm,
        taxRegime: profile.tax_regime || d.taxRegime,
        empBand: profile.employee_count_band || d.empBand,
      }))
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [profile, hydrated, setDraft])

  useEffect(() => {
    setStep(draft.step)
  }, [draft.step])

  const guidance = useMemo(() => guidanceForLegalForm(legalForm), [legalForm])

  const autosaveMutation = useMutation({
    mutationFn: (partial: { mark_completed?: boolean }) =>
      teamApi.patchBusinessProfile({
        legal_form: legalForm,
        tax_regime: taxRegime,
        oked_primary: primary?.code,
        oked_secondary: secondary.map((s) => s.code),
        employee_count_band: empBand,
        mark_completed: partial.mark_completed ?? false,
      }),
    onMutate: () => setDraftSaveState('saving'),
    onSuccess: () => {
      setDraftSaveState('saved')
      void qc.invalidateQueries({ queryKey: orgQueryKey('business-profile') })
    },
    onError: () => setDraftSaveState('idle'),
  })

  const finishMutation = useMutation({
    mutationFn: async () => {
      await teamApi.patchBusinessProfile({
        legal_form: legalForm,
        tax_regime: taxRegime,
        oked_primary: primary?.code,
        oked_secondary: secondary.map((s) => s.code),
        employee_count_band: empBand,
        mark_completed: true,
      })
      const mode = guidance.accountingMode === 'lightweight' ? 'simple' : guidance.accountingMode
      try {
        await accountingApi.setMode(mode === 'advanced' ? 'advanced' : 'simple')
      } catch {
        /* режим опционален */
      }
    },
    onSuccess: () => {
      clearDraft()
      void qc.invalidateQueries({ queryKey: orgQueryKey('business-profile') })
      navigate('/')
    },
    onError: () => setErr(calmError('genericAction')),
  })

  function patchDraft(patch: Partial<DraftShape>) {
    setDraft((d) => ({ ...d, ...patch }))
    if (patch.step !== undefined) setStep(patch.step)
  }

  function canNext() {
    if (step === 0) return true
    if (step === 1) return !!primary
    return true
  }

  const stepTitle = step === 0 ? 'Тип бизнеса' : step === 1 ? terminology.onboarding.businessActivity : terminology.onboarding.taxMode

  return (
    <OnboardingShell
      title={stepTitle}
      subtitle={
        step === 0
          ? 'Это влияет на подсказки, режим учёта и сценарии работы в FinClick.'
          : step === 1
            ? 'Основной ОКЭД обязателен. Дополнительные — по желанию.'
            : 'Укажите налоговый режим и численность — можно изменить позже в настройках.'
      }
      steps={STEPS}
      currentStep={step}
      saveLabel="Автосохранение черновика"
      saveState={autosaveMutation.isPending ? 'saving' : draftSaveState}
      footer={
        <>
          {err && (
            <div className="rounded-xl border border-error/25 bg-error/10 p-3 text-sm text-error">{err}</div>
          )}
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" className="btn-secondary min-h-12 flex-1 rounded-2xl" onClick={() => patchDraft({ step: step - 1 })}>
                Назад
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn-primary min-h-12 flex-1 rounded-2xl"
                disabled={!canNext() || profileLoading}
                onClick={() => {
                  autosaveMutation.mutate({})
                  patchDraft({ step: step + 1 })
                }}
              >
                Далее
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary min-h-12 flex-1 rounded-2xl"
                disabled={!primary || finishMutation.isPending}
                onClick={() => finishMutation.mutate()}
              >
                {finishMutation.isPending ? 'Сохраняем…' : 'Завершить настройку'}
              </button>
            )}
          </div>
          <button type="button" className="btn-ghost w-full text-xs text-on-surface-variant" onClick={() => navigate('/')}>
            Пропустить сейчас
          </button>
        </>
      }
    >
      {step === 0 && (
        <section className="fc-onboarding-card space-y-4">
          <p className="label">Форма собственности</p>
          <div className="flex flex-wrap gap-2">
            {LEGAL_FORMS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                  legalForm === f.id ? 'bg-emerald-600 text-white' : 'bg-surface-container-high text-on-surface'
                }`}
                onClick={() => {
                  const g = guidanceForLegalForm(f.id)
                  patchDraft({
                    legalForm: f.id,
                    taxRegime: g.suggestedTax || taxRegime,
                  })
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-outline/40 bg-surface-container-lowest/80 p-3 text-sm text-on-surface-variant">
            <p className="font-medium text-on-surface">{guidance.hint}</p>
            <p className="mt-2 text-xs">{guidance.workflowHint}</p>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-emerald-700/90 dark:text-emerald-300/90">
              Режим учёта: {guidance.accountingMode === 'lightweight' ? 'лёгкий' : guidance.accountingMode === 'simple' ? 'упрощённый' : 'расширенный'}
            </p>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="fc-onboarding-card">
          <OkedSelector
            primary={primary}
            secondary={secondary}
            onPrimaryChange={setPrimary}
            onSecondaryChange={setSecondary}
          />
        </section>
      )}

      {step === 2 && (
        <>
          <section className="fc-onboarding-card space-y-3">
            <p className="label">{terminology.onboarding.taxMode}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TAX_MODES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`min-h-[3rem] rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    taxRegime === t.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-outline/40 hover:border-outline/70'
                  }`}
                  onClick={() => patchDraft({ taxRegime: t.id })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>
          <section className="fc-onboarding-card space-y-3">
            <p className="label">{terminology.onboarding.hasEmployees}</p>
            <div className="flex flex-wrap gap-2">
              {EMP_BANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`rounded-full px-3 py-2 text-sm font-medium ${
                    empBand === b.id ? 'bg-emerald-600 text-white' : 'bg-surface-container-high text-on-surface'
                  }`}
                  onClick={() => patchDraft({ empBand: b.id })}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </OnboardingShell>
  )
}
