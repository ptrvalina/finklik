import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/client'

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
        set({ isLoading: true, error: null })
        try {
          const { data: tokens } = await authApi.login(data)
          localStorage.setItem('access_token', tokens.access_token)
          localStorage.setItem('refresh_token', tokens.refresh_token)
          const { data: user } = await authApi.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (e: any) {
          const detail = e.response?.data?.detail
          const fallback =
            e.code === 'ERR_NETWORK' || !e.response
              ? 'Не удалось связаться с API. Убедитесь, что VITE_API_URL указывает на бэкенд при сборке. Если URL верный, проверьте CORS на сервере (должен быть разрешён Origin этого сайта).'
              : 'Ошибка входа'
          set({ error: detail || fallback, isLoading: false })
          throw e
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const { data: tokens } = await authApi.register(data)
          localStorage.setItem('access_token', tokens.access_token)
          localStorage.setItem('refresh_token', tokens.refresh_token)
          const { data: user } = await authApi.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (e: any) {
          set({ error: e.response?.data?.detail || 'Ошибка регистрации', isLoading: false })
          throw e
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
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
