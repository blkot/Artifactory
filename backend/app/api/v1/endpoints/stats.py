from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_read_access
from app.db import get_db
from app.schemas.stats import StatsResponse
from app.services.stats_service import StatsService

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get(
    "",
    response_model=StatsResponse,
    summary="Collection statistics",
    description="Get aggregate statistics for kits, spending, completion, status, and grades.",
    responses={401: {"description": "Authentication required"}},
)
def get_stats(db: Session = Depends(get_db), _auth=Depends(require_read_access)) -> StatsResponse:
    return StatsResponse(**StatsService(db).get_stats())
