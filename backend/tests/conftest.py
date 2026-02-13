from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.rate_limit import InMemoryRateLimiter
from app.db import Base, get_db
from app.main import app
from app.services.stats_service import StatsService


@pytest.fixture(scope="session")
def test_engine(tmp_path_factory: pytest.TempPathFactory):
    db_dir = tmp_path_factory.mktemp("db")
    db_path = db_dir / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_engine) -> Generator[Session, None, None]:
    TestingSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(autouse=True)
def clean_db(db_session: Session) -> Generator[None, None, None]:
    StatsService.reset_cache()
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    yield
    StatsService.reset_cache()


@pytest.fixture(autouse=True)
def test_settings(tmp_path_factory: pytest.TempPathFactory) -> Generator[None, None, None]:
    settings = get_settings()
    old_assets_dir = settings.assets_dir
    old_max_upload = settings.max_upload_size
    old_require_auth_reads = settings.require_auth_for_reads
    old_require_auth_writes = settings.require_auth_for_writes
    old_rate_limit_enabled = settings.rate_limit_enabled
    old_rate_limit_requests = settings.rate_limit_requests
    old_rate_limit_window = settings.rate_limit_window_seconds
    old_stats_cache_enabled = settings.stats_cache_enabled
    old_stats_cache_ttl = settings.stats_cache_ttl_seconds
    old_rate_limit_exclude_paths = list(settings.rate_limit_exclude_paths)

    settings.assets_dir = str(tmp_path_factory.mktemp("assets"))
    settings.max_upload_size = 10 * 1024 * 1024
    settings.require_auth_for_reads = False
    settings.require_auth_for_writes = False
    settings.rate_limit_enabled = True
    settings.rate_limit_requests = 1000
    settings.rate_limit_window_seconds = 60
    settings.stats_cache_enabled = True
    settings.stats_cache_ttl_seconds = 15
    settings.rate_limit_exclude_paths = [
        "/health",
        "/health/live",
        "/health/ready",
        "/metrics",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]
    app.state.rate_limiter = InMemoryRateLimiter(
        limit=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    yield
    settings.assets_dir = old_assets_dir
    settings.max_upload_size = old_max_upload
    settings.require_auth_for_reads = old_require_auth_reads
    settings.require_auth_for_writes = old_require_auth_writes
    settings.rate_limit_enabled = old_rate_limit_enabled
    settings.rate_limit_requests = old_rate_limit_requests
    settings.rate_limit_window_seconds = old_rate_limit_window
    settings.stats_cache_enabled = old_stats_cache_enabled
    settings.stats_cache_ttl_seconds = old_stats_cache_ttl
    settings.rate_limit_exclude_paths = old_rate_limit_exclude_paths
    app.state.rate_limiter = InMemoryRateLimiter(
        limit=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    username = f"user_{uuid4().hex[:8]}"
    email = f"{username}@example.com"
    password = "StrongPass1"

    register = client.post(
        "/api/v1/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert register.status_code == 201

    login = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
