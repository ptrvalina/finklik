from pydantic import BaseModel, Field


class AutomationPolicyUpdate(BaseModel):
    mode: str = Field(pattern="^(assist|checkpoints|autopilot)$")
    allow_auto_reporting: bool = False
    allow_auto_workforce: bool = False
    max_auto_submissions_per_run: int = Field(default=20, ge=1, le=100)


class AutomationPolicyResponse(BaseModel):
    mode: str
    allow_auto_reporting: bool
    allow_auto_workforce: bool
    max_auto_submissions_per_run: int

    model_config = {"from_attributes": True}
