from __future__ import annotations

from app.events.handlers.ai_suggestion import AiSuggestionHandler
from app.events.handlers.business_state_touch import BusinessStateStaleHandler
from app.events.handlers.insight_stub import AiInsightStubHandler
from app.events.handlers.reconciliation_suggest import ReconciliationSuggestHandler
from app.events.workflow_engine import WorkflowEngine


def register_default_handlers(engine: WorkflowEngine) -> None:
    engine.register(AiSuggestionHandler())
    engine.register(ReconciliationSuggestHandler())
    engine.register(BusinessStateStaleHandler())
    engine.register(AiInsightStubHandler())
