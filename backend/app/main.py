from pathlib import Path

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api.exceptions import AppException
from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.rate_limit import InMemoryRateLimiter
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

app = FastAPI(title=settings.app_name, version=settings.app_version, debug=settings.debug)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.rate_limiter = InMemoryRateLimiter(
    limit=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
)


@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    if not settings.rate_limit_enabled:
        return await call_next(request)

    path = request.url.path
    if path in settings.rate_limit_exclude_paths or request.method == "OPTIONS":
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{path}"
    allowed, retry_after = app.state.rate_limiter.allow(key)
    if not allowed:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            content={
                "error": "rate_limit_exceeded",
                "message": "Too many requests",
                "details": {
                    "limit": settings.rate_limit_requests,
                    "window_seconds": settings.rate_limit_window_seconds,
                    "retry_after": retry_after,
                },
            },
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(settings.rate_limit_requests)
    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(AppException)
async def app_exception_handler(_, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error, "message": exc.message, "details": exc.details},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError):
    serializable_errors = []
    for err in exc.errors():
        cloned = dict(err)
        if "ctx" in cloned and isinstance(cloned["ctx"], dict):
            cloned["ctx"] = {
                key: (str(value) if not isinstance(value, (str, int, float, bool, type(None), list, dict)) else value)
                for key, value in cloned["ctx"].items()
            }
        serializable_errors.append(cloned)

    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "message": "Request validation failed",
            "details": {"errors": serializable_errors},
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "http_error", "message": detail, "details": {"raw": exc.detail}},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={
            "error": "database_integrity_error",
            "message": "The request violates a database constraint",
            "details": {"raw": str(exc.orig)},
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(_, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=500,
        content={
            "error": "database_error",
            "message": "An unexpected database error occurred",
            "details": {"raw": str(exc)},
        },
    )
