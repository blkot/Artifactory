from pydantic import BaseModel, ConfigDict


class TagBase(BaseModel):
    name: str
    color: str | None = None


class TagCreate(TagBase):
    pass


class TagRead(TagBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
