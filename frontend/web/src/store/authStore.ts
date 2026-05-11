import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ACTIVE_ORG_STORAGE_KEY, authApi, resolveApiBase, workspaceApi } from '../api/client'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  org_name: string | null
  organization_id: string | null
  legal_form: string | null
  tax_regime: string | null
  telegram_chat_id?: string | null
}

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (data: { email: string; password: string }) => Promise<void>
  register: (data: any) => Promise<void>
  /** Переключить активную организацию (новый JWT, тот же аккаунт). */
  switchOrganization: (organizationId: string) => Promise<void>
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
          try {
            if (user.organization_id) localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, user.organization_id)
          } catch {
            /* storage */
          }
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
              ? `Не удалось связаться с API (${apiHint})${code ? ` [${code}]` : ''}. Откройте ${apiHint}/docs в новой вкладке. Если не открывается — попробуйте мобильный интернет (раздача с телефона), другой браузер или VPN: часть провайдеров режет доступ к зарубежным хостингам (Render). Блокировщики рекламы отключите для этой страницы.`
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
          try {
            if (user.organization_id) localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, user.organization_id)
          } catch {
            /* storage */
          }
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

      switchOrganization: async (organizationId: string) => {
        set({ isLoading: true, error: null })
        try {
          const { data: tokens } = await workspaceApi.switchOrg(organizationId)
          localStorage.setItem('access_token', tokens.access_token)
          try {
            localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, organizationId)
          } catch {
            /* storage */
          }
          const { data: user } = await authApi.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (e: any) {
          const rawDetail = e.response?.data?.detail
          const detail =
            typeof rawDetail === 'string' && rawDetail.trim()
              ? rawDetail
              : 'Не удалось переключить организацию'
          set({ error: detail, isLoading: false })
          throw e
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        try {
          localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY)
        } catch {
          /* storage */
        }
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
