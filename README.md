# Artifactory

Artifactory is a full-stack model kit collection manager for Gundam/custom kits.

## Stack
- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: React + Vite
- Container: Docker Compose

## Project Structure
- `backend/` API server, models, services, tests
- `frontend/` web app
- `assets/` uploaded files
- `data/` SQLite database
- `backups/` backup output

## Quick Start (uv)

1. Create env file:
```bash
cp .env.example .env
```

2. Backend:
```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. Frontend:
```bash
cd frontend
npm install
npm run dev
```

Backend docs: `http://localhost:8000/docs`
Frontend: `http://localhost:5173`
Integration guide: `API_GUIDE.md`

## Auth Flow Example
```bash
BASE_URL="http://localhost:8000/api/v1"

# 1) Register
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"builder01","email":"builder01@example.com","password":"StrongPass1!"}'

# 2) Login (get access + refresh token)
TOKENS=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=builder01&password=StrongPass1!")
ACCESS_TOKEN=$(echo "$TOKENS" | jq -r '.access_token')
REFRESH_TOKEN=$(echo "$TOKENS" | jq -r '.refresh_token')

# 3) Refresh access token
NEW_ACCESS_TOKEN=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" | jq -r '.access_token')

# 4) Call protected endpoint
curl -H "Authorization: Bearer $NEW_ACCESS_TOKEN" \
  "$BASE_URL/kits"
```

## Environment Profiles
- Development template: `backend/.env.development.example`
- Production template: `backend/.env.production.example`

## Security Toggles
- `REQUIRE_AUTH_FOR_READS`: require JWT for read endpoints
- `REQUIRE_AUTH_FOR_WRITES`: require JWT for create/update/delete endpoints
- `RATE_LIMIT_ENABLED`: enable in-memory request rate limiting
- `RATE_LIMIT_REQUESTS`: requests allowed within the time window
- `RATE_LIMIT_WINDOW_SECONDS`: rate-limit window size
- `RATE_LIMIT_EXCLUDE_PATHS`: paths excluded from limiting

Recommended policy by environment:
- Development: `REQUIRE_AUTH_FOR_READS=false`, `REQUIRE_AUTH_FOR_WRITES=false`
- Staging: `REQUIRE_AUTH_FOR_READS=true`, `REQUIRE_AUTH_FOR_WRITES=true`
- Production: `REQUIRE_AUTH_FOR_READS=true`, `REQUIRE_AUTH_FOR_WRITES=true`

Pagination:
- `API_PAGE_SIZE_DEFAULT`: default list/search page size
- `API_PAGE_SIZE_MAX`: maximum allowed `limit` query parameter

## Observability Endpoints
- `GET /health` liveness shortcut
- `GET /health/live` liveness check
- `GET /health/ready` readiness check (database connectivity)
- `GET /metrics` Prometheus-style counters

SQL performance telemetry:
- `SQL_SLOW_QUERY_LOG_ENABLED`: enable slow-query logging
- `SQL_SLOW_QUERY_THRESHOLD_MS`: log queries slower than this threshold (ms)

Stats caching:
- `STATS_CACHE_ENABLED`: enable in-memory caching for `/api/v1/stats`
- `STATS_CACHE_TTL_SECONDS`: cache TTL in seconds

## Docker
```bash
docker compose up --build
```

## Tests
```bash
cd backend
uv run pytest
```

## Release Check
```bash
./scripts/release_check.sh
```

## Backup CLI
```bash
cd backend
uv run python -m app.cli.backup --output ../backups/backup.tar.gz
```
