from datetime import datetime

from pydantic import BaseModel, Field


class UserNoteCreate(BaseModel):
    title: str = Field(default="", max_length=500)
    body: str = ""


class UserNoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    body: str | None = None


class UserNoteResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    title: str
    body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
