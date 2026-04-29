from datetime import datetime

from pydantic import BaseModel, Field


class PlannerTaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str | None = None
    attachments: list[str] = Field(default_factory=list)
    assignee_id: str = Field(min_length=36, max_length=36)


class PlannerReportCreate(BaseModel):
    content: str = Field(min_length=2)
    attachments: list[str] = Field(default_factory=list)


class PlannerTaskResponse(BaseModel):
    id: str
    tenant_id: str
    author_id: str
    assignee_id: str
    title: str
    description: str | None
    attachments: list[str]
    status: str
    created_at: datetime
    closed_at: datetime | None

    model_config = {"from_attributes": True}


class PlannerReportResponse(BaseModel):
    id: str
    task_id: str
    author_id: str
    content: str
    attachments: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}
