from pydantic import BaseModel


class StatusCount(BaseModel):
    status: str
    count: int


class GradeCount(BaseModel):
    grade: str
    count: int


class StatsResponse(BaseModel):
    total_kits: int
    total_spent: float
    completion_rate: float
    by_status: list[StatusCount]
    by_grade: list[GradeCount]
