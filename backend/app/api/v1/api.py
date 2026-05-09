from fastapi import APIRouter

from app.api.v1.endpoints import assets, auth, filters, immich, kits, links, stats, tags

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(kits.router)
api_router.include_router(assets.router)
api_router.include_router(filters.router)
api_router.include_router(links.router)
api_router.include_router(tags.router)
api_router.include_router(immich.router)
api_router.include_router(stats.router)
