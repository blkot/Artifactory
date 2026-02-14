from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import AssetType


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kit_id: int
    type: AssetType
    file_path: str
    thumbnail_path: str | None = None
    original_filename: str
    file_size: int
    mime_type: str
    description: str | None = None
    is_external_reference: bool
    created_at: datetime


class AssetListResponse(BaseModel):
    items: list[AssetRead]
    total: int
