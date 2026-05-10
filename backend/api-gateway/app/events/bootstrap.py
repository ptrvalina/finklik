"""Ленивая инициализация EventStore + WorkflowEngine (избегаем циклических импортов)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.events.store import EventStore
    from app.events.workflow_engine import WorkflowEngine

_store: EventStore | None = None
_engine: WorkflowEngine | None = None


def get_workflow_engine() -> WorkflowEngine:
    global _engine
    if _engine is None:
        from app.events.handlers import register_default_handlers
        from app.events.workflow_engine import WorkflowEngine

        _engine = WorkflowEngine()
        register_default_handlers(_engine)
    return _engine


def get_event_store() -> EventStore:
    global _store
    if _store is None:
        from app.events.store import EventStore

        eng = get_workflow_engine()
        _store = EventStore(workflow_engine=eng)
    return _store


def reset_for_tests() -> None:
    global _store, _engine
    _store = None
    _engine = None
