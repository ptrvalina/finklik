"""
Консультационный чат (общие подсказки по учёту и продукту).
Без ключа API — демо-ответы; с OPENAI_API_KEY — вызов OpenAI Chat Completions.
"""

from __future__ import annotations

import re

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User

log = structlog.get_logger()
router = APIRouter(prefix="/assistant", tags=["assistant"])

SYSTEM_PROMPT = """Ты — внутренний помощник веб-приложения «ФинКлик» для малого бизнеса в Беларуси.
Отвечай по-русски, кратко и по делу. Помогай с бухгалтерским учётом на уровне общих ориентиров, навигации по функциям приложения,
категориям операций, срокам отчётности в общих чертах.

Критически важно:
- Ты НЕ юрист и НЕ налоговый консультант. Не выдавай ответы за официальную позицию ИМНС/ФСЗН и т.д.
- Всегда при сложных или спорных вопросах советуй обратиться к бухгалтеру или в соответствующий орган.
- Не запрашивай и не проси пользователя прислать персональные данные, пароли, полные реквизиты счетов.
"""

MAX_MESSAGES = 24
MAX_CONTENT_LEN = 6000


class ChatMessage(BaseModel):
    role: str
    content: str = Field(..., max_length=MAX_CONTENT_LEN)

    @field_validator("role")
    @classmethod
    def role_ok(cls, v: str) -> str:
        if v not in ("user", "assistant"):
            raise ValueError("role must be user or assistant")
        return v


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=MAX_MESSAGES)


def _mock_reply(user_text: str) -> str:
    t = user_text.lower().strip()
    if not t:
        return "Напишите вопрос — я подскажу в общих чертах или объясню, как пользоваться разделами ФинКлика."

    if any(x in t for x in ("усн", "упрощен", "упрощённ")):
        return (
            "По УСН в общих чертах: учёт доходов (и при необходимости расходов — зависит от варианта) ведётся в разделе «Операции»; "
            "сводка — в «Аналитике» и экспортах в «Документах». Точные ставки, льготы и сроки уточняйте у бухгалтера или на сайте МНС. "
            "\n\nСейчас включён демо-режим без внешней нейросети. Для ответов на основе ИИ задайте переменную окружения OPENAI_API_KEY на сервере API."
        )

    if any(x in t for x in ("ндс", "vat", "декларац")):
        return (
            "НДС и декларации — чувствительная тема: сроки и формы зависят от режима и статуса плательщика. В приложении есть выгрузки и календарь как напоминание, "
            "но итоговые решения — с бухгалтером.\n\nДемо-режим: для ИИ-ответов настройте OPENAI_API_KEY."
        )

    if any(x in t for x in ("фсзн", "взнос", "страхов")):
        return (
            "Взносы и отчётность во внебюджетные фонды требуют актуальных форм и сроков. В ФинКлике смотрите разделы «Налоги», «Календарь», «Настройки» → законодательство и подача отчётов. "
            "Для персонального расчёта обратитесь к специалисту.\n\nДемо-режим — добавьте OPENAI_API_KEY для ответов нейросети."
        )

    if any(x in t for x in ("сканер", "чек", "ocr", "документ")):
        return (
            "Раздел «Сканер»: загрузите PDF или изображение — сервис извлечёт текст и поля; затем можно создать операцию вручную после проверки. "
            "Всегда сверяйте суммы и реквизиты с оригиналом.\n\nДемо-режим без ИИ в этом чате — при необходимости задайте OPENAI_API_KEY."
        )

    if any(x in t for x in ("банк", "счёт", "счет", "платёж", "платеж")):
        return (
            "В разделе «Банк» привязываются счета, смотрится баланс и создаются платежи (в демо — заглушка банка). Выписки и операции также отражаются в «Операциях» после импорта или ввода.\n\n"
            "Демо-режим чата: для ИИ подключите OPENAI_API_KEY."
        )

    return (
        "Я могу кратко ориентировать по учёту в ФинКлике и по смыслу разделов приложения. "
        "Юридически значимые и налоговые решения принимайте со специалистом.\n\n"
        "Сейчас демо-режим (нет ключа OPENAI_API_KEY). После настройки ключа ответы будут генерироваться нейросетью с теми же ограничениями по дисклеймеру."
    )


async def _openai_chat(messages: list[dict]) -> str:
    key = (settings.OPENAI_API_KEY or "").strip()
    if not key:
        raise HTTPException(503, detail="LLM не настроен")

    base = (settings.OPENAI_BASE_URL or "https://api.openai.com/v1").rstrip("/")
    model = settings.OPENAI_MODEL or "gpt-4o-mini"
    url = f"{base}/chat/completions"

    payload = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages],
        "temperature": 0.35,
        "max_tokens": 1200,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            r = await client.post(
                url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.RequestError as e:
        log.warning("assistant_openai_network", error=str(e))
        raise HTTPException(502, detail="Не удалось связаться с сервисом ИИ") from e

    if r.status_code != 200:
        log.warning("assistant_openai_http", status=r.status_code, body=r.text[:500])
        raise HTTPException(502, detail="Сервис ИИ вернул ошибку")

    data = r.json()
    try:
        return (data["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError, TypeError):
        log.warning("assistant_openai_parse", body=str(data)[:300])
        raise HTTPException(502, detail="Некорректный ответ сервиса ИИ")


def _sanitize_history(msgs: list[ChatMessage]) -> list[dict]:
    out: list[dict] = []
    for m in msgs:
        text = m.content.strip()
        if not text:
            continue
        text = re.sub(r"```[\s\S]*?```", "[код удалён]", text)
        out.append({"role": m.role, "content": text[:MAX_CONTENT_LEN]})
    return out[-MAX_MESSAGES:]


@router.get("/status")
async def assistant_status(_user: User = Depends(get_current_user)):
    key = (settings.OPENAI_API_KEY or "").strip()
    return {"llm_enabled": bool(key), "model": (settings.OPENAI_MODEL or "gpt-4o-mini") if key else None}


@router.post("/chat")
async def assistant_chat(body: ChatRequest, _user: User = Depends(get_current_user)):
    history = _sanitize_history(body.messages)
    if not history:
        raise HTTPException(400, detail="Нет текста сообщения")

    last = history[-1]
    if last["role"] != "user":
        raise HTTPException(400, detail="Последнее сообщение должно быть от пользователя")

    key = (settings.OPENAI_API_KEY or "").strip()
    if not key:
        reply = _mock_reply(last["content"])
        return {"reply": reply, "mode": "demo"}

    reply = await _openai_chat(history)
    if not reply:
        reply = "Не удалось сформулировать ответ. Переформулируйте вопрос или попробуйте позже."
    return {"reply": reply, "mode": "llm"}
