# Artifactory API Guide

This guide is the integration reference for building other web/mobile/desktop frontends against Artifactory.

## Base URLs
- API base: `http://localhost:8000/api/v1`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

Use `openapi.json` as the source of truth when generating API clients.

## Authentication

### Token model
- `access_token`: short-lived JWT for `Authorization: Bearer ...`
- `refresh_token`: longer-lived JWT used only with `POST /auth/refresh`

### Password policy
- minimum length controlled by `PASSWORD_MIN_LENGTH` (default: `12`)
- must include uppercase, lowercase, digit, and special character
- must not contain spaces

### Flow
1. Register: `POST /auth/register`
2. Login: `POST /auth/login` (returns access + refresh)
3. Use `access_token` on protected endpoints
4. Refresh when access expires: `POST /auth/refresh`

Example:

```bash
BASE_URL="http://localhost:8000/api/v1"

# Register
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"builder01","email":"builder01@example.com","password":"StrongPass1!"}'

# Login
TOKENS=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=builder01&password=StrongPass1!")
ACCESS_TOKEN=$(echo "$TOKENS" | jq -r '.access_token')
REFRESH_TOKEN=$(echo "$TOKENS" | jq -r '.refresh_token')

# Refresh access token
NEW_ACCESS=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" | jq -r '.access_token')

# Logout (revoke refresh token)
curl -X POST "$BASE_URL/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"
```

## Endpoint Groups

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Kits
- `GET /kits`
- `POST /kits`
- `GET /kits/search`
- `GET /kits/{kit_id}`
- `PUT /kits/{kit_id}`
- `DELETE /kits/{kit_id}`
- `GET /kits/{kit_id}/timeline`
- `POST /kits/{kit_id}/timeline`

### Assets
- `GET /assets` (supports `kit_id`, `skip`, `limit`)
- `POST /assets` (multipart upload)
- `GET /assets/{asset_id}`
- `GET /assets/{asset_id}/file`
- `DELETE /assets/{asset_id}`

### Links
- `GET /links`
- `POST /links`
- `DELETE /links/{link_id}`

### Tags
- `GET /tags`
- `POST /tags`

### Stats
- `GET /stats`

### Operational
- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`

## Token Lifecycle

1. **Login** — `POST /auth/login` returns an `access_token` (short-lived) and `refresh_token` (long-lived). Each token carries a unique `jti` (JWT ID) claim used for revocation tracking.
2. **Authenticated requests** — Send `Authorization: Bearer <access_token>`. If the access token expires, the server returns 401.
3. **Silent refresh** — On 401, the frontend automatically calls `POST /auth/refresh` with the stored refresh token to obtain a new access token, then retries the original request. Concurrent 401s share a single refresh call via a lock.
4. **Logout** — `POST /auth/logout` inserts the refresh token's `jti` into the revocation denylist. Subsequent refresh attempts with that token are rejected.
5. **Multi-device** — Each login produces independent tokens. Logging out on one device does not affect others.

## Common Query Conventions
- Pagination:
  - `skip`: offset
  - `limit`: page size (capped by `API_PAGE_SIZE_MAX`)
- Kit search filters:
  - `q`, `grade`, `brand`, `series`, `build_status`, `scale`, `tag`
  - multi-value filters are supported for `brand`, `series`, `scale`, `tag` using repeated query params:
    - example: `/kits/search?brand=Bandai&brand=Kotobukiya&scale=1/144&scale=1/100`

## Error Shape
The API uses structured JSON errors, for example:

```json
{
  "error": "validation_error",
  "message": "Request validation failed",
  "details": {
    "errors": []
  }
}
```

Rate limit responses use HTTP `429` and include `Retry-After`.

On 401, the frontend automatically attempts a silent token refresh before
showing a login prompt. Only if the refresh fails (revoked token, expired
refresh token, or network error) is the user redirected to login.

## Auth Enforcement Controls
Environment toggles:
- `REQUIRE_AUTH_FOR_READS`
- `REQUIRE_AUTH_FOR_WRITES`

Recommended:
- Dev: reads/writes can be open
- Staging/Production: set both to `true`

## Frontend Integration Checklist
1. Load and store both `access_token` and `refresh_token`.
2. Add `Authorization: Bearer <access_token>` on protected requests.
3. On `401`, call `POST /auth/refresh` once and retry original request.
4. Handle `429` by respecting `Retry-After`.
5. Use `GET /assets?kit_id=...` for per-kit asset views.
6. Use `GET /kits/search` for filterable inventory UIs.
