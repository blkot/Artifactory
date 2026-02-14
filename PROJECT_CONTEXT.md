# Artifactory Project Context (Compact)

Last updated: 2026-02-14

## 1) Critical Invariants
- Python env/deps: prefer `uv`.
- Delivery rule: each finished feature item must pass checks, then commit with one-line message including phase/item info.
- Validation baseline before commit:
  - `./scripts/release_check.sh` (backend tests + frontend build + alembic cycle)
- Notification rule: send Bark notification after each completed task.

## 2) Current Architecture Snapshot
- Backend: FastAPI + SQLAlchemy + SQLite + Alembic
- Frontend: React + Vite
- Infra: Docker Compose
- API namespace: `/api/v1`
- Observability:
  - `GET /health`, `/health/live`, `/health/ready`
  - `GET /metrics`
  - request-id + latency logging
- Security controls:
  - JWT auth (`/api/v1/auth/login`)
  - config toggles: `REQUIRE_AUTH_FOR_READS`, `REQUIRE_AUTH_FOR_WRITES`
  - in-memory rate limiting

## 3) Completed Phase Commits
- `319870f` Build Artifactory full-stack app and finalize gitignore
- `456d988` Phase 2 hardening: exceptions, validation, and backend test coverage
- `8022b48` Phase 3 hardening: auth scope controls, rate limiting, and prod config profiles
- `2b01a02` Phase 4.1 observability: request telemetry, health probes, and metrics
- `3ba5a06` Phase 4.2 auth policy: finalize read/write enforcement and coverage tests
- `de847c7` Phase 4.3 migrations: add initial Alembic schema and validate upgrade cycle
- `3f4a6be` Phase 4.4 frontend: add login token flow and 401/429 handling
- `b5e2e0c` Phase 4.5 release: add automated pre-release validation script
- `cef1e6b` Phase 5.1 docs: enrich OpenAPI metadata, examples, and auth usage
- `a5ab680` Phase 5.2 ci: add GitHub Actions pipeline for tests, build, and release check
- `fc93d44` Phase 5.3 performance: add query indexes and slow-query logging
- `3ec0b5f` Phase 5.4 perf: add snapshot-based stats caching with TTL
- `145a2ac` Phase 5.5 api: make pagination defaults and max limit configurable
- `471e3f8` Phase 5.6 frontend: add links create/list/delete management UI
- `88278a6` Phase 5.7 frontend: add build timeline viewer and entry creation UI
- `0db7474` Phase 5.8 api: add assets list endpoint with kit filter and pagination
- `707032f` Phase 5.8 frontend: add per-kit asset upload, list, preview, and delete UI
- `a8c4af4` Phase 5.9 frontend: add kit search filters and server-side pagination UX
- `79d0355` Phase 5.10 security: enforce stronger password policy and auth coverage

## 4) Validation Baseline (Current)
- Backend tests: 23 passing
- Frontend build: passing
- Alembic cycle: passing (upgrade/downgrade/upgrade)
- Release check script: `scripts/release_check.sh`

## 5) Important Files
- Backend app entry: `backend/app/main.py`
- Settings: `backend/app/core/config.py`
- DB session + slow query logging: `backend/app/db.py`
- Rate limiter: `backend/app/core/rate_limit.py`
- Metrics collector: `backend/app/core/metrics.py`
- Alembic revisions:
  - `backend/alembic/versions/20260213_0001_initial_schema.py`
  - `backend/alembic/versions/20260213_0002_perf_indexes.py`
- Frontend app: `frontend/src/App.jsx`
- Frontend API client: `frontend/src/api/client.js`
- CI workflow: `.github/workflows/ci.yml`
- Release script: `scripts/release_check.sh`

## 6) Config Keys You Must Keep
- Auth/rate limit:
  - `REQUIRE_AUTH_FOR_READS`
  - `REQUIRE_AUTH_FOR_WRITES`
  - `RATE_LIMIT_ENABLED`
  - `RATE_LIMIT_REQUESTS`
  - `RATE_LIMIT_WINDOW_SECONDS`
  - `RATE_LIMIT_EXCLUDE_PATHS`
- Performance/cache:
  - `SQL_SLOW_QUERY_LOG_ENABLED`
  - `SQL_SLOW_QUERY_THRESHOLD_MS`
  - `STATS_CACHE_ENABLED`
  - `STATS_CACHE_TTL_SECONDS`
  - `API_PAGE_SIZE_DEFAULT`
  - `API_PAGE_SIZE_MAX`
  - `PASSWORD_MIN_LENGTH`

## 7) Next Recommended Items
- Phase 5.11 Auth/token strategy:
  - optional refresh token flow + explicit token revoke/denylist strategy
- Phase 5.12 API tests expansion:
  - add coverage for asset list/filter endpoint and kit search/pagination query combinations
- Phase 5.13 Production hardening:
  - stricter production CORS policy docs and deployment profile checks

## 8) Quick Continue Commands
- Full validation:
  - `./scripts/release_check.sh`
- Backend tests only:
  - `cd backend && uv run --extra dev pytest -q`
- Frontend build only:
  - `cd frontend && npm run build`
