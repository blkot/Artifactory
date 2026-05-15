# Mobile App Parity Guide

This document defines how to build a mobile app with feature parity to the current Artifactory web frontend, using the existing backend APIs.

## 1) Purpose
- Describe current backend capabilities.
- Describe current frontend behavior and UX expectations.
- Provide a concrete parity checklist for iOS/Android implementation.

## 2) Source References
- API reference: `API_GUIDE.md`
- Frontend structure/design: `FRONTEND_DESIGN_PLAN.md`
- Live API schema: `http://localhost:8000/openapi.json`

## 3) Current Backend Capabilities (Available Now)

### Auth
- Register user: `POST /api/v1/auth/register`
- Login: `POST /api/v1/auth/login`
- Refresh access token: `POST /api/v1/auth/refresh`
- Logout (token revocation): `POST /api/v1/auth/logout`
- Current user: `GET /api/v1/auth/me`
- Token lifecycle: JWT tokens carry `jti` claims. Refresh tokens are revoked on logout. The `RevokedToken` denylist is checked on every authenticated request and refresh attempt.

### Kits
- List with pagination + sort: `GET /api/v1/kits?skip=0&limit=20&sort=created_at&order=desc`
- Search/filter: `GET /api/v1/kits/search` (supports `q`, `grade`, `brand`, `series`, `build_status`, `scale`, `tag`, `sort`, `order`)
- Create/update/delete: `POST/PUT/DELETE /api/v1/kits`
- Detail: `GET /api/v1/kits/{kit_id}`
- Kit schema includes `thumbnail_asset_id` (nullable FK to assets) for server-persisted cover image

### Assets
- Upload asset: `POST /api/v1/assets` (multipart, file optional for external references)
- List/filter by kit: `GET /api/v1/assets?kit_id=...`
- Download/stream: `GET /api/v1/assets/{asset_id}/file`
- Download thumbnail: `GET /api/v1/assets/{asset_id}/thumbnail`
- Delete: `DELETE /api/v1/assets/{asset_id}`
- External asset references: assets can have `external_source`, `external_asset_id`, `external_thumbnail_url` — no file upload needed
- Asset schema includes `thumbnail_url` computed field

### Links
- List with optional kit filter: `GET /api/v1/links?kit_id=...`
- Create/update/delete: `POST/PUT/DELETE /api/v1/links`

### Tags
- List all tags: `GET /api/v1/tags`
- Create tag: `POST /api/v1/tags`
- Update tag: `PUT /api/v1/tags/{id}`

### Build Timeline
- List per kit: `GET /api/v1/kits/{kit_id}/timeline`
- Create entry: `POST /api/v1/kits/{kit_id}/timeline`

### Filter Dictionaries (Server-Persisted)
- List values for a field: `GET /api/v1/filters/{field}` (field = brand/series/scale)
- Create value: `POST /api/v1/filters/{field}`
- Delete value: `DELETE /api/v1/filters/{field}/{value}`

### Immich Integration (Proxy)
- Check connectivity: `GET /api/v1/immich/health`
- List tags: `GET /api/v1/immich/tags`
- Search assets: `POST /api/v1/immich/search`
- Thumbnail: `GET /api/v1/immich/assets/{id}/thumbnail` (no auth required, for `<img>` tags)
- Original: `GET /api/v1/immich/assets/{id}/original` (no auth required, for `<img>` tags)

### Stats + Ops
- Collection stats: `GET /api/v1/stats`
- Health and metrics: `/health`, `/health/live`, `/health/ready`, `/metrics`

## 4) Current Frontend Features (Web Baseline)

### Navigation / Pages
- Login
- Dashboard (stats cards + recent kits with sort toggle)
- Kits list (cards with preview image/placeholder, sort toggle Newest/Oldest)
- Add Kit form (sectioned: Required fields, collapsible Optional, per-type image sections)
- Kit workspace:
  - Overview (metadata + tags + cover + grouped image gallery + links summary + timeline summary)
  - Assets (sectioned by type: Box Art, Manual, Build Photos, Reference Images, Videos, Documents)
  - Links (create/list/delete)
  - Timeline (create/list)
- Settings
- Filter Management (auth-protected, server-persisted dictionaries)

### Auth
- Login with JWT access + refresh tokens
- Silent token refresh on 401 with concurrent-request lock
- Logout revokes refresh token server-side
- Auto-logout event on unrecoverable auth failure

### Kit Media UX
- Add Kit: per-type image sections (Box Art, Manual, Build Photos, Reference Images) with file picker + preview grid + remove button + upload status tracking
- "Import from Immich" button per section: tag-based browsing, infinite scroll, bulk select, auto-tag mirroring
- Image gallery grouped by asset type with IMMICH/NATIVE source badges
- Full-canvas image viewer (yet-another-react-lightbox): zoom, pan, keyboard nav, thumbnail strip, "Set as Cover" button
- Cover image set from viewer, persisted server-side via `thumbnail_asset_id`

### Kit Tag UX
- Tags managed in Kit detail overview (inline remove)
- Add-tag flow: assign existing or create new (with color) and assign
- Tag creation also available in New Kit page
- Immich image import auto-mirrors source tags to the kit

### Form UX
- Datalist comboboxes for Series/Brand/Scale with suggestions from existing values
- Inline field validation with red highlights on blur
- Backend validation errors mapped to specific fields

### Filter UX
- Search and filters separated
- Multi-select chip filters for: grade, build_status, brand, series, scale, tag
- Filter matching is case-insensitive
- Filter values server-persisted via FilterValue model + CRUD endpoints

## 5) Mobile Parity Checklist (Build Target)

### Must-have (Parity P0)
- Auth flow: login + refresh token handling + logout revocation.
- Dashboard cards (stats + recent kits with thumbnail, newest-first default).
- Kits list:
  - card UI with source badge (local vs Immich)
  - pagination
  - sort toggle (newest/oldest)
  - search + filters (`q`, `grade[]`, `brand[]`, `series[]`, `build_status[]`, `scale[]`, `tag[]`)
- Add Kit:
  - sectioned form: required fields + collapsible optional section
  - datalist/autocomplete for series/brand/scale
  - tag selection + inline tag creation (with color)
  - image sections per type (Box Art, Manual, Build Photos, Reference Images)
  - file picker + preview + remove + upload status
  - Immich image import (tag browser → thumb grid → select → confirm)
  - post-create navigation to kit workspace
- Kit detail:
  - overview: metadata + tags + cover image + grouped image gallery + links summary + timeline summary
  - image gallery grouped by type with source badges (Immich/Native)
  - full-screen image viewer with zoom, pan, keyboard nav, thumbnail strip
  - set cover image from viewer (persisted server-side)
  - inline tag remove
  - add tag (assign existing / create new)
  - assets upload/list/delete (sectioned by type)
  - Immich image import to existing kit (with tag mirroring)
  - links create/list/delete
  - timeline create/list
- Filter Management page (auth-only):
  - view current filter values and counts
  - rename brand/series/scale values in batch (updates kits + filter dictionaries)
  - create/delete dynamic filter values (server-persisted)
  - create tag values
  - treat status as static enum (no create/delete)

### Recommended (P1)
- Handle `429` rate limit with retry messaging using `Retry-After`.
- Pull-to-refresh on list/detail pages.
- Better upload progress indicators for asset/image uploads.
- Empty states for all lists (kits/assets/links/timeline/tags).
- Immich connectivity check + offline fallback for broken images.
- Image viewer: zoom/pan/double-tap gestures, swipe between images.
- Keyboard navigation in image viewer (arrows, escape).

## 6) Screen-to-API Mapping

### Login Screen
- `POST /auth/login`
- `POST /auth/refresh` (token renewal)
- `POST /auth/logout` (token revocation)

### Dashboard Screen
- `GET /stats`
- `GET /kits?skip=0&limit=...&sort=created_at&order=desc`
- `GET /assets?kit_id=...` (for recent kit thumbnails)

### Kits Screen
- `GET /kits` (default browse, supports `sort` and `order`)
- `GET /kits/search` (when any filter is active, supports `sort` and `order`)
- `GET /assets?kit_id=...` (thumbnail resolution)

### Add Kit Screen
- `POST /kits` (with optional `thumbnail_asset_id`)
- `POST /assets` (for each selected image after kit creation, or `external_source=immich` for Immich imports)
- `GET /immich/tags` (for Immich browser)
- `POST /immich/search` (for Immich image search)
- `GET /tags` (tag selection)
- `POST /tags` (inline tag creation)

### Kit Detail Screen
- `GET /kits/{kit_id}`
- `GET /assets?kit_id=...`
- `GET /links?kit_id=...`
- `GET /kits/{kit_id}/timeline`
- `POST /assets` (with optional external fields), `DELETE /assets/{asset_id}`
- `POST /links`, `DELETE /links/{link_id}`
- `POST /kits/{kit_id}/timeline`
- `PUT /kits/{kit_id}` (edit metadata, set `thumbnail_asset_id`, update `tag_ids`)

### Image Viewer
- `GET /assets/{id}/thumbnail` (local thumbnails)
- `GET /assets/{id}/file` (local originals)
- `GET /immich/assets/{id}/thumbnail` (Immich thumbnails, no auth)
- `GET /immich/assets/{id}/original` (Immich originals, no auth)

### Kit Detail Tag Actions
- `PUT /kits/{kit_id}` with `tag_ids`
- `GET /tags`
- `POST /tags`

### Filter Management Screen (Auth only)
- `GET /kits` (load all kits for aggregate values)
- `PUT /kits/{kit_id}` (batch rename field values)
- `GET /tags`
- `POST /tags` (create tag option)
- `GET /filters/{field}` (list persisted filter values)
- `POST /filters/{field}` (create filter value)
- `DELETE /filters/{field}/{value}` (delete filter value)

## 7) Data/State Notes for Mobile
- Persist `access_token` + `refresh_token` in secure storage (Keychain/Keystore).
- On `401`:
  1. call `/auth/refresh` once,
  2. retry failed request,
  3. if still failing, return to login.
- Cache lightweight list data locally for perceived performance.
- Asset files are remote; use URL-based image loading with caching.
- Immich images require no local storage — fetch thumbnails/originals on demand through the API proxy.

## 8) Known Gaps — All Resolved

All four gaps from the original parity guide have been resolved:

| Gap | Resolution |
|-----|-----------|
| **A: Thumbnail source not server-persisted** | `kits.thumbnail_asset_id` FK added. API returns and accepts it. |
| **B: Links list endpoint is global** | `GET /links?kit_id=...` server-side filter added. |
| **C: Asset thumbnail variants** | `GET /assets/{id}/thumbnail` endpoint + `thumbnail_url` computed field. |
| **D: Dynamic filter dictionaries are frontend-local** | `FilterValue` model + `GET/POST/DELETE /filters/{field}` endpoints. |

### New Considerations
- **Immich API key security**: the Immich API key is server-side only. All Immich traffic is proxied through the Artifactory backend. Thumbnail/original endpoints are public (for `<img>` tag support) but the API key never leaves the server.
- **External asset references**: the `assets` table now supports pointer records (`external_source`, `external_asset_id`, `external_thumbnail_url`). These assets have no local file — they're fetched on demand through the Immich proxy.

## 9) Suggested Mobile Implementation Sequence
1. Auth + token refresh + logout infrastructure.
2. Kits list + search filters + detail read-only.
3. Kit detail editing (tags/assets/links/timeline).
4. Filter Management (auth-only) with server-persisted dictionaries.
5. Image viewer with Immich support + cover image setting.
6. Add Kit form with Immich import.

## 10) Definition of Done for Mobile Parity
- Every P0 capability above is available and validated against the same backend.
- App can complete full lifecycle:
  1. login
  2. create kit with images (local or Immich)
  3. browse/search kits with sort
  4. open kit detail and manage assets/links/timeline
  5. set thumbnail source and see it reflected in list cards
  6. import images from Immich with tag mirroring
- Error paths (`401`, `429`, validation failures) are user-visible and recoverable.
- Immich images gracefully degrade when the Immich server is offline.
