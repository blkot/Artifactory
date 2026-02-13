from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_read_access, require_write_access
from app.core.config import get_settings
from app.crud.build_log import create_for_kit, list_by_kit
from app.crud.kit import create_kit, delete_kit, get_kit, list_kits, update_kit
from app.crud.tag import get_tags_by_ids
from app.db import get_db
from app.schemas.build_log import BuildLogCreate, BuildLogRead
from app.schemas.kit import KitCreate, KitListResponse, KitRead, KitUpdate
from app.services.search_service import SearchService

router = APIRouter(prefix="/kits", tags=["kits"])
settings = get_settings()


@router.get(
    "",
    response_model=KitListResponse,
    summary="List kits",
    description="List kits with pagination.",
    responses={401: {"description": "Authentication required"}},
)
def get_kits(
    skip: int = 0,
    limit: int = Query(default=settings.api_page_size_default, le=settings.api_page_size_max),
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
):
    items, total = list_kits(db, skip, limit)
    return KitListResponse(items=items, total=total)


@router.post(
    "",
    response_model=KitRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create kit",
    description="Create a new model kit record.",
    responses={401: {"description": "Authentication required"}},
)
def post_kit(
    payload: KitCreate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
):
    kit = create_kit(db, payload)
    kit.tags = get_tags_by_ids(db, payload.tag_ids)
    db.commit()
    db.refresh(kit)
    return kit


@router.get(
    "/search",
    response_model=KitListResponse,
    summary="Search kits",
    description="Search kits by text and filters (grade, brand, series, status, scale, tag).",
    responses={401: {"description": "Authentication required"}},
)
def search_kits(
    q: str | None = None,
    grade: str | None = None,
    brand: str | None = None,
    series: str | None = None,
    build_status: str | None = None,
    scale: str | None = None,
    tag: str | None = None,
    skip: int = 0,
    limit: int = Query(default=settings.api_page_size_default, le=settings.api_page_size_max),
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
):
    items, total = SearchService(db).search_kits(
        q=q,
        grade=grade,
        brand=brand,
        series=series,
        build_status=build_status,
        scale=scale,
        tag=tag,
        skip=skip,
        limit=limit,
    )
    return KitListResponse(items=items, total=total)


@router.get(
    "/{kit_id}",
    response_model=KitRead,
    summary="Get kit detail",
    description="Get one kit by ID.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Kit not found"}},
)
def get_kit_detail(
    kit_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
):
    kit = get_kit(db, kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")
    return kit


@router.put(
    "/{kit_id}",
    response_model=KitRead,
    summary="Update kit",
    description="Update fields of an existing kit.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Kit not found"}},
)
def put_kit(
    kit_id: int,
    payload: KitUpdate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
):
    kit = get_kit(db, kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    update_kit(kit, payload)
    if payload.tag_ids is not None:
        kit.tags = get_tags_by_ids(db, payload.tag_ids)

    db.commit()
    db.refresh(kit)
    return kit


@router.delete(
    "/{kit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete kit",
    description="Delete a kit and associated dependent records.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Kit not found"}},
)
def remove_kit(
    kit_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
):
    kit = get_kit(db, kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    delete_kit(db, kit)
    db.commit()


@router.get(
    "/{kit_id}/timeline",
    response_model=list[BuildLogRead],
    summary="Get build timeline",
    description="Return build timeline entries for a kit.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Kit not found"}},
)
def get_timeline(
    kit_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
) -> list[BuildLogRead]:
    if not get_kit(db, kit_id):
        raise HTTPException(status_code=404, detail="Kit not found")
    return list_by_kit(db, kit_id)


@router.post(
    "/{kit_id}/timeline",
    response_model=BuildLogRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create build timeline entry",
    description="Append a build timeline status entry for a kit.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Kit not found"}},
)
def post_timeline(
    kit_id: int,
    payload: BuildLogCreate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> BuildLogRead:
    if not get_kit(db, kit_id):
        raise HTTPException(status_code=404, detail="Kit not found")
    item = create_for_kit(db, kit_id, payload)
    db.commit()
    db.refresh(item)
    return item
