from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl

from app.models.enums import LinkCategory
from app.schemas.tag import TagRead


class LinkBase(BaseModel):
    kit_id: int
    url: HttpUrl
    category: LinkCategory
    title: str
    notes: str | None = None
    tag_ids: list[int] = []


class LinkCreate(LinkBase):
    pass


class LinkUpdate(BaseModel):
    url: HttpUrl | None = None
    category: LinkCategory | None = None
    title: str | None = None
    notes: str | None = None
    tag_ids: list[int] | None = None


class LinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kit_id: int
    url: HttpUrl
    category: LinkCategory
    title: str
    notes: str | None = None
    created_at: datetime
    tags: list[TagRead] = []
