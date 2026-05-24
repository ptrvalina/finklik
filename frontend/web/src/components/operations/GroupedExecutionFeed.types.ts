export type OperationalItem = {
  id: string
  type: string
  priority: string
  status?: string
  entity_id?: string
  title: string
  context?: string | null
  action_path?: string | null
  ai_why?: string | null
  state_dimension?: string | null
  state_transition_hint?: string | null
  truth_confidence?: number | null
  governance_tags?: string[]
}
