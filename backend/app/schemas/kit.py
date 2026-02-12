from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import BuildStatus, KitGrade
from app.schemas.tag import TagRead


class KitBase(BaseModel):
    name: str
    grade: KitGrade
    series: str
    brand: str
    scale: str
    kit_number: str | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    purchase_shop: str | None = None
    build_status: BuildStatus = BuildStatus.NEW
    tag_ids: list[int] = []


class KitCreate(KitBase):
    pass


class KitUpdate(BaseModel):
    name: str | None = None
    grade: KitGrade | None = None
    series: str | None = None
    brand: str | None = None
    scale: str | None = None
    kit_number: str | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    purchase_shop: str | None = None
    build_status: BuildStatus | None = None
    tag_ids: list[int] | None = None


class KitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    grade: KitGrade
    series: str
    brand: str
    scale: str
    kit_number: str | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    purchase_shop: str | None = None
    build_status: BuildStatus
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead] = []


class KitListResponse(BaseModel):
    items: list[KitRead]
    total: int
