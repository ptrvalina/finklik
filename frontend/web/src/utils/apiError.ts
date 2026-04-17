/** Человекочитаемый текст из поля `detail` ответа FastAPI (строка | массив validation errors). */
export function formatApiDetail(detail: unknown): string {
  if (detail == null || detail === '') return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item != null && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: string }).msg)
        }
        return typeof item === 'string' ? item : JSON.stringify(item)
      })
      .filter(Boolean)
      .join('; ')
  }
  if (typeof detail === 'object' && detail !== null && 'message' in detail) {
    return String((detail as { message: string }).message)
  }
  return String(detail)
}
