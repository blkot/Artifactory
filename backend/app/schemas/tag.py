from pydantic import BaseModel, ConfigDict, field_validator


class TagBase(BaseModel):
    name: str
    color: str | None = None


class TagCreate(TagBase):
    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name cannot be empty")
        return value


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def normalize_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("name cannot be empty")
        return value


class TagRead(TagBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
