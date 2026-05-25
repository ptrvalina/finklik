import { useQuery, useQueryClient } from '@tanstack/react-query'
import { workspaceApi } from '../../api/client'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { pushRecentClient } from '../../lib/recentClients'

type Placement = 'sidebar' | 'header'

/** Лёгкое переключение активной организации (мульти-клиенты). */
export default function OrgSwitcher({
  className = '',
  placement = 'sidebar',
}: {
  className?: string
  placement?: Placement
}) {
  const qc = useQueryClient()
  const switchOrganization = useAuthStore((s) => s.switchOrganization)
  const activeId = useAuthStore((s) => s.user?.organization_id)

  const { data, refetch } = useQuery({
    queryKey: ['workspace', 'memberships'],
    queryFn: () => workspaceApi.memberships().then((r) => r.data),
  })

  const pinMutation = useMutation({
    mutationFn: ({ orgId, pinned }: { orgId: string; pinned: boolean }) =>
      workspaceApi.pinMembership(orgId, pinned),
    onSuccess: () => refetch(),
  })

  const list = data?.memberships ?? []
  if (list.length <= 1) return null

  const glassSelect =
    'max-w-[200px] cursor-pointer truncate rounded-xl border border-white/15 bg-black/25 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-inner backdrop-blur-sm transition hover:border-emerald-400/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 sm:max-w-[240px]'
  const surfaceSelect =
    'max-w-[160px] cursor-pointer truncate rounded-xl border border-outline/55 bg-surface-container-low px-2 py-1.5 text-[12px] font-medium text-on-surface shadow-xs transition hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/25 sm:max-w-[220px]'

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={
          placement === 'sidebar'
            ? 'hidden text-[10px] font-bold uppercase tracking-wider text-white/45 sm:inline'
            : 'hidden text-[10px] font-bold uppercase tracking-wider text-on-surface-variant sm:inline'
        }
      >
        Клиент
      </span>
      <select
        className={placement === 'sidebar' ? glassSelect : surfaceSelect}
        value={activeId || ''}
        onChange={(e) => {
          const v = e.target.value
          if (!v || v === activeId) return
          const picked = list.find((m: { organization_id: string }) => m.organization_id === v)
          void (async () => {
            try {
              if (picked?.name) pushRecentClient(v, picked.name)
              await qc.cancelQueries()
              await switchOrganization(v)
              await qc.invalidateQueries()
            } catch {
              /* authStore показывает ошибку при необходимости */
            }
          })()
        }}
        aria-label="Активная организация"
      >
        {list.map((m: any) => (
          <option key={m.organization_id} value={m.organization_id}>
            {m.is_pinned ? '★ ' : ''}{m.name}
          </option>
        ))}
      </select>
      {activeId && (
        <button
          type="button"
          title="Закрепить клиента"
          className="tap-highlight-none rounded-lg px-1.5 py-1 text-lg leading-none text-amber-400 hover:bg-white/10"
          onClick={() => {
            const cur = list.find((m: { organization_id: string }) => m.organization_id === activeId)
            if (cur) pinMutation.mutate({ orgId: activeId, pinned: !cur.is_pinned })
          }}
        >
          ★
        </button>
      )}
    </label>
  )
}
