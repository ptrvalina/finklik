from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "ФинКлик API"
    APP_VERSION: str = "0.2.0"
    DEBUG: bool = False
    DATABASE_URL: str = "sqlite+aiosqlite:///./finklik.db"
    JWT_SECRET_KEY: str = "dev_secret_key_finklik_2024_min32chars"
    JWT_REFRESH_SECRET_KEY: str = "dev_refresh_key_finklik_2024_min32"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
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

    # AI assistant (OpenAI-compatible Chat Completions). Пустой ключ = демо-ответы в /assistant/chat
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
