from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_read_access, require_write_access
from app.crud.tag import create_tag, get_tag, list_tags, update_tag
from app.db import get_db
from app.schemas.tag import TagCreate, TagRead, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get(
    "",
    response_model=list[TagRead],
    summary="List tags",
    description="List all tags used for kits and links.",
    responses={401: {"description": "Authentication required"}},
)
def get_tags(db: Session = Depends(get_db), _auth=Depends(require_read_access)) -> list[TagRead]:
    return list_tags(db)


@router.post(
    "",
    response_model=TagRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create tag",
    description="Create a new tag for categorization.",
    responses={400: {"description": "Tag already exists"}, 401: {"description": "Authentication required"}},
)
def post_tag(
    payload: TagCreate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> TagRead:
    existing = next((t for t in list_tags(db) if t.name.lower() == payload.name.lower()), None)
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists")
    return create_tag(db, payload)


@router.put(
    "/{tag_id}",
    response_model=TagRead,
    summary="Update tag",
    description="Update a tag name/color.",
    responses={400: {"description": "Tag already exists"}, 401: {"description": "Authentication required"}, 404: {"description": "Tag not found"}},
)
def put_tag(
    tag_id: int,
    payload: TagUpdate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> TagRead:
    tag = get_tag(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if payload.name is not None:
        existing = next(
            (t for t in list_tags(db) if t.id != tag_id and t.name.lower() == payload.name.lower()),
            None,
        )
        if existing:
            raise HTTPException(status_code=400, detail="Tag already exists")

    update_tag(tag, payload)
    db.commit()
    db.refresh(tag)
    return tag
