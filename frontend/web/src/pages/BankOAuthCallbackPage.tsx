import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { bankApi } from '../api/client'

function extractAccountId(stateValue: string | null): string | null {
  if (!stateValue) return null
  const left = stateValue.split(':')[0]
  return left || null
}

export default function BankOAuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const code = params.get('code')
  const state = params.get('state')
  const accountId = useMemo(() => {
    const fromState = extractAccountId(state)
    if (fromState) return fromState
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bank_oauth_account_id')
    }
    return null
  }, [params, state])

  useEffect(() => {
    async function run() {
      if (!code || !accountId || !state) {
        setError('Не хватает параметров OAuth callback (code/state/account_id)')
        return
      }
      try {
        await bankApi.oauthCallback({ account_id: accountId, code, state })
        if (typeof window !== 'undefined') localStorage.removeItem('bank_oauth_account_id')
        setDone(true)
        setTimeout(() => navigate('/bank', { replace: true }), 1200)
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Не удалось завершить OAuth подключение')
      }
    }
    void run()
  }, [accountId, code, navigate, state])

  return (
    <section className="card-elevated mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-on-surface">Подключение банка</h1>
      {!done && !error && <p className="mt-2 text-on-surface-variant">Завершаем OAuth2 авторизацию...</p>}
      {done && <p className="mt-2 text-emerald-600">Банк успешно подключен. Возвращаем в раздел Банка...</p>}
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </section>
  )
}
