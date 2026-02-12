from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: dict | None = None


class Message(BaseModel):
    message: str


class Timestamped(ORMBase):
    created_at: datetime
