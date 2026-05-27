from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, computed_field

from app.models.enums import LinkCategory
from app.schemas.tag import TagRead


class LinkBase(BaseModel):
    kit_id: int
    url: HttpUrl
    category: LinkCategory
    title: str
    notes: str | None = None
    source: str | None = Field(default=None, max_length=32)
    tag_ids: list[int] = Field(default_factory=list)


class LinkCreate(LinkBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "kit_id": 1,
                    "url": "https://example.com/review",
                    "category": "REVIEW",
                    "title": "Detailed Build Review",
                    "notes": "Useful panel lining tips.",
                    "source": "bilibili",
                    "tag_ids": [1],
                }
            ]
        }
    )


class LinkUpdate(BaseModel):
    url: HttpUrl | None = None
    category: LinkCategory | None = None
    title: str | None = None
    notes: str | None = None
    source: str | None = Field(default=None, max_length=32)
    tag_ids: list[int] | None = None

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"title": "Updated review title", "tag_ids": []}]}
    )


class LinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kit_id: int
    url: HttpUrl
    category: LinkCategory
    title: str
    notes: str | None = None
    source: str | None = None
    thumbnail_path: str | None = None
    created_at: datetime
    tags: list[TagRead] = Field(default_factory=list)

    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        if self.thumbnail_path:
            return f"/api/v1/links/{self.id}/thumbnail"
        return None
