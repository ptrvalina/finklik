import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { teamApi } from '../../api/client'
import { orgQueryKey } from '../../lib/queryKeys'

/** Мягкое напоминание завершить ОКЭД-профиль (не блокирует работу). */
export default function BusinessProfileBanner() {
  const location = useLocation()
  const skip =
    location.pathname !== '/' ||
    location.pathname.startsWith('/onboarding') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register')

  const { data } = useQuery({
    queryKey: orgQueryKey('business-profile'),
    queryFn: () => teamApi.getBusinessProfile().then((r) => r.data),
    staleTime: 120_000,
    retry: false,
    enabled: !skip,
  })

  if (skip || !data || data.business_profile_completed) return null

  return (
    <div className="mb-3 mt-2 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-on-surface">
          <span className="font-bold">Профиль бизнеса:</span> укажите ОКЭД и режим — это займёт около 2 минут.
        </p>
        <Link to="/onboarding/business-profile" className="btn-primary !py-2 text-xs whitespace-nowrap">
          Заполнить профиль
        </Link>
      </div>
    </div>
  )
}
