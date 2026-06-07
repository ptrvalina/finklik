/** Человекочитаемые подписи этапов конвейера операций (вместо parsed/categorized). */
export function journalPipelineLabel(status?: string | null): string {
  switch (status) {
    case 'parsed':
      return 'Из банка или скана'
    case 'categorized':
      return 'С категорией'
    case 'verified':
      return 'Проверена'
    case 'reported':
      return 'В отчёте'
    case 'new':
    default:
      return 'Новая'
  }
}

export function journalPipelineBadgeClass(status?: string | null): string {
  switch (status) {
    case 'reported':
      return 'bg-secondary/10 text-secondary border border-secondary/20'
    case 'verified':
      return 'bg-blue-500/10 text-blue-700 border border-blue-500/20 dark:text-blue-300'
    case 'categorized':
      return 'bg-violet-500/10 text-violet-700 border border-violet-500/20 dark:text-violet-300'
    case 'parsed':
      return 'bg-amber-500/10 text-amber-800 border border-amber-500/20 dark:text-amber-300'
    default:
      return 'bg-surface-variant text-on-surface-variant border border-outline-variant/20'
  }
}
