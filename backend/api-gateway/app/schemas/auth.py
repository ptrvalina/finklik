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

    model_config = {"from_attributes": True}
