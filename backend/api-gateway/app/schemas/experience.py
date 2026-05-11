"""Flow 8.5: progressive experience — режим интерфейса без отдельных приложений."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ExperienceMode = Literal["solo", "operator", "accountant", "advanced"]

FeedDensity = Literal["minimal", "standard", "full"]


class SimplifiedStateProjection(BaseModel):
    """Человеческая формулировка состояния без внутренних имён полей."""

    headline: str
    supporting_line: str | None = None
    readiness_plain: str | None = Field(None, description="Готовность одной строкой для ИП/малого бизнеса.")


class ProgressiveExperienceMeta(BaseModel):
    mode: ExperienceMode = "operator"
    feed_density: FeedDensity = "standard"
    simplified_state: SimplifiedStateProjection | None = None
    #: Одна фраза — ответ на «что важнее всего сейчас»
    primary_focus_hint: str | None = None
