<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License">
</p>

<h1 align="center">Artifactory</h1>

<p align="center">
  <strong>Model Kit Collection OS</strong><br>
  Track your Gundam &amp; custom model kits — purchases, build progress, reference materials, and more.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-api">API</a> ·
  <a href="API_GUIDE.md">Integration Guide</a> ·
  <a href="MOBILE_APP_PARITY_GUIDE.md">Mobile Parity</a>
</p>

---

## ✨ Features

- **Kit Inventory** — Search, filter, and paginate your collection by grade, brand, series, scale, build status, and tags
- **Build Timeline** — Log status changes (NEW → IN PROGRESS → COMPLETED) with notes
- **Asset Management** — Upload box art, manuals, build photos, videos, and documents with automatic thumbnail generation
- **Tag System** — Organize kits and links with color-coded tags
- **Dashboard** — Collection stats: total kits, money spent, completion rate
- **Auth** — JWT-based login with silent token refresh and logout revocation
- **Observability** — Health probes, Prometheus metrics, slow-query logging
- **Filter Management** — Server-persisted custom filter dictionaries for brand, series, and scale

## 🚀 Quick Start

### Prerequisites

- Python 3.11+ with [`uv`](https://docs.astral.sh/uv/)
- Node.js 18+
- Docker (optional)

### Setup

```bash
git clone git@github.com:blkot/Artifactory.git
cd Artifactory

# Create env file
cp .env.example .env
```

### Backend

```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App at [http://localhost:5173](http://localhost:5173)

### Docker

```bash
docker compose up --build
```

## 📦 Project Structure

```
artifactory/
├── backend/           FastAPI app, models, services, tests, migrations
├── frontend/          React + Vite web app
├── assets/            Uploaded files (images, videos, docs)
├── data/              SQLite database
├── backups/           Backup output
├── docs/plans/        Design docs and implementation plans
└── scripts/           Release check automation
```

## 🔐 Auth Flow

```bash
BASE_URL="http://localhost:8000/api/v1"

# Register
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"builder01","email":"builder01@example.com","password":"StrongPass1!"}'

# Login → get access + refresh tokens
TOKENS=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=builder01&password=StrongPass1!")
ACCESS_TOKEN=$(echo "$TOKENS" | jq -r '.access_token')
REFRESH_TOKEN=$(echo "$TOKENS" | jq -r '.refresh_token')

# Call a protected endpoint
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/kits"

# Refresh access token (or the frontend does this silently on 401)
curl -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"

# Logout → revoke refresh token on server
curl -X POST "$BASE_URL/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"
```

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | — | JWT signing key (change in production) |
| `REQUIRE_AUTH_FOR_READS` | `false` | Require JWT for reads |
| `REQUIRE_AUTH_FOR_WRITES` | `false` | Require JWT for writes |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_REQUESTS` | `120` | Requests per window |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Window size in seconds |
| `SQL_SLOW_QUERY_THRESHOLD_MS` | `200` | Log queries slower than this |
| `STATS_CACHE_TTL_SECONDS` | `15` | Stats cache duration |
| `API_PAGE_SIZE_DEFAULT` | `20` | Default list page size |
| `API_PAGE_SIZE_MAX` | `100` | Maximum page size |

See `backend/.env.example` for all available settings.

## 📊 Observability

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness shortcut |
| `GET /health/live` | Container alive check |
| `GET /health/ready` | Readiness with DB ping |
| `GET /metrics` | Prometheus counters |

## 🧪 Testing & CI

```bash
# Backend tests
cd backend && uv run pytest

# Full release check (tests + frontend build + migrations)
./scripts/release_check.sh

# Backup
cd backend && uv run python -m app.cli.backup --output ../backups/backup.tar.gz
```

## 📄 License

MIT
