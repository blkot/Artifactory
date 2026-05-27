import mimetypes
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy.orm import Session

from app.api.deps import require_read_access, require_write_access
from app.api.exceptions import (
    AssetNotFoundException,
    AssetUploadException,
    ConflictException,
    KitNotFoundException,
    LinkNotFoundException,
)
from app.core.config import get_settings
from app.crud.kit import get_kit, touch_kit_activity
from app.crud.link import (
    create_link,
    delete_link,
    find_duplicate_link,
    get_link,
    infer_link_source,
    list_links,
    update_link,
)
from app.crud.tag import get_tags_by_ids
from app.db import get_db
from app.schemas.link import LinkCreate, LinkRead, LinkUpdate
from app.services.asset_service import AssetService

router = APIRouter(prefix="/links", tags=["links"])
settings = get_settings()


@router.get(
    "",
    response_model=list[LinkRead],
    summary="List links",
    description="List reference links across kits.",
    responses={401: {"description": "Authentication required"}},
)
def get_links(
    kit_id: int | None = None,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
) -> list[LinkRead]:
    return list_links(db, kit_id=kit_id)


@router.post(
    "",
    response_model=LinkRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create link",
    description="Create a new reference link for a kit.",
    responses={
        401: {"description": "Authentication required"},
        404: {"description": "Kit not found"},
    },
)
def post_link(
    payload: LinkCreate,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> LinkRead:
    kit = get_kit(db, payload.kit_id)
    if not kit:
        raise KitNotFoundException(payload.kit_id)

    duplicate = find_duplicate_link(db, payload.kit_id, str(payload.url))
    if duplicate:
        raise ConflictException(
            "This kit already has that link.",
            details={"link_id": duplicate.id, "kit_id": payload.kit_id},
        )

    link = create_link(db, payload)
    link.tags = get_tags_by_ids(db, payload.tag_ids)
    touch_kit_activity(kit)
    db.commit()
    db.refresh(link)
    return link


@router.put(
    "/{link_id}",
    response_model=LinkRead,
    summary="Update link",
    description="Update an existing link.",
    responses={
        401: {"description": "Authentication required"},
        404: {"description": "Link not found"},
    },
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
    responses={
        401: {"description": "Authentication required"},
        404: {"description": "Link not found"},
    },
)
def remove_link(
    link_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
):
    link = get_link(db, link_id)
    if not link:
        raise LinkNotFoundException(link_id)
    if link.thumbnail_path:
        path = Path(link.thumbnail_path)
        if path.exists():
            path.unlink()
    delete_link(db, link)
    db.commit()


@router.post(
    "/{link_id}/thumbnail",
    response_model=LinkRead,
    summary="Upload link thumbnail",
    description="Attach or replace a thumbnail image for a reference link.",
    responses={
        401: {"description": "Authentication required"},
        404: {"description": "Link not found"},
    },
)
async def upload_link_thumbnail(
    link_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> LinkRead:
    link = get_link(db, link_id)
    if not link:
        raise LinkNotFoundException(link_id)

    contents = await file.read()
    size = len(contents)
    if size > settings.max_upload_size:
        from app.api.exceptions import FileTooLargeException

        raise FileTooLargeException(size, settings.max_upload_size)

    asset_service = AssetService(db)
    mime_type = asset_service._detect_mime(contents, file.filename)
    if mime_type not in settings.allowed_image_types:
        from app.api.exceptions import InvalidFileTypeException

        raise InvalidFileTypeException(mime_type)

    extension = Path(file.filename or "").suffix or mimetypes.guess_extension(mime_type) or ".jpg"
    thumbnail_dir = Path(settings.assets_dir) / "link_thumbnails"
    thumbnail_dir.mkdir(parents=True, exist_ok=True)
    thumbnail_path = thumbnail_dir / f"{uuid.uuid4().hex}{extension.lower()}"

    temp_path = thumbnail_dir / f"{uuid.uuid4().hex}.upload{extension.lower()}"
    temp_path.write_bytes(contents)
    try:
        with Image.open(temp_path) as img:
            img.thumbnail((640, 640))
            if thumbnail_path.suffix.lower() in {".jpg", ".jpeg"} and img.mode not in {"RGB", "L"}:
                img = img.convert("RGB")
            img.save(thumbnail_path)
    except Exception as exc:
        raise AssetUploadException(f"Failed to process link thumbnail: {exc}") from exc
    finally:
        if temp_path.exists():
            temp_path.unlink()

    if link.thumbnail_path:
        old_path = Path(link.thumbnail_path)
        if old_path.exists():
            old_path.unlink()

    link.thumbnail_path = str(thumbnail_path)
    if not link.source:
        link.source = infer_link_source(link.url)
    if link.kit:
        touch_kit_activity(link.kit)
    db.commit()
    db.refresh(link)
    return link


@router.get(
    "/{link_id}/thumbnail",
    summary="Download link thumbnail",
    description="Download a reference link thumbnail image.",
    responses={
        401: {"description": "Authentication required"},
        404: {"description": "Link thumbnail not found"},
    },
)
def get_link_thumbnail(
    link_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
):
    link = get_link(db, link_id)
    if not link or not link.thumbnail_path:
        raise AssetNotFoundException(link_id)

    path = Path(link.thumbnail_path)
    if not path.is_file():
        raise AssetNotFoundException(link_id)
    return FileResponse(path=path)
