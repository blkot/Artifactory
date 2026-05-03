from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_read_access, require_write_access
from app.db import get_db
from app.models.filter_value import FilterValue
from app.schemas.filter_value import FilterValueCreate, FilterValueRead

router = APIRouter(prefix="/filters", tags=["filters"])


@router.get(
    "/{field}",
    summary="List filter values",
    description="Return all custom filter values for a given field (brand/series/scale).",
)
def get_filter_values(
    field: str,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
) -> list[FilterValueRead]:
    if field not in ("brand", "series", "scale"):
        raise HTTPException(status_code=404, detail="Unknown filter field")
    values = (
        db.query(FilterValue)
        .filter(FilterValue.field == field)
        .order_by(FilterValue.value)
        .all()
    )
    return [FilterValueRead.model_validate(v) for v in values]


@router.post(
    "/{field}",
    status_code=status.HTTP_201_CREATED,
    summary="Create filter value",
    description="Add a new custom filter value for a field.",
)
def create_filter_value(
    field: str,
    payload: FilterValueCreate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> FilterValueRead:
    if field not in ("brand", "series", "scale"):
        raise HTTPException(status_code=404, detail="Unknown filter field")
    value = payload.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Value is required")

    existing = (
        db.query(FilterValue)
        .filter(FilterValue.field == field, FilterValue.value == value)
        .first()
    )
    if existing:
        return FilterValueRead.model_validate(existing)

    fv = FilterValue(field=field, value=value)
    db.add(fv)
    db.commit()
    db.refresh(fv)
    return FilterValueRead.model_validate(fv)


@router.delete(
    "/{field}/{value}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete filter value",
)
def delete_filter_value(
    field: str,
    value: str,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> None:
    fv = (
        db.query(FilterValue)
        .filter(FilterValue.field == field, FilterValue.value == value)
        .first()
    )
    if not fv:
        raise HTTPException(status_code=404, detail="Filter value not found")
    db.delete(fv)
    db.commit()
