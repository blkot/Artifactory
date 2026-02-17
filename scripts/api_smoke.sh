#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

TMP_DIR="$(mktemp -d -t artifactory_api_smoke_XXXXXX)"
TMP_DB="$TMP_DIR/smoke.db"
TMP_ASSETS="$TMP_DIR/assets"
TMP_PDF="$TMP_DIR/manual.pdf"
LOG_FILE="$TMP_DIR/backend.log"
BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
API_URL="$BASE_URL/api/v1"

SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

assert_status() {
  local expected="$1"
  local got="$2"
  local label="$3"
  if [[ "$expected" != "$got" ]]; then
    printf "[api-smoke] FAIL %s (expected %s got %s)\n" "$label" "$expected" "$got"
    printf "[api-smoke] backend log:\n"
    tail -n 80 "$LOG_FILE" || true
    exit 1
  fi
}

json_get() {
  local json="$1"
  local path="$2"
  JSON_PAYLOAD="$json" python3 - "$path" <<'PY'
import json
import os
import sys

path = sys.argv[1].split(".")
data = json.loads(os.environ["JSON_PAYLOAD"])
for key in path:
    if isinstance(data, dict):
        data = data[key]
    else:
        raise KeyError(f"cannot read key '{key}' from non-object")
if isinstance(data, (dict, list)):
    print(json.dumps(data))
else:
    print(data)
PY
}

call_json() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local auth="${4:-}"

  local args=(-sS -X "$method" "$url" -H "Content-Type: application/json")
  if [[ -n "$auth" ]]; then
    args+=(-H "Authorization: Bearer $auth")
  fi
  if [[ -n "$data" ]]; then
    args+=(-d "$data")
  fi
  args+=(-w $'\n%{http_code}')

  local response
  response="$(curl "${args[@]}")"
  local status="${response##*$'\n'}"
  local body="${response%$'\n'*}"
  printf "%s\n%s" "$status" "$body"
}

printf "[api-smoke] starting backend with temp database...\n"
mkdir -p "$TMP_ASSETS"
(
  cd "$BACKEND_DIR"
  PYTHONPATH=. DATABASE_URL="sqlite:///$TMP_DB" ASSETS_DIR="$TMP_ASSETS" \
    uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 >"$LOG_FILE" 2>&1
) &
SERVER_PID="$!"

for _ in $(seq 1 40); do
  if curl -sS "$BASE_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! curl -sS "$BASE_URL/health" >/dev/null 2>&1; then
  printf "[api-smoke] FAIL backend did not become healthy\n"
  tail -n 80 "$LOG_FILE" || true
  exit 1
fi

printf "[api-smoke] writing sample PDF...\n"
cat >"$TMP_PDF" <<'EOF'
%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj
trailer
<< >>
%%EOF
EOF

printf "[api-smoke] checking health endpoints...\n"
assert_status "200" "$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/health")" "GET /health"
assert_status "200" "$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/health/live")" "GET /health/live"
assert_status "200" "$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/health/ready")" "GET /health/ready"
assert_status "200" "$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/metrics")" "GET /metrics"

printf "[api-smoke] register + login + refresh...\n"
register_result="$(call_json "POST" "$API_URL/auth/register" '{"username":"smoke_user","email":"smoke@example.com","password":"StrongPass1!"}')"
register_status="$(printf "%s" "$register_result" | head -n1)"
assert_status "201" "$register_status" "POST /auth/register"

login_response="$(curl -sS -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=smoke_user&password=StrongPass1!" -w $'\n%{http_code}')"
login_status="${login_response##*$'\n'}"
login_body="${login_response%$'\n'*}"
assert_status "200" "$login_status" "POST /auth/login"
access_token="$(json_get "$login_body" "access_token")"
refresh_token="$(json_get "$login_body" "refresh_token")"

refresh_result="$(call_json "POST" "$API_URL/auth/refresh" "{\"refresh_token\":\"$refresh_token\"}")"
refresh_status="$(printf "%s" "$refresh_result" | head -n1)"
refresh_body="$(printf "%s" "$refresh_result" | tail -n +2)"
assert_status "200" "$refresh_status" "POST /auth/refresh"
new_access_token="$(json_get "$refresh_body" "access_token")"

printf "[api-smoke] creating tag + kit + search...\n"
tag_result="$(call_json "POST" "$API_URL/tags" '{"name":"smoke-tag","color":"#abcdef"}' "$access_token")"
tag_status="$(printf "%s" "$tag_result" | head -n1)"
tag_body="$(printf "%s" "$tag_result" | tail -n +2)"
assert_status "201" "$tag_status" "POST /tags"
tag_id="$(json_get "$tag_body" "id")"

kit_payload="$(cat <<JSON
{"name":"RG Smoke Test","grade":"RG","series":"UC","brand":"Bandai","scale":"1/144","build_status":"NEW","tag_ids":[$tag_id]}
JSON
)"
kit_result="$(call_json "POST" "$API_URL/kits" "$kit_payload" "$access_token")"
kit_status="$(printf "%s" "$kit_result" | head -n1)"
kit_body="$(printf "%s" "$kit_result" | tail -n +2)"
assert_status "201" "$kit_status" "POST /kits"
kit_id="$(json_get "$kit_body" "id")"

search_status="$(curl -sS -o /dev/null -w "%{http_code}" "$API_URL/kits/search?q=Smoke&grade=RG&skip=0&limit=10")"
assert_status "200" "$search_status" "GET /kits/search"

printf "[api-smoke] timeline + link...\n"
timeline_result="$(call_json "POST" "$API_URL/kits/$kit_id/timeline" '{"status":"IN_PROGRESS","notes":"smoke timeline"}' "$new_access_token")"
timeline_status="$(printf "%s" "$timeline_result" | head -n1)"
assert_status "201" "$timeline_status" "POST /kits/{id}/timeline"

link_result="$(call_json "POST" "$API_URL/links" "{\"kit_id\":$kit_id,\"url\":\"https://example.com\",\"category\":\"REVIEW\",\"title\":\"Smoke Link\",\"notes\":\"ok\",\"tag_ids\":[$tag_id]}" "$access_token")"
link_status="$(printf "%s" "$link_result" | head -n1)"
assert_status "201" "$link_status" "POST /links"

printf "[api-smoke] asset upload/list/delete...\n"
asset_upload_response="$(curl -sS -X POST "$API_URL/assets" \
  -H "Authorization: Bearer $access_token" \
  -F "kit_id=$kit_id" \
  -F "type=DOCUMENT" \
  -F "description=smoke asset" \
  -F "is_external_reference=false" \
  -F "file=@$TMP_PDF;type=application/pdf" -w $'\n%{http_code}')"
asset_upload_status="${asset_upload_response##*$'\n'}"
asset_upload_body="${asset_upload_response%$'\n'*}"
assert_status "201" "$asset_upload_status" "POST /assets"
asset_id="$(json_get "$asset_upload_body" "id")"

asset_list_status="$(curl -sS -o /dev/null -w "%{http_code}" "$API_URL/assets?kit_id=$kit_id&skip=0&limit=10")"
assert_status "200" "$asset_list_status" "GET /assets"

asset_file_status="$(curl -sS -H "Authorization: Bearer $access_token" -o /dev/null -w "%{http_code}" "$API_URL/assets/$asset_id/file")"
assert_status "200" "$asset_file_status" "GET /assets/{id}/file"

asset_delete_status="$(curl -sS -X DELETE -H "Authorization: Bearer $access_token" -o /dev/null -w "%{http_code}" "$API_URL/assets/$asset_id")"
assert_status "204" "$asset_delete_status" "DELETE /assets/{id}"

printf "[api-smoke] stats...\n"
stats_status="$(curl -sS -o /dev/null -w "%{http_code}" "$API_URL/stats")"
assert_status "200" "$stats_status" "GET /stats"

printf "[api-smoke] OK\n"
