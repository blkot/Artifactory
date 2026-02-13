#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

printf "[release-check] backend tests...\n"
(
  cd "$BACKEND_DIR"
  uv run --extra dev pytest -q
)

printf "[release-check] frontend build...\n"
(
  cd "$FRONTEND_DIR"
  npm run build >/dev/null
)

printf "[release-check] alembic migration cycle...\n"
(
  cd "$BACKEND_DIR"
  tmpdb="$(mktemp -t artifactory_release_check).db"
  PYTHONPATH=. DATABASE_URL="sqlite:///$tmpdb" uv run alembic upgrade head >/dev/null
  PYTHONPATH=. DATABASE_URL="sqlite:///$tmpdb" uv run alembic downgrade base >/dev/null
  PYTHONPATH=. DATABASE_URL="sqlite:///$tmpdb" uv run alembic upgrade head >/dev/null
)

printf "[release-check] OK\n"
