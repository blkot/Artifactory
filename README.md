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

## Observability Endpoints
- `GET /health` liveness shortcut
- `GET /health/live` liveness check
- `GET /health/ready` readiness check (database connectivity)
- `GET /metrics` Prometheus-style counters

## Docker
```bash
docker compose up --build
```

## Tests
```bash
cd backend
uv run pytest
```

## Backup CLI
```bash
cd backend
uv run python -m app.cli.backup --output ../backups/backup.tar.gz
```
