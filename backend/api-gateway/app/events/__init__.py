"""Гибридный слой событий (параллельно CRUD, без замены журнала)."""

from app.events.bootstrap import get_event_store, get_workflow_engine
from app.events.constants import (
    EV_AI_INSIGHT,
    EV_AI_SUGGESTION,
    EV_DOCUMENT_OCR_PROCESSED,
    EV_TRANSACTION_CREATED,
)

__all__ = [
    "get_event_store",
    "get_workflow_engine",
    "EV_TRANSACTION_CREATED",
    "EV_DOCUMENT_OCR_PROCESSED",
    "EV_AI_SUGGESTION",
    "EV_AI_INSIGHT",
]
