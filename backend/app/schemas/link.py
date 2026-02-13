from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from app.models.enums import LinkCategory
from app.schemas.tag import TagRead


class LinkBase(BaseModel):
    kit_id: int
    url: HttpUrl
    category: LinkCategory
    title: str
    notes: str | None = None
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
    created_at: datetime
    tags: list[TagRead] = Field(default_factory=list)
