"""Абстракция провайдера подписи: Model A (клиент) по умолчанию; внешний API — заглушка."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class SignatureResult:
    signature_base64: str
    certificate_pem: str | None = None
    certificate_metadata: dict | None = None


@runtime_checkable
class SignatureProvider(Protocol):
    """Клиент вызывает локальный провайдер; сервер только проверяет результат."""

    name: str

    async def sign(self, document_hash_hex: str) -> SignatureResult: ...


class ClientSideProvider:
    """Model A: подписание выполняется в браузере/АРМ; API не вызывает крипто."""

    name = "client_side"

    async def sign(self, document_hash_hex: str) -> SignatureResult:  # pragma: no cover - stub
        raise RuntimeError("ClientSideProvider.sign must not be called on server")


class ExternalApiProvider:
    """Fallback B: заглушка внешнего провайдера (без реальной интеграции)."""

    name = "external_api_stub"

    async def sign(self, document_hash_hex: str) -> SignatureResult:
        raise NotImplementedError(
            "ExternalApiProvider is not wired. Use ClientSideProvider (default) and submit signature via /signing/complete."
        )


def default_provider() -> str:
    return ClientSideProvider.name
