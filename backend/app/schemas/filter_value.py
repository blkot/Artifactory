from pydantic import BaseModel, ConfigDict, Field


class FilterValueCreate(BaseModel):
    value: str = Field(min_length=1, max_length=200)

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"value": "Bandai"}]}
    )


class FilterValueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    value: str
