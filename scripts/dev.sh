#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
    echo ""
    echo "stopping servers..."
    kill $backend_pid $frontend_pid 2>/dev/null
    exit 0
}
trap cleanup INT TERM

echo "=== Artifactory Dev ==="
echo "backend → http://localhost:8000/docs"
echo "frontend → http://localhost:5173"
echo "Ctrl+C to stop both"
echo ""

cd "$ROOT/backend"
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
backend_pid=$!

cd "$ROOT/frontend"
npm run dev &
frontend_pid=$!

wait
