import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  hasOperationalAnchors,
  loadOperationalSession,
  saveOperationalSession,
  type OperationalNextStep,
  type OperationalSessionV1,
} from '../lib/operationalSession'
import type { OperationalVerb } from '../lib/operationalVerbs'
import { verbLabel } from '../lib/operationalVerbs'

type OperationalContextValue = {
  session: OperationalSessionV1
  hasAnchors: boolean
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  patch: (partial: Partial<OperationalSessionV1>) => void
  setNextStep: (step: Omit<OperationalNextStep, 'at'> | null) => void
  continueNext: () => void
  recordOcrDoc: (id: string, title: string) => void
  recordTransaction: (id: string, title: string) => void
  recordWorkPack: (id: string, title: string) => void
  recordReportingBlocker: (label: string, path: string) => void
}

const OperationalContext = createContext<OperationalContextValue | null>(null)

function emptySession(): OperationalSessionV1 {
  return { v: 1 }
}

export function OperationalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const orgId = useAuthStore((s) => s.user?.organization_id ?? '')
  const [session, setSession] = useState<OperationalSessionV1>(emptySession)
  const [panelOpen, setPanelOpen] = useState(false)

  const hydrate = useCallback(() => {
    if (!orgId) {
      setSession(emptySession())
      return
    }
    setSession(loadOperationalSession(orgId) ?? emptySession())
  }, [orgId])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!orgId) return
    function onOrgChanged() {
      hydrate()
      setPanelOpen(false)
    }
    window.addEventListener('finklik:org-changed', onOrgChanged)
    return () => window.removeEventListener('finklik:org-changed', onOrgChanged)
  }, [orgId, hydrate])

  const persist = useCallback(
    (next: OperationalSessionV1) => {
      setSession(next)
      if (orgId) saveOperationalSession(orgId, next)
    },
    [orgId],
  )

  const patch = useCallback(
    (partial: Partial<OperationalSessionV1>) => {
      persist({ ...session, ...partial })
    },
    [session, persist],
  )

  const setNextStep = useCallback(
    (step: Omit<OperationalNextStep, 'at'> | null) => {
      if (!step) {
        const { nextStep: _, ...rest } = session
        persist({ ...rest })
        return
      }
      persist({
        ...session,
        nextStep: { ...step, at: Date.now() },
      })
    },
    [session, persist],
  )

  const recordOcrDoc = useCallback(
    (id: string, title: string) => {
      persist({
        ...session,
        lastOcrDoc: { id, title, at: Date.now() },
      })
    },
    [session, persist],
  )

  const recordTransaction = useCallback(
    (id: string, title: string) => {
      persist({
        ...session,
        lastTransaction: { id, title, at: Date.now() },
      })
    },
    [session, persist],
  )

  const recordWorkPack = useCallback(
    (id: string, title: string) => {
      persist({
        ...session,
        activeWorkPack: { id, title, at: Date.now() },
      })
    },
    [session, persist],
  )

  const recordReportingBlocker = useCallback(
    (label: string, path: string) => {
      persist({
        ...session,
        lastReportingBlocker: { label, path, at: Date.now() },
      })
    },
    [session, persist],
  )

  const continueNext = useCallback(() => {
    const step = session.nextStep
    if (!step?.path) return
    setPanelOpen(false)
    navigate(step.path)
  }, [session.nextStep, navigate])

  const value = useMemo(
    (): OperationalContextValue => ({
      session,
      hasAnchors: hasOperationalAnchors(session),
      panelOpen,
      setPanelOpen,
      patch,
      setNextStep,
      continueNext,
      recordOcrDoc,
      recordTransaction,
      recordWorkPack,
      recordReportingBlocker,
    }),
    [
      session,
      panelOpen,
      patch,
      setNextStep,
      continueNext,
      recordOcrDoc,
      recordTransaction,
      recordWorkPack,
      recordReportingBlocker,
    ],
  )

  return <OperationalContext.Provider value={value}>{children}</OperationalContext.Provider>
}

export function useOperational() {
  const ctx = useContext(OperationalContext)
  if (!ctx) throw new Error('useOperational вне OperationalProvider')
  return ctx
}

/** Безопасный хук для страниц вне провайдера (не должен случаться). */
export function useOperationalOptional() {
  return useContext(OperationalContext)
}

export function formatNextStepCta(step: OperationalNextStep | undefined): string {
  if (!step) return verbLabel('continue')
  return step.label || verbLabel(step.verb)
}
