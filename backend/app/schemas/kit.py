from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import BuildStatus, KitGrade
from app.schemas.tag import TagRead


class KitBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    grade: KitGrade
    series: str = Field(min_length=1, max_length=120)
    brand: str = Field(min_length=1, max_length=120)
    scale: str = Field(min_length=3, max_length=32)
    kit_number: str | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    purchase_shop: str | None = None
    build_status: BuildStatus = BuildStatus.NEW
    tag_ids: list[int] = Field(default_factory=list)
    thumbnail_asset_id: int | None = None

    @field_validator("name", "series", "brand", "scale", mode="before")
    @classmethod
    def normalize_required_strings(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be empty")
        return value

    @field_validator("purchase_price")
    @classmethod
    def validate_purchase_price(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value < 0:
            raise ValueError("purchase_price must be greater than or equal to 0")
        return value

    @field_validator("scale")
    @classmethod
    def validate_scale_format(cls, value: str) -> str:
        if "/" not in value:
            raise ValueError("scale must look like '1/144'")
        return value


class KitCreate(KitBase):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "name": "RG God Gundam",
                    "grade": "RG",
                    "series": "Mobile Fighter G Gundam",
                    "brand": "Bandai",
                    "scale": "1/144",
                    "kit_number": "RG-37",
                    "purchase_date": "2026-02-01",
                    "purchase_price": 35.99,
                    "purchase_shop": "Local Hobby Shop",
                    "build_status": "NEW",
                    "tag_ids": [1, 2],
                }
            ]
        }
    )


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
    thumbnail_asset_id: int | None = None

    @field_validator("name", "series", "brand", "scale", mode="before")
    @classmethod
    def normalize_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be empty")
        return value

    @field_validator("purchase_price")
    @classmethod
    def validate_update_purchase_price(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value < 0:
            raise ValueError("purchase_price must be greater than or equal to 0")
        return value

    @field_validator("scale")
    @classmethod
    def validate_update_scale_format(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if "/" not in value:
            raise ValueError("scale must look like '1/144'")
        return value

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "build_status": "IN_PROGRESS",
                    "purchase_shop": "Online Market",
                    "tag_ids": [3],
                }
            ]
        }
    )


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
    tags: list[TagRead] = Field(default_factory=list)
    thumbnail_asset_id: int | None = None


class KitListResponse(BaseModel):
    items: list[KitRead]
    total: int
