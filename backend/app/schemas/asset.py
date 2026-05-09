from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field

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
    external_source: str | None = None
    external_asset_id: str | None = None
    external_thumbnail_url: str | None = None
    created_at: datetime

    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        if self.thumbnail_path:
            return f"/api/v1/assets/{self.id}/thumbnail"
        return None


class AssetListResponse(BaseModel):
    items: list[AssetRead]
    total: int
