from functools import lru_cache
from typing import Any, Literal

from pydantic import AliasChoices, Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.cors import compile_cors_origin_regex, dedupe_preserve_order, parse_cors_origins_env


_DEFAULT_CORS_CSV = ",".join(
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://finklik.vercel.app",
        "https://ptrvalina.github.io",
    ]
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

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

    #: Явный список Origin (credentials). Env `CORS_ORIGINS`: через запятую или JSON-массив строк.
    cors_origins_raw: str = Field(
        default=_DEFAULT_CORS_CSV,
        validation_alias=AliasChoices("CORS_ORIGINS"),
        description=(
            "Origins для CORS. Примеры: "
            "`https://app.example.com,https://staging.example.com` или "
            '`["https://a","https://b"]`.'
        ),
    )
    #: Дополнительные origin по шаблону (preview / tunnels). Пустая строка — отключить regex.
    CORS_ORIGIN_REGEX: str = (
        r"https://.*\.(trycloudflare\.com|vercel\.app|github\.io|onrender\.com)"
    )
    #: Кэш ответа на preflight OPTIONS (секунды); 0 — без заголовка max-age.
    CORS_PREFLIGHT_MAX_AGE: int = Field(default=600, ge=0, le=86400)

    #: Ограничение заголовка Host (защита от подмены). Пусто — middleware отключён (удобно за reverse-proxy).
    allowed_hosts_raw: str = Field(
        default="",
        validation_alias=AliasChoices("ALLOWED_HOSTS"),
        description="Через запятую: example.com,*.example.com — см. Starlette TrustedHostMiddleware.",
    )

    #: Для фронта на другом домене (Vercel → API Render) задайте `none` (только HTTPS).
    REFRESH_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    MOCK_BANK_URL: str = "http://localhost:8001"
    ONEC_MOCK_URL: str = "http://localhost:8002"

    # Connection pool settings (for 40k clients)
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_PRE_PING: bool = True

    # Rate limiting (per authenticated user when Bearer JWT present, else per IP)
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_BURST: int = 30

    # Email (Resend / Mailgun / SendGrid). Пустой ключ = email не отправляется, код возвращается в API.
    EMAIL_API_KEY: str = ""
    EMAIL_API_URL: str = "https://api.resend.com/emails"
    EMAIL_FROM: str = "ФинКлик <noreply@finklik.by>"
    FRONTEND_URL: str = "https://ptrvalina.github.io/finklik"

    # AI assistant (OpenAI-compatible Chat Completions). Пустой ключ = демо, если у организации нет своего BYOK-ключа.
    # Ключ организации (приоритетнее) хранится в БД в зашифрованном виде — см. /assistant/organization-key.
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Массовое обновление подключений 1С (спринт 7). Пусто = эндпоинт отключён.
    PROVISION_ADMIN_TOKEN: str = ""
    # Webhook оркестратора ИБ 1С. Пусто = POST /onec/webhooks/provision отключён (404).
    PROVISION_WEBHOOK_SECRET: str = ""
    # Webhook подтверждения оплаты счёта. Пусто = POST /primary-documents/webhooks/payment отключён (404).
    PAYMENT_WEBHOOK_SECRET: str = ""

    # Мок ответа «портала» при POST /submissions/{id}/submit: доля отказов [0,1], детерминированно по id заявки.
    MOCK_SUBMISSION_REJECT_RATE: float = Field(default=0.0, ge=0.0, le=1.0)

    # Режим подачи: mock — логика в API; http — POST на SUBMISSION_PORTAL_BASE_URL/submit (см. submission_portal.py).
    SUBMISSION_PORTAL_MODE: Literal["mock", "http"] = "mock"
    SUBMISSION_PORTAL_BASE_URL: str = ""
    SUBMISSION_PORTAL_HTTP_TIMEOUT_SEC: float = 30.0
    SUBMISSION_PORTAL_HTTP_RETRIES: int = 2

    # Курсы валют НБ РБ (фоновое обновление в API-процессе)
    NBRB_FX_REFRESH_SECONDS: int = Field(
        default=3600,
        ge=0,
        description="Интервал опроса www.nbrb.by (сек); 0 — без фонового цикла, только по запросу",
    )
    NBRB_FX_ENABLED: bool = True

    @field_validator("REFRESH_COOKIE_SAMESITE", mode="before")
    @classmethod
    def _refresh_cookie_samesite_ci(cls, v: Any) -> Any:
        if isinstance(v, str):
            lo = v.strip().lower()
            if lo in ("lax", "strict", "none"):
                return lo
        return v

    @field_validator("cors_origins_raw", mode="before")
    @classmethod
    def _cors_origins_raw(cls, v: Any) -> str:
        if v is None:
            return _DEFAULT_CORS_CSV
        s = str(v).strip()
        return s if s else _DEFAULT_CORS_CSV

    @field_validator("CORS_ORIGIN_REGEX", mode="after")
    @classmethod
    def _cors_regex_strip(cls, v: str) -> str:
        return (v or "").strip()

    @model_validator(mode="after")
    def _validate_cors_regex_compiles(self) -> Settings:
        compile_cors_origin_regex(self.CORS_ORIGIN_REGEX)
        return self

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        return parse_cors_origins_env(self.cors_origins_raw)

    @computed_field
    @property
    def cors_origin_regex_effective(self) -> str | None:
        return compile_cors_origin_regex(self.CORS_ORIGIN_REGEX)

    @computed_field
    @property
    def allowed_hosts(self) -> list[str]:
        s = self.allowed_hosts_raw.strip()
        if not s:
            return []
        parts = [x.strip() for x in s.split(",") if x.strip()]
        return dedupe_preserve_order(parts)

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
