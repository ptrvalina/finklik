import {
  complianceLevelRu,
  healthSignalRu,
  labelApiCode,
  reportingStatusRu,
  riskLevelRu,
} from '../i18n/apiLabels.ru'

/** RU-подписи для enum-полей снимка состояния (API отдаёт EN-коды). */
const LEVEL: Record<string, string> = {
  ...riskLevelRu,
  ok: 'в норме',
  attention: 'внимание',
  risk: 'риск',
}

export function snapshotLevelRu(code: string | undefined | null): string {
  return labelApiCode(LEVEL, code)
}

export function snapshotReportingStatusRu(code: string | undefined | null): string {
  return labelApiCode(reportingStatusRu, code)
}

export function snapshotComplianceRu(code: string | undefined | null): string {
  return labelApiCode(complianceLevelRu, code)
}

export function snapshotHealthSignalRu(code: string | undefined | null): string {
  return labelApiCode(healthSignalRu, code)
}
