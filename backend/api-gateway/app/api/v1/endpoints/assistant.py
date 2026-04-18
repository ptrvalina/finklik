"""
Консультационный чат (общие подсказки по учёту и продукту).

Режимы LLM:
- Ключ организации (BYOK): хранится зашифрованно в БД, используется только для запросов этой организации к провайдеру.
- Платформенный OPENAI_API_KEY в окружении API — fallback, если у организации своего ключа нет.
- Без ключей — демо-ответы.
"""

from __future__ import annotations

import re

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import Organization, User
from app.services.org_llm_crypto import decrypt_org_llm_api_key, encrypt_org_llm_api_key
from app.services.assistant_knowledge import (
    append_demo_sources_footer,
    format_sources_for_api,
    get_sources_catalog,
    retrieve_for_query,
)

log = structlog.get_logger()
router = APIRouter(prefix="/assistant", tags=["assistant"])

SYSTEM_PROMPT = """Ты — ИИ-ассистент веб-приложения «ФинКлик» для малого бизнеса в Беларуси.
Твоя роль: напоминать о сроках и типовых шагах, ориентировать по разделам продукта, кратко объяснять практику взаимодействия с госорганами
на уровне общих ориентиров (ИМНС, ФСЗН, Белстат, Белгосстрах), подсказывать перспективы развития дела в нейтральной форме
(рост, риски, что уточнить у бухгалтера), не выдавая себя за официальный источник.

Ориентиры по источникам: официальные тексты НПА — на Pravo.by; разъяснения и сервисы — на порталах ИМНС, ФСЗН, Белстата, Белгосстраха;
справочно-правовые системы (Нормотека, Эталон-Онлайн и аналоги) — вспомогательные, договор с поставщиком на стороне клиента;
методические журналы (в т.ч. «Главбух») — не заменяют законодательство РБ.

Критически важно:
- Ты НЕ юрист и НЕ налоговый консультант. Не выдавай ответы за официальную позицию ИМНС/ФСЗН/Белстата/Белгосстраха.
- Всегда при спорных вопросах советуй обратиться к бухгалтеру или в соответствующий орган и сверять с первоисточниками.
- Не запрашивай и не проси пользователя прислать персональные данные, пароли, полные реквизиты счетов, API-ключи.
- Отвечай по-русски, кратко и по делу. Если ниже дан справочный контекст с id [kb-…], можешь ссылаться на него в тексте.
"""

RAG_MAX_CHARS = 12000

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


class OrgLlmKeyBody(BaseModel):
    api_key: str = Field(..., min_length=8, max_length=2048)
    base_url: str | None = Field(None, max_length=512)
    model: str | None = Field(None, max_length=128)


def _mock_reply(user_text: str) -> str:
    t = user_text.lower().strip()
    if not t:
        return "Напишите вопрос — я подскажу в общих чертах или объясню, как пользоваться разделами ФинКлика."

    if any(x in t for x in ("усн", "упрощен", "упрощённ")):
        return (
            "По УСН в общих чертах: учёт доходов (и при необходимости расходов — зависит от варианта) ведётся в разделе «Операции»; "
            "сводка — в «Аналитике» и экспортах в «Документах». Точные ставки, льготы и сроки уточняйте у бухгалтера или на сайте МНС. "
            "\n\nСейчас включён демо-режим без внешней нейросети. Для ИИ: владелец может задать изолированный ключ организации "
            "в «Настройки» → «Интеграции», либо администратор платформы настроит общий ключ на сервере API."
        )

    if any(x in t for x in ("ндс", "vat", "декларац")):
        return (
            "НДС и декларации — чувствительная тема: сроки и формы зависят от режима и статуса плательщика. В приложении есть выгрузки и календарь как напоминание, "
            "но итоговые решения — с бухгалтером.\n\nДемо-режим: для ИИ подключите ключ организации (изолированно в настройках) или платформенный ключ на API."
        )

    if any(x in t for x in ("фсзн", "взнос", "страхов", "белгосстрах", "белстат", "имнс", "мнс")):
        return (
            "Взносы, отчётность во внебюджетные фонды и госорганы требуют актуальных форм и сроков. В ФинКлике смотрите «Сдача отчётности», календарь и раздел законодательства. "
            "Для персонального расчёта обратитесь к специалисту.\n\nДемо-режим — для ответов нейросети настройте изолированный ключ ИИ организации или ключ платформы."
        )

    if any(x in t for x in ("сканер", "чек", "ocr", "документ")):
        return (
            "Раздел «Сканер»: загрузите PDF или изображение — сервис извлечёт текст и поля; затем можно создать операцию вручную после проверки. "
            "Всегда сверяйте суммы и реквизиты с оригиналом.\n\nДемо-режим без ИИ в этом чате — подключите ключ в настройках интеграций (изолированно для вашей организации)."
        )

    if any(x in t for x in ("банк", "счёт", "счет", "платёж", "платеж")):
        return (
            "В разделе «Банк» привязываются счета, смотрится баланс и создаются платежи (в демо — заглушка банка). Выписки и операции также отражаются в «Операциях» после импорта или ввода.\n\n"
            "Демо-режим чата: для ИИ задайте изолированный ключ организации или платформенный ключ API."
        )

    if any(x in t for x in ("api", "ключ", "openai", "изолир")):
        return (
            "Ключ API к провайдеру ИИ можно сохранить **только для вашей организации**: он шифруется в базе, не показывается другим клиентам и не попадает в логи; "
            "расшифровывается только на сервере на время запроса к LLM. Настройка: «Настройки» → «Интеграции» (только владелец). "
            "Альтернатива — общий ключ платформы на стороне хостинга API (если ваш договор это предусматривает)."
        )

    return (
        "Я могу кратко ориентировать по учёту в ФинКлике, по смыслу разделов приложения и по типовой практике взаимодействия с органами. "
        "Юридически значимые и налоговые решения принимайте со специалистом.\n\n"
        "Сейчас демо-режим: задайте изолированный ключ ИИ в настройках организации или подключите ИИ на уровне платформы."
    )


def _build_system_prompt_with_rag(rag_block: str | None) -> str:
    if not rag_block:
        return SYSTEM_PROMPT
    block = rag_block[:RAG_MAX_CHARS]
    return (
        SYSTEM_PROMPT
        + "\n\n---\nСправочный контекст (внутренняя база ФинКлик, не полный текст законов):\n\n"
        + block
    )


async def _openai_chat(
    messages: list[dict],
    *,
    api_key: str,
    base_url: str,
    model: str,
    system_prompt: str,
) -> str:
    base = (base_url or "https://api.openai.com/v1").rstrip("/")
    url = f"{base}/chat/completions"

    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}, *messages],
        "temperature": 0.35,
        "max_tokens": 1200,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            r = await client.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
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


async def _resolve_llm_for_org(
    db: AsyncSession,
    organization_id: str | None,
) -> tuple[str | None, str, str, str]:
    """api_key (plain), base_url, model, key_source: organization | platform | none."""
    default_base = (settings.OPENAI_BASE_URL or "https://api.openai.com/v1").rstrip("/")
    default_model = settings.OPENAI_MODEL or "gpt-4o-mini"

    if organization_id:
        org = await db.get(Organization, organization_id)
        if org and org.llm_api_key_encrypted:
            try:
                key = decrypt_org_llm_api_key(org.llm_api_key_encrypted)
            except ValueError as e:
                log.error("org_llm_decrypt_failed", organization_id=organization_id)
                raise HTTPException(
                    status_code=503,
                    detail="Сохранённый ключ ИИ не читается. Удалите его в настройках и введите снова.",
                ) from e
            base = (org.llm_base_url or "").strip().rstrip("/") or default_base
            model = (org.llm_model or "").strip() or default_model
            return key, base, model, "organization"

    plat = (settings.OPENAI_API_KEY or "").strip()
    if plat:
        return plat, default_base, default_model, "platform"
    return None, default_base, default_model, "none"


@router.get("/sources")
async def assistant_sources_catalog(_user: User = Depends(get_current_user)):
    """Каталог ориентиров: госпорталы, Pravo.by, типы СПС — для UI и прозрачности."""
    data = get_sources_catalog()
    if not data:
        return {"version": 1, "groups": []}
    return data


@router.get("/status")
async def assistant_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_key, _base, model, key_source = await _resolve_llm_for_org(db, current_user.organization_id)
    org_configured = False
    if current_user.organization_id:
        org = await db.get(Organization, current_user.organization_id)
        org_configured = bool(org and org.llm_api_key_encrypted)

    return {
        "llm_enabled": bool(api_key),
        "model": model if api_key else None,
        "key_source": key_source,
        "org_key_configured": org_configured,
        "isolation_note": (
            "При ключе организации запросы к ИИ идут с вашим ключом; он хранится в зашифрованном виде, "
            "не передаётся другим клиентам и не пишется в логи в открытом виде."
            if org_configured
            else None
        ),
    }


@router.post("/chat")
async def assistant_chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    history = _sanitize_history(body.messages)
    if not history:
        raise HTTPException(400, detail="Нет текста сообщения")

    last = history[-1]
    if last["role"] != "user":
        raise HTTPException(400, detail="Последнее сообщение должно быть от пользователя")

    retrieved_chunks, rag_block = retrieve_for_query(last["content"], limit=6)
    sources = format_sources_for_api(retrieved_chunks)

    api_key, base, model, key_source = await _resolve_llm_for_org(db, current_user.organization_id)
    if not api_key:
        reply = _mock_reply(last["content"]) + append_demo_sources_footer(last["content"])
        return {
            "reply": reply,
            "mode": "demo",
            "llm_key_source": "none",
            "sources": sources,
            "rag": True,
        }

    system_prompt = _build_system_prompt_with_rag(rag_block or None)
    reply = await _openai_chat(
        history,
        api_key=api_key,
        base_url=base,
        model=model,
        system_prompt=system_prompt,
    )
    if not reply:
        reply = "Не удалось сформулировать ответ. Переформулируйте вопрос или попробуйте позже."
    return {
        "reply": reply,
        "mode": "llm",
        "llm_key_source": key_source,
        "sources": sources,
        "rag": bool(rag_block),
    }


@router.post("/organization-key")
async def set_organization_llm_key(
    body: OrgLlmKeyBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "owner":
        raise HTTPException(403, detail="Только владелец организации может сохранить ключ ИИ")
    if not current_user.organization_id:
        raise HTTPException(400, detail="У пользователя нет организации")

    org = await db.get(Organization, current_user.organization_id)
    if not org:
        raise HTTPException(404, detail="Организация не найдена")

    org.llm_api_key_encrypted = encrypt_org_llm_api_key(body.api_key)
    bu = (body.base_url or "").strip()
    org.llm_base_url = bu or None
    mo = (body.model or "").strip()
    org.llm_model = mo or None
    await db.flush()
    log.info("assistant_org_key_set", organization_id=org.id, user_id=current_user.id)
    return {"ok": True, "message": "Ключ сохранён в зашифрованном виде только для вашей организации."}


@router.delete("/organization-key")
async def delete_organization_llm_key(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "owner":
        raise HTTPException(403, detail="Только владелец организации может удалить ключ ИИ")
    if not current_user.organization_id:
        raise HTTPException(400, detail="У пользователя нет организации")

    org = await db.get(Organization, current_user.organization_id)
    if not org:
        raise HTTPException(404, detail="Организация не найдена")

    org.llm_api_key_encrypted = None
    org.llm_base_url = None
    org.llm_model = None
    await db.flush()
    log.info("assistant_org_key_cleared", organization_id=org.id, user_id=current_user.id)
    return {"ok": True}
