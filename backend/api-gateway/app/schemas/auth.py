from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    full_name: str = Field(min_length=2, max_length=255)
    org_name: str = Field(min_length=2, max_length=255)
    org_unp: str = Field(min_length=9, max_length=9)
    legal_form: str = Field(default="ip", pattern=r"^(ip|ooo)$")
    tax_regime: str = Field(default="usn_no_vat", pattern=r"^(usn_no_vat|usn_vat|osn_vat)$")

    @field_validator("org_unp")
    @classmethod
    def validate_unp(cls, v: str) -> str:
        if not re.fullmatch(r"\d{9}", v):
            raise ValueError("УНП должен состоять ровно из 9 цифр")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Пароль должен содержать хотя бы одну заглавную букву")
        if not re.search(r"\d", v):
            raise ValueError("Пароль должен содержать хотя бы одну цифру")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Refresh token in body is optional when the same value is sent in httpOnly cookie."""

    refresh_token: str | None = None
    #: Активная организация после мульти-клиентского режима (если не задано — домашняя из профиля).
    organization_id: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    organization_id: str | None
    org_name: str | None
    legal_form: str | None = None
    tax_regime: str | None = None
    telegram_chat_id: str | None = None

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    """Смена пароля: инвалидирует все refresh-сессии (jti сбрасывается)."""

    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Пароль должен содержать хотя бы одну заглавную букву")
        if not re.search(r"\d", v):
            raise ValueError("Пароль должен содержать хотя бы одну цифру")
        return v


class UserNotificationsPatch(BaseModel):
    """Обновление каналов уведомлений. Пустая строка снимает привязку Telegram."""

    telegram_chat_id: str | None = None

    @field_validator("telegram_chat_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("telegram_chat_id")
    @classmethod
    def validate_telegram_chat_id(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not re.fullmatch(r"-?\d{5,20}", s):
            raise ValueError(
                "Укажите chat_id из Telegram: только цифры (для групп допускается минус в начале). "
                "Напишите боту /start и скопируйте id из ответа или из @userinfobot."
            )
        return s
