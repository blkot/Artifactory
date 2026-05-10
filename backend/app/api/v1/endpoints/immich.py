from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.api.deps import require_read_access
from app.services.immich_service import ImmichService

router = APIRouter(prefix="/immich", tags=["immich"])


@router.get("/tags", summary="List Immich tags")
def list_tags(_auth=Depends(require_read_access)) -> list[dict]:
    try:
        return ImmichService().get_tags()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Immich error: {e}")


@router.post("/search", summary="Search Immich assets by tags")
def search_assets(
    body: dict,
    _auth=Depends(require_read_access),
) -> dict:
    tag_ids = body.get("tagIds", [])
    page = body.get("page", 1)
    size = body.get("size", 60)
    try:
        return ImmichService().search_assets(tag_ids, page=page, size=size)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Immich error: {e}")


@router.get("/assets/{asset_id}/thumbnail", summary="Get Immich asset thumbnail")
def get_thumbnail(
    asset_id: str,
):
    try:
        content = ImmichService().get_asset_thumbnail(asset_id)
        return Response(content=content, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Immich error: {e}")


@router.get("/assets/{asset_id}/original", summary="Get Immich asset original")
def get_original(
    asset_id: str,
):
    try:
        content = ImmichService().get_asset_original(asset_id)
        return Response(content=content, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Immich error: {e}")
