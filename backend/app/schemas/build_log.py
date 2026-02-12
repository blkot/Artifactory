from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import BuildStatus


class BuildLogCreate(BaseModel):
    status: BuildStatus
    notes: str | None = None
    photo_id: int | None = None


class BuildLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kit_id: int
    status: BuildStatus
    notes: str | None = None
    photo_id: int | None = None
    created_at: datetime
