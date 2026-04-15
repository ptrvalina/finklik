from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "ФинКлик API"
    APP_VERSION: str = "0.4.0"
    DEBUG: bool = False
    DATABASE_URL: str = "sqlite+aiosqlite:///./finklik.db"
    # Redis опционален: без валидного сервера кэш тихо отключается (см. redis_cache.py).
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    JWT_SECRET_KEY: str = "dev_secret_key_finklik_2024_min32chars"
    JWT_REFRESH_SECRET_KEY: str = "dev_refresh_key_finklik_2024_min32"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://finklik.vercel.app",
        "https://ptrvalina.github.io",
    ]
    MOCK_BANK_URL: str = "http://localhost:8001"
    ONEC_MOCK_URL: str = "http://localhost:8002"

    # Connection pool settings (for 40k clients)
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_PRE_PING: bool = True

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 120
    RATE_LIMIT_BURST: int = 30

    # Email (Resend / Mailgun / SendGrid). Пустой ключ = email не отправляется, код возвращается в API.
    EMAIL_API_KEY: str = ""
    EMAIL_API_URL: str = "https://api.resend.com/emails"
    EMAIL_FROM: str = "ФинКлик <noreply@finklik.by>"
    FRONTEND_URL: str = "https://ptrvalina.github.io/finklik"

    # AI assistant (OpenAI-compatible Chat Completions). Пустой ключ = демо-ответы в /assistant/chat
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Массовое обновление подключений 1С (спринт 7). Пусто = эндпоинт отключён.
    PROVISION_ADMIN_TOKEN: str = ""
    # Webhook оркестратора ИБ 1С. Пусто = POST /onec/webhooks/provision отключён (404).
    PROVISION_WEBHOOK_SECRET: str = ""
    # Webhook подтверждения оплаты счёта. Пусто = POST /primary-documents/webhooks/payment отключён (404).
    PAYMENT_WEBHOOK_SECRET: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def database_url_use_asyncpg(cls, v: object) -> object:
        """Облачные Postgres-URL (postgres:// / postgresql://) → asyncpg для SQLAlchemy async."""
        if not isinstance(v, str):
            return v
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v.startswith("postgresql://") and not v.startswith("postgresql+"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
