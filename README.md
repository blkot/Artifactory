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
