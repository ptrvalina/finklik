import { documentsApi } from '../api/client'

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type ParsedReportPeriod =
  | { kind: 'quarter'; year: number; quarter: number }
  | { kind: 'month'; year: number; month: number }

const PERIOD_RE = /^(\d{4})-(Q([1-4])|M(0[1-9]|1[0-2]))$/

export function parseReportPeriod(period: string): ParsedReportPeriod | null {
  const m = period.match(PERIOD_RE)
  if (!m) return null
  const year = parseInt(m[1], 10)
  if (m[2].startsWith('Q')) {
    return { kind: 'quarter', year, quarter: parseInt(m[3], 10) }
  }
  return { kind: 'month', year, month: parseInt(m[4], 10) }
}

export function quarterFromMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Локальная дата YYYY-MM-DD без сдвига UTC. */
function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function quarterDateRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = quarter * 3
  const start = new Date(year, startMonth - 1, 1)
  const end = new Date(year, endMonth, 0)
  return { start: localYmd(start), end: localYmd(end) }
}

function monthDateRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { start: localYmd(start), end: localYmd(end) }
}

export type SubmissionExportAction = {
  key: string
  label: string
  hint?: string
  run: () => Promise<void>
}

export type SubmissionExportInput = {
  authority: string
  report_type: string
  report_period: string
  report_data?: Record<string, unknown> | null
}

/** Экспорты из «Документы», совпадающие по периоду с черновиком подачи (где есть API). */
export function buildSubmissionExportActions(s: SubmissionExportInput): SubmissionExportAction[] {
  const rd = s.report_data || {}
  const parsed = parseReportPeriod(s.report_period)
  const actions: SubmissionExportAction[] = []

  const periodStart =
    typeof rd.period_start === 'string' ? rd.period_start : undefined
  const periodEnd = typeof rd.period_end === 'string' ? rd.period_end : undefined

  if (s.authority === 'imns' && s.report_type === 'usn-declaration') {
    let start = periodStart
    let end = periodEnd
    if ((!start || !end) && parsed?.kind === 'quarter') {
      const r = quarterDateRange(parsed.year, parsed.quarter)
      start = r.start
      end = r.end
    }
    if ((!start || !end) && parsed?.kind === 'month') {
      const r = monthDateRange(parsed.year, parsed.month)
      start = r.start
      end = r.end
    }
    if (start && end) {
      actions.push({
        key: 'tax_txt',
        label: 'Налоговый отчёт (.txt)',
        run: async () => {
          const r = await documentsApi.taxReport(start!, end!)
          saveBlob(r.data as Blob, `tax_report_${start}_${end}.txt`)
        },
      })
    }
  }

  if (s.authority === 'imns' && s.report_type === 'vat-declaration') {
    let q: number | undefined
    let y: number | undefined
    if (parsed?.kind === 'quarter') {
      q = parsed.quarter
      y = parsed.year
    } else if (parsed?.kind === 'month') {
      q = quarterFromMonth(parsed.month)
      y = parsed.year
    }
    if (q !== undefined && y !== undefined) {
      const hint =
        parsed?.kind === 'month'
          ? 'Файл НДС — за весь квартал, в который попадает выбранный месяц (как в разделе Документы).'
          : undefined
      actions.push({
        key: 'vat_txt',
        label: 'Декларация НДС (.txt)',
        hint,
        run: async () => {
          const r = await documentsApi.vatDeclaration(q!, y!)
          saveBlob(r.data as Blob, `vat_declaration_Q${q}_${y}.txt`)
        },
      })
    }
  }

  if (s.authority === 'imns' && s.report_type === 'income-tax') {
    let start = periodStart
    let end = periodEnd
    if ((!start || !end) && parsed?.kind === 'quarter') {
      const r = quarterDateRange(parsed.year, parsed.quarter)
      start = r.start
      end = r.end
    }
    if ((!start || !end) && parsed?.kind === 'month') {
      const r = monthDateRange(parsed.year, parsed.month)
      start = r.start
      end = r.end
    }
    if (start && end) {
      actions.push({
        key: 'fin_pdf',
        label: 'Финансовый отчёт (.pdf)',
        hint: 'Сводка по проводкам за период; не форма налога на прибыль.',
        run: async () => {
          const r = await documentsApi.financialReportPdf(start!, end!)
          saveBlob(r.data as Blob, `financial_report_${start}_${end}.pdf`)
        },
      })
    }
  }

  if (s.authority === 'fsszn' && s.report_type === 'pu-3') {
    let q: number | undefined
    let y: number | undefined
    if (parsed?.kind === 'quarter') {
      q = parsed.quarter
      y = parsed.year
    } else if (parsed?.kind === 'month') {
      q = quarterFromMonth(parsed.month)
      y = parsed.year
    }
    if (q !== undefined && y !== undefined) {
      const hint =
        parsed?.kind === 'month'
          ? 'Файл ПУ-3 — за весь квартал (совпадает с экспортом из «Документы»).'
          : undefined
      actions.push({
        key: 'pu3_txt',
        label: 'Форма ПУ-3 (.txt)',
        hint,
        run: async () => {
          const r = await documentsApi.fssznPu3(q!, y!)
          saveBlob(r.data as Blob, `fsszn_pu3_Q${q}_${y}.txt`)
        },
      })
    }
  }

  return actions
}
