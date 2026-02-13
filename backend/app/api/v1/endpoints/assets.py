from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.exceptions import AssetNotFoundException
from app.crud.asset import get_asset
from app.db import get_db
from app.models.enums import AssetType
from app.schemas.asset import AssetRead
from app.services.asset_service import AssetService

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    kit_id: int = Form(...),
    type: AssetType = Form(...),
    description: str | None = Form(default=None),
    is_external_reference: bool = Form(default=False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await AssetService(db).create_asset(
        kit_id=kit_id,
        asset_type=type,
        file=file,
        description=description,
        is_external_reference=is_external_reference,
    )


@router.get("/{asset_id}", response_model=AssetRead)
def get_asset_metadata(asset_id: int, db: Session = Depends(get_db)) -> AssetRead:
    asset = get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundException(asset_id)
    return asset


@router.get("/{asset_id}/file")
def get_asset_file(asset_id: int, db: Session = Depends(get_db)):
    asset = get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundException(asset_id)

    path = Path(asset.file_path)
    if not path.exists():
        raise AssetNotFoundException(asset_id)
    return FileResponse(path=path)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = get_asset(db, asset_id)
    if not asset:
        raise AssetNotFoundException(asset_id)
    AssetService(db).remove_asset(asset)
