from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud.tag import create_tag, list_tags
from app.db import get_db
from app.schemas.tag import TagCreate, TagRead

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagRead])
def get_tags(db: Session = Depends(get_db)) -> list[TagRead]:
    return list_tags(db)


@router.post("", response_model=TagRead, status_code=status.HTTP_201_CREATED)
def post_tag(payload: TagCreate, db: Session = Depends(get_db)) -> TagRead:
    existing = next((t for t in list_tags(db) if t.name.lower() == payload.name.lower()), None)
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists")
    return create_tag(db, payload)
