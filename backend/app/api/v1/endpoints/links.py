from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import require_read_access, require_write_access
from app.api.exceptions import KitNotFoundException, LinkNotFoundException
from app.crud.kit import get_kit
from app.crud.link import create_link, delete_link, get_link, list_links, update_link
from app.crud.tag import get_tags_by_ids
from app.db import get_db
from app.schemas.link import LinkCreate, LinkRead, LinkUpdate

router = APIRouter(prefix="/links", tags=["links"])


@router.get(
    "",
    response_model=list[LinkRead],
    summary="List links",
    description="List reference links across kits.",
    responses={401: {"description": "Authentication required"}},
)
def get_links(db: Session = Depends(get_db), _auth=Depends(require_read_access)) -> list[LinkRead]:
    return list_links(db)


@router.post(
    "",
    response_model=LinkRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create link",
    description="Create a new reference link for a kit.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Kit not found"}},
)
def post_link(
    payload: LinkCreate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> LinkRead:
    if not get_kit(db, payload.kit_id):
        raise KitNotFoundException(payload.kit_id)

    link = create_link(db, payload)
    link.tags = get_tags_by_ids(db, payload.tag_ids)
    db.commit()
    db.refresh(link)
    return link


@router.put(
    "/{link_id}",
    response_model=LinkRead,
    summary="Update link",
    description="Update an existing link.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Link not found"}},
)
def put_link(
    link_id: int,
    payload: LinkUpdate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> LinkRead:
    link = get_link(db, link_id)
    if not link:
        raise LinkNotFoundException(link_id)

    update_link(link, payload)
    if payload.tag_ids is not None:
        link.tags = get_tags_by_ids(db, payload.tag_ids)

    db.commit()
    db.refresh(link)
    return link


@router.delete(
    "/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete link",
    description="Delete a reference link.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Link not found"}},
)
def remove_link(
    link_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
):
    link = get_link(db, link_id)
    if not link:
        raise LinkNotFoundException(link_id)
    delete_link(db, link)
    db.commit()
