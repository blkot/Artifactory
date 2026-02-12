# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Artifactory** is a personal model kit collection management system designed for tracking Gundam and custom model kits. It features a rich backend architecture with REST API, planned for future web frontend and mobile app support.

**Purpose:** Track model kits purchased, their build status, and store reference materials (images, videos, documents, and online links).

**Tech Stack:**
- Backend: FastAPI (Python 3.11+)
- Database: SQLite with SQLAlchemy ORM
- Auth: JWT-based (architecture ready for multi-user)
- Storage: Local files with Docker volume mounts
- Container: Docker with health checks

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Web)                          │
│                    React / Vue / Svelte                         │
│                    CORS: localhost:3000                          │
├─────────────────────────────────────────────────────────────────┤
│                      Backend API (FastAPI)                       │
│              Docker Container with JWT Auth Ready                │
│                    /api/v1/... (versioned)                       │
│                    /health (health check)                       │
├─────────────────────────────────────────────────────────────────┤
│                      Database (SQLite)                           │
│              Host mount: ./data/artifactory.db                   │
├─────────────────────────────────────────────────────────────────┤
│                   File Storage (Host Mount)                     │
│   ./assets/images/  ./assets/videos/  ./assets/docs/             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Kit (Core Entity)
| Field | Type | Description |
|-------|------|-------------|
| id | int | Primary key |
| name | str | Kit name (e.g., "RX-78-2 Gundam") |
| grade | enum | HG, RG, MG, PG, SD, CUSTOM |
| series | str | Gundam series (Universal Century, AW, etc.) |
| brand | str | "Bandai" or custom author name |
| scale | str | 1/144, 1/100, 1/60, etc. |
| kit_number | str (optional) | e.g., "RG-01-001" |
| purchase_date | date (optional) | When bought |
| purchase_price | decimal (optional) | Cost |
| purchase_shop | str (optional) | Store name |
| build_status | enum | NEW, OPENED, IN_PROGRESS, COMPLETED |
| created_at | datetime | Auto-generated |
| updated_at | datetime | Auto-updated |

**Relationships:** assets, links, tags, build_logs

### Asset
| Field | Type | Description |
|-------|------|-------------|
| id | int | Primary key |
| kit_id | int | Foreign key to Kit |
| type | enum | BOX_ART, MANUAL, BUILD_PHOTO, REFERENCE_IMAGE, VIDEO, DOCUMENT |
| file_path | str | Path to stored file |
| thumbnail_path | str (optional) | Path to thumbnail (images only) |
| original_filename | str | Original upload filename |
| file_size | int | Size in bytes |
| mime_type | str | MIME type |
| description | str (optional) | Notes |
| is_external_reference | bool | True if from other builders |
| created_at | datetime | Auto-generated |

**Relationships:** kit

### Link
| Field | Type | Description |
|-------|------|-------------|
| id | int | Primary key |
| kit_id | int | Foreign key to Kit |
| url | str | URL |
| category | enum | BUILD_LOG, REVIEW, TUTORIAL, GALLERY |
| title | str | Display title |
| notes | str (optional) | Notes |
| created_at | datetime | Auto-generated |

**Relationships:** kit, tags

### Tag
| Field | Type | Description |
|-------|------|-------------|
| id | int | Primary key |
| name | str | Unique tag name |
| color | str (optional) | For UI display |

**Relationships:** kits, links

### BuildLog (Build Timeline)
| Field | Type | Description |
|-------|------|-------------|
| id | int | Primary key |
| kit_id | int | Foreign key to Kit |
| status | enum | NEW, OPENED, IN_PROGRESS, COMPLETED |
| notes | str (optional) | Notes |
| photo_id | int (optional) | Foreign key to Asset |
| created_at | datetime | Auto-generated |

**Relationships:** kit, photo (Asset)

### User (Auth Ready)
| Field | Type | Description |
|-------|------|-------------|
| id | int | Primary key |
| username | str | Unique |
| email | str (optional) | Unique |
| hashed_password | str | Bcrypt hashed |
| is_active | bool | Active status |
| created_at | datetime | Auto-generated |

---

## Directory Structure

```
artifactory/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py          # Dependencies (auth, db session)
│   │   │   └── v1/
│   │   │       ├── endpoints/   # API route modules
│   │   │       └── api.py       # Router aggregation
│   │   ├── cli/
│   │   │   └── backup.py        # Backup CLI command
│   │   ├── core/
│   │   │   ├── config.py        # Settings from .env
│   │   │   ├── logging.py       # Logging configuration
│   │   │   └── security.py      # JWT, password hashing
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── crud/                # Database operations
│   │   ├── services/            # Business logic
│   │   ├── main.py              # FastAPI app
│   │   └── db.py                # Database connection
│   ├── tests/
│   ├── alembic/                 # Database migrations
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                    # Future web frontend
├── assets/                      # Host-mounted file storage
│   ├── images/
│   │   └── thumbnails/          # Auto-generated thumbnails
│   ├── videos/
│   └── docs/
├── data/                        # Host-mounted database
├── backups/                     # Backup output
├── docker-compose.yml
├── .env                         # Local config (not in git)
├── .dockerignore
├── .gitignore
└── README.md
```

---

## Development Commands

### Local Development (without Docker)

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env with your settings

# Run database migrations
alembic upgrade head

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html
```

### Docker Development

```bash
# Build and start all services
docker compose up --build

# Start in detached mode
docker compose up -d --build

# View logs
docker compose logs -f backend

# Stop services
docker compose down

# Run commands inside container
docker compose exec backend python -m app.cli.backup
docker compose exec backend alembic upgrade head

# Rebuild after code changes
docker compose up -d --build
```

### Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

### Backup

```bash
# From inside container
docker compose exec backend python -m app.cli.backup --output /app/data/backups/backup.tar.gz

# Restore (manual - extract tar.gz to data/ and assets/)
```

---

## API Endpoints

### Health & Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (for Docker) |
| POST | `/api/v1/auth/login` | Login (returns JWT) |
| POST | `/api/v1/auth/register` | Create user |
| GET | `/api/v1/auth/me` | Get current user |

### Kits
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/kits` | List all kits (filters, pagination) |
| POST | `/api/v1/kits` | Create new kit |
| GET | `/api/v1/kits/{id}` | Get kit details |
| PUT | `/api/v1/kits/{id}` | Update kit |
| DELETE | `/api/v1/kits/{id}` | Delete kit |
| GET | `/api/v1/kits/search` | Search kits (full-text + filters) |

### Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/assets` | Upload asset (multipart/form-data) |
| GET | `/api/v1/assets/{id}` | Get asset metadata |
| GET | `/api/v1/assets/{id}/file` | Download/view actual file |
| DELETE | `/api/v1/assets/{id}` | Delete asset |

### Links
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/links` | List all links |
| POST | `/api/v1/links` | Create link |
| PUT | `/api/v1/links/{id}` | Update link |
| DELETE | `/api/v1/links/{id}` | Delete link |

### Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tags` | List all tags |
| POST | `/api/v1/tags` | Create tag |

### Statistics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/stats` | Collection stats |

### Build Timeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/kits/{id}/timeline` | Get build history |
| POST | `/api/v1/kits/{id}/timeline` | Add timeline entry |

---

## Environment Variables

See `backend/.env.example` for all available variables:

```bash
# Application
APP_NAME=Artifactory
APP_VERSION=0.1.0
DEBUG=true
ENVIRONMENT=development

# Server
HOST=0.0.0.0
PORT=8000

# Database
DATABASE_URL=sqlite:///./data/artifactory.db

# File Storage
ASSETS_DIR=/app/assets
MAX_UPLOAD_SIZE=10485760  # 10MB
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif,image/webp
ALLOWED_VIDEO_TYPES=video/mp4,video/webm
ALLOWED_DOC_TYPES=application/pdf

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# Auth
SECRET_KEY=change-me-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=60
ALGORITHM=HS256

# Logging
LOG_LEVEL=INFO
```

---

## Key Services

### AssetService (`app/services/asset_service.py`)

Handles file uploads with validation and thumbnail generation:

- Validates file type (MIME + extension)
- Validates file size (max 10MB by default)
- Generates unique filename (UUID + original extension)
- Saves to appropriate directory (images/, videos/, docs/)
- Auto-generates thumbnails for images (max 300x300px)
- Creates database record
- Returns asset metadata

### SearchService (`app/services/search_service.py`)

Implements full-text search with advanced filtering:

- Full-text search across kit names, notes
- Filter by: grade, brand, series, build_status, scale, tags
- Combined search: text + filters together
- Paginated results

### StatsService (`app/services/stats_service.py`)

Calculates collection statistics:

- Total kits by grade
- Total spent (sum of purchase prices)
- Completion rate (completed / total)
- Kits by build status
- Recent timeline entries

---

## Error Handling

Custom exceptions with structured JSON responses:

```python
# Exception types
- KitNotFoundException
- AssetUploadException
- InvalidFileTypeException
- FileTooLargeException

# Response format
{
  "error": "error_type",
  "message": "Human readable message",
  "details": {...}  # Optional
}
```

---

## Important Implementation Notes

### Thumbnail Generation
- Use Pillow (PIL) for image processing
- Generate on upload, store in `assets/images/thumbnails/`
- Max dimensions: 300x300px (maintain aspect ratio)
- Only for: image/jpeg, image/png, image/gif, image/webp

### Database Relationships
- Kit → Asset: One-to-Many
- Kit → Link: One-to-Many
- Kit → BuildLog: One-to-Many
- Kit ↔ Tag: Many-to-Many
- Link ↔ Tag: Many-to-Many
- User → Kit: One-to-Many (future: kits created by user)

### File Security
- Validate MIME type on upload (python-magic)
- Validate file size before processing
- Sanitize filenames (use UUID)
- Never trust user-provided Content-Type header alone

### CORS Configuration
- Configure allowed origins via `CORS_ORIGINS` env var
- Allow credentials for JWT auth
- Expose all headers needed by frontend

### Logging
- Structured JSON logging to stdout
- Docker logs can be viewed with `docker compose logs -f backend`
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

---

## Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_api_kits.py

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test
pytest tests/test_api_kits.py::test_create_kit

# View coverage report
open htmlcov/index.html
```

---

## Development Workflow

1. **Make code changes** in `backend/app/`
2. **Rebuild Docker**: `docker compose up -d --build`
3. **Check logs**: `docker compose logs -f backend`
4. **Test API**: Visit http://localhost:8000/docs for auto-generated API docs
5. **Create migration** if model changed: `alembic revision --autogenerate -m "description"`
6. **Apply migration**: `alembic upgrade head`

---

## Dependencies (Backend)

### Core
- `fastapi` - Web framework
- `uvicorn[standard]` - ASGI server
- `sqlalchemy` - ORM
- `alembic` - Migrations
- `pydantic` - Validation
- `pydantic-settings` - Settings from .env

### Database
- `aiosqlite` - Async SQLite support

### Auth
- `python-jose[cryptography]` - JWT tokens
- `passlib[bcrypt]` - Password hashing
- `python-multipart` - Form data

### File Processing
- `pillow` - Image/thumbnail processing
- `python-magic` - MIME type detection
- `aiofiles` - Async file operations

### Utilities
- `python-dotenv` - .env files

### Dev/Testing
- `pytest` - Testing
- `pytest-asyncio` - Async test support
- `httpx` - Async HTTP client for testing
- `black` - Code formatting
- `ruff` - Linting

---

## Future Considerations

### Mobile App Readiness
- API is versioned (`/api/v1/`) for backward compatibility
- JWT auth supports mobile login
- Stateless API design enables scaling

### Potential Enhancements
- Full-text search with dedicated search engine (Meilisearch)
- Cloud storage (S3, GCS) for assets
- Background tasks for thumbnail generation
- Webhook support for build log updates
- Export to CSV/JSON
- Image galleries and slideshows
