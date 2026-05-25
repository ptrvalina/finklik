/** Локальные отметки пилотного онбординга (без сервера). */

const SEEN_OPERATIONS = 'finklik_seen_operations_v1'

export function markOperationsSeen() {
  try {
    localStorage.setItem(SEEN_OPERATIONS, '1')
  } catch {
    /* private mode */
  }
}

export function hasSeenOperations(): boolean {
  try {
    return localStorage.getItem(SEEN_OPERATIONS) === '1'
  } catch {
    return false
  }
}
