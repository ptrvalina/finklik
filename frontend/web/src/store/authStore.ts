import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, resolveApiBase } from '../api/client'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  org_name: string | null
  organization_id: string | null
  legal_form: string | null
  tax_regime: string | null
}

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (data: { email: string; password: string }) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (data) => {
        // Стали с прошлой сессии access_token может протухнуть и сбить interceptor:
        // на форме логина его нужно убрать до запроса.
        try {
          localStorage.removeItem('access_token')
        } catch {
          /* localStorage недоступен — игнорируем */
        }
        set({ isLoading: true, error: null })
        try {
          const { data: tokens } = await authApi.login(data)
          localStorage.setItem('access_token', tokens.access_token)
          const { data: user } = await authApi.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (e: any) {
          const status = e.response?.status
          const rawDetail = e.response?.data?.detail
          const detail =
            typeof rawDetail === 'string' && rawDetail.trim()
              ? rawDetail
              : status === 401
                ? 'Неверный email или пароль'
                : status === 429
                  ? 'Слишком много попыток. Повторите позже.'
                  : null
          const apiHint = resolveApiBase()
          const code = e.code || (e.message ? String(e.message).slice(0, 60) : '')
          const fallback =
            e.code === 'ERR_NETWORK' || !e.response
              ? `Не удалось связаться с API (${apiHint})${code ? ` [${code}]` : ''}. Проверьте интернет, отключите VPN и блокировщики (uBlock, AdGuard) или попробуйте инкогнито.`
              : 'Ошибка входа'
          set({ error: detail || fallback, isLoading: false })
          throw e
        }
      },

      register: async (data) => {
        try {
          localStorage.removeItem('access_token')
        } catch {
          /* localStorage недоступен — игнорируем */
        }
        set({ isLoading: true, error: null })
        try {
          const { data: tokens } = await authApi.register(data)
          localStorage.setItem('access_token', tokens.access_token)
          const { data: user } = await authApi.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (e: any) {
          const rawDetail = e.response?.data?.detail
          const detail =
            typeof rawDetail === 'string' && rawDetail.trim()
              ? rawDetail
              : null
          const apiHint = resolveApiBase()
          const fallback =
            e.code === 'ERR_NETWORK' || !e.response
              ? `Не удалось связаться с API (${apiHint}). Проверьте сеть и попробуйте ещё раз.`
              : 'Ошибка регистрации'
          set({ error: detail || fallback, isLoading: false })
          throw e
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        set({ user: null, isAuthenticated: false })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'finklik-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
)
