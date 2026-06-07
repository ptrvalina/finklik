import { useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { employeesApi } from '../../api/client'
import { PremiumEmptyState } from '../../components/premium'
import MoneyAmount from '../../components/ui/MoneyAmount'
import {
  EMPLOYMENT_LABEL,
  type HrMeta,
  type PersonnelDocument,
  totalDependents,
  workHoursPerWeek,
} from '../../lib/employeeListUtils'
import { calmError } from '../../i18n/messages.ru'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

const DOC_TYPES = [
  { id: 'passport', label: 'Паспорт / удостоверение' },
  { id: 'marriage', label: 'Свидетельство о браке' },
  { id: 'birth_child', label: 'Свидетельство о рождении ребёнка' },
  { id: 'disability', label: 'Справка об инвалидности' },
  { id: 'contract', label: 'Трудовой договор' },
  { id: 'order_hire', label: 'Приказ о приёме' },
  { id: 'other', label: 'Другое' },
] as const

const MAX_SCAN_BYTES = 900_000

type Tab = 'profile' | 'payroll' | 'documents'

export default function EmployeeDossierPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('profile')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [docType, setDocType] = useState<string>('other')
  const [docTitle, setDocTitle] = useState('')

  const { data: emp, isLoading, isError } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.get(id!).then((r) => r.data),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => employeesApi.update(id!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee', id] })
      void qc.invalidateQueries({ queryKey: ['employees'] })
      flash('success', 'Сохранено')
    },
    onError: () => flash('error', calmError('employeeSave')),
  })

  function flash(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3500)
  }

  const hr: HrMeta = emp?.hr_meta ?? {}
  const docs: PersonnelDocument[] = hr.personnel_documents ?? []
  const employment = hr.employment_type === 'secondary' ? 'secondary' : 'primary'

  function patchHr(patch: Partial<HrMeta>) {
    updateMutation.mutate({ hr_meta_patch: { ...hr, ...patch } })
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !emp) return
    if (file.size > MAX_SCAN_BYTES) {
      flash('error', 'Файл слишком большой (макс. ~900 КБ). Сожмите скан или загрузите PDF поменьше.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const data_url = typeof reader.result === 'string' ? reader.result : ''
      const next: PersonnelDocument = {
        id: crypto.randomUUID(),
        doc_type: docType,
        title: docTitle.trim() || DOC_TYPES.find((d) => d.id === docType)?.label || 'Документ',
        uploaded_at: new Date().toISOString(),
        mime_type: file.type || 'application/octet-stream',
        file_name: file.name,
        data_url,
      }
      patchHr({ personnel_documents: [next, ...docs] })
      setDocTitle('')
    }
    reader.readAsDataURL(file)
  }

  function removeDoc(docId: string) {
    patchHr({ personnel_documents: docs.filter((d) => d.id !== docId) })
  }

  if (isLoading) {
    return <p className="p-8 text-sm text-on-surface-variant">Загрузка личного дела…</p>
  }

  if (isError || !emp) {
    return (
      <PremiumEmptyState
        variant="compact"
        icon="person_off"
        title="Сотрудник не найден"
        actions={
          <Link to="/employees/list" className="btn-primary text-sm">
            К списку
          </Link>
        }
      />
    )
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link to="/employees/list" className="btn-ghost !px-0 !text-xs text-on-surface-variant">
            <Icon name="arrow_back" className="text-sm" /> Список сотрудников
          </Link>
          <h1 className="page-heading mt-2">{emp.full_name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {emp.position} · {EMPLOYMENT_LABEL[employment]} ·{' '}
            {emp.is_active ? `работает с ${emp.hire_date}` : `уволен ${emp.fire_date || '—'}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!emp.is_active ? (
            <span className="rounded-lg border border-error/30 bg-error/10 px-3 py-1.5 text-xs font-bold text-error">
              Уволен
            </span>
          ) : (
            <Link to="/employees/dismiss" className="btn-secondary text-sm">
              Оформить увольнение
            </Link>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
            message.type === 'success' ? 'border-secondary/20 bg-secondary/10 text-secondary' : 'border-error/20 bg-error/10 text-error'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-xl border border-outline/75 bg-surface-container-high p-1">
        {(
          [
            { key: 'profile' as Tab, label: 'Личные данные', icon: 'badge' },
            { key: 'payroll' as Tab, label: 'Ставка и учёт', icon: 'payments' },
            { key: 'documents' as Tab, label: 'Документы', icon: 'folder' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
              tab === t.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
            }`}
          >
            <Icon name={t.icon} className="text-base" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-on-surface">Идентификация</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Идентификационный номер" value={emp.identification_number || '—'} mono />
              <Row label="Гражданство" value={emp.citizenship || '—'} />
              <Row label="Телефон" value={emp.phone || '—'} />
              <Row label="E-mail" value={emp.email || '—'} />
              <Row label="Адрес" value={emp.address || '—'} />
            </dl>
          </section>
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-on-surface">Документ личности</h2>
            {emp.id_document ? (
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Тип" value={emp.id_document_type || '—'} />
                <Row label="Номер" value={[emp.id_document.series, emp.id_document.number].filter(Boolean).join(' ') || '—'} mono />
                <Row label="Кем выдан" value={emp.id_document.issued_by} />
                <Row label="Дата выдачи" value={emp.id_document.issued_date?.slice(0, 10) || '—'} />
              </dl>
            ) : (
              <p className="mt-4 text-sm text-on-surface-variant">Реквизиты не заполнены — добавьте при приёме или в карточке.</p>
            )}
          </section>
        </div>
      )}

      {tab === 'payroll' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-on-surface">Трудовые условия</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Должность" value={emp.position_name || emp.position} />
              <Row label="Подразделение" value={hr.subdivision || '—'} />
              <Row label="Вид занятости" value={EMPLOYMENT_LABEL[employment]} />
              <Row label="Оклад" value={<MoneyAmount value={emp.salary} className="inline-flex font-semibold" />} />
              <Row label="Ставка (ч/нед)" value={`${workHoursPerWeek(emp)} ч`} />
              <Row label="Дата приёма" value={emp.hire_date} />
              {!emp.is_active && <Row label="Дата увольнения" value={emp.fire_date || '—'} />}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={updateMutation.isPending}
                onClick={() =>
                  patchHr({ employment_type: employment === 'primary' ? 'secondary' : 'primary' })
                }
              >
                {employment === 'primary' ? 'Отметить как совместительство' : 'Сделать основным местом'}
              </button>
            </div>
          </section>
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-on-surface">Для расчёта налогов и ФСЗН</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Детей (иждивенцы)" value={String(totalDependents(emp))} />
              <Row
                label="Инвалидность"
                value={emp.disability_group ? `${emp.disability_group} группа` : 'нет'}
              />
              <Row label="Пенсионер" value={emp.is_pensioner ? 'да' : 'нет'} />
            </dl>
            <p className="mt-4 text-[11px] text-on-surface-variant">
              Эти параметры используются при расчёте зарплаты, вычетов и отчётности ПУ-3.
            </p>
          </section>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-4">
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-on-surface">Загрузить скан</h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              Копии свидетельств о браке, рождении детей, справок и других документов для личного дела.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Тип документа</label>
                <select className="input min-h-11 w-full" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOC_TYPES.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Название (необязательно)</label>
                <input
                  className="input min-h-11 w-full"
                  placeholder="Например: свидетельство о браке"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onFilePick} />
            <button type="button" className="btn-primary mt-4 text-sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload_file" className="text-lg" /> Выбрать файл
            </button>
          </section>

          {docs.length === 0 ? (
            <PremiumEmptyState
              variant="compact"
              icon="folder_open"
              title="Документов пока нет"
              description="Загрузите сканы — они сохранятся в личном деле сотрудника."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => (
                <div key={doc.id} className="glass-card rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface">{doc.title}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {DOC_TYPES.find((d) => d.id === doc.doc_type)?.label || doc.doc_type} ·{' '}
                        {doc.uploaded_at.slice(0, 10)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost !p-1 text-error"
                      aria-label="Удалить"
                      onClick={() => removeDoc(doc.id)}
                    >
                      <Icon name="delete" className="text-lg" />
                    </button>
                  </div>
                  {doc.data_url?.startsWith('data:image') ? (
                    <img
                      src={doc.data_url}
                      alt={doc.title}
                      className="mt-3 max-h-40 w-full rounded-lg border border-outline/30 object-contain bg-surface-container-low"
                    />
                  ) : (
                    <a
                      href={doc.data_url}
                      download={doc.file_name}
                      className="btn-secondary mt-3 w-full text-xs"
                    >
                      Скачать {doc.file_name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={`font-medium text-on-surface ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
