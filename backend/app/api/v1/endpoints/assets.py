from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_read_access, require_write_access
from app.api.exceptions import AssetNotFoundException
from app.core.config import get_settings
from app.crud.asset import get_asset, list_assets
from app.db import get_db
from app.models.enums import AssetType
from app.schemas.asset import AssetListResponse, AssetRead
from app.services.asset_service import AssetService

router = APIRouter(prefix="/assets", tags=["assets"])
settings = get_settings()


@router.post(
    "",
    response_model=AssetRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload asset",
    description="Upload an asset file for a kit (multipart/form-data).",
    responses={400: {"description": "Invalid file"}, 401: {"description": "Authentication required"}},
)
async def upload_asset(
    kit_id: int = Form(...),
    type: AssetType = Form(...),
    description: str | None = Form(default=None),
    is_external_reference: bool = Form(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
):
    return await AssetService(db).create_asset(
        kit_id=kit_id,
        asset_type=type,
        file=file,
        description=description,
        is_external_reference=is_external_reference,
    )


@router.get(
    "",
    response_model=AssetListResponse,
    summary="List assets",
    description="List assets with optional kit filter and pagination.",
    responses={401: {"description": "Authentication required"}},
)
def get_assets(
    kit_id: int | None = None,
    skip: int = 0,
    limit: int = Query(default=settings.api_page_size_default, le=settings.api_page_size_max),
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
) -> AssetListResponse:
    items, total = list_assets(db, kit_id=kit_id, skip=skip, limit=limit)
    return AssetListResponse(items=items, total=total)


@router.get(
    "/{asset_id}",
    response_model=AssetRead,
    summary="Get asset metadata",
    description="Return metadata for one asset.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Asset not found"}},
)
def get_asset_metadata(
    asset_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
) -> AssetRead:
    asset = get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundException(asset_id)
    return asset


@router.get(
    "/{asset_id}/file",
    summary="Download asset file",
    description="Download or stream the original asset file.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Asset/file not found"}},
)
def get_asset_file(
    asset_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
):
    asset = get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundException(asset_id)

    path = Path(asset.file_path)
    if not path.exists():
        raise AssetNotFoundException(asset_id)
    return FileResponse(path=path)


@router.get(
    "/{asset_id}/thumbnail",
    summary="Download thumbnail",
    description="Download or stream the thumbnail file if available.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Asset or thumbnail not found"}},
)
def get_asset_thumbnail(
    asset_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
):
    asset = get_asset(db, asset_id)
    if not asset or not asset.thumbnail_path:
        raise AssetNotFoundException(asset_id)

    path = Path(asset.thumbnail_path)
    if not path.exists():
        raise AssetNotFoundException(asset_id)
    return FileResponse(path=path)


@router.delete(
    "/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete asset",
    description="Delete an asset record and underlying file(s).",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Asset not found"}},
)
def remove_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
):
    asset = get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundException(asset_id)
    AssetService(db).remove_asset(asset)
