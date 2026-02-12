from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import AppException
from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db import Base, engine
from app import models  # noqa: F401

settings = get_settings()
configure_logging(settings.log_level)

for folder in [
    Path(settings.assets_dir) / "images",
    Path(settings.assets_dir) / "images" / "thumbnails",
    Path(settings.assets_dir) / "videos",
    Path(settings.assets_dir) / "docs",
    Path("data"),
    Path("backups"),
]:
    folder.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(AppException)
async def app_exception_handler(_, exc: AppException):
    return JSONResponse(
        status_code=400,
        content={"error": exc.error, "message": exc.message, "details": exc.details},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "message": "Request validation failed",
            "details": {"errors": exc.errors()},
        },
    )
