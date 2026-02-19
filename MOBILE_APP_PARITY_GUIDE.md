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
- Current user: `GET /api/v1/auth/me`

### Kits
- List with pagination: `GET /api/v1/kits`
- Search/filter: `GET /api/v1/kits/search`
- Create/update/delete: `POST/PUT/DELETE /api/v1/kits`
- Detail: `GET /api/v1/kits/{kit_id}`

### Assets
- Upload asset: `POST /api/v1/assets` (multipart)
- List/filter by kit: `GET /api/v1/assets?kit_id=...`
- Download/stream: `GET /api/v1/assets/{asset_id}/file`
- Delete: `DELETE /api/v1/assets/{asset_id}`

### Links
- List/create/delete links for kits: `/api/v1/links`

### Tags
- List/create tags: `/api/v1/tags`

### Build Timeline
- List/create per kit: `/api/v1/kits/{kit_id}/timeline`

### Stats + Ops
- Collection stats: `/api/v1/stats`
- Health and metrics: `/health`, `/health/live`, `/health/ready`, `/metrics`

## 4) Current Frontend Features (Web Baseline)

### Navigation / Pages
- Login
- Dashboard
- Kits list (cards with preview image/placeholder)
- Add Kit form
- Kit workspace:
  - overview
  - assets
  - links
  - timeline
- Settings
- Filter Management (auth-protected)

### Auth-Scoped Management
- `Filter Management` page is available only for authenticated users.
- Route behavior:
  - authenticated: can open `/settings/filters`
  - guest: redirect to `/login`

### Kit Media UX
- Add Kit page supports uploading initial images during creation.
- Kit detail overview has image gallery.
- User can set a gallery image as card thumbnail source.
- Current thumbnail preference persistence is frontend-local (browser storage).

### Kit Tag UX
- Tags are managed in Kit detail (overview), not in a standalone `Tags` nav page.
- Existing kit tags are removable inline (chip + remove action).
- Add-tag flow supports:
  - assign existing tag
  - create new tag (with color) and assign

### Filter UX
- Search and filters are separated.
- Search input is fixed at top of filter panel.
- Filter options are in a scrollable region.
- Multi-select filters are enabled for: `grade`, `build_status`, `brand`, `series`, `scale`, `tag`.
- Filter matching is case-insensitive.

## 5) Mobile Parity Checklist (Build Target)

### Must-have (Parity P0)
- Auth flow: login + refresh token handling.
- Dashboard cards (stats + recent kits with thumbnail).
- Kits list:
  - card UI
  - pagination
  - search + filters (`q`, `grade[]`, `brand[]`, `series[]`, `build_status[]`, `scale[]`, `tag[]`)
- Add Kit:
  - full metadata fields
  - tag selection
  - optional initial image upload
- Kit detail:
  - overview metadata + tags
  - inline tag remove
  - add tag (assign existing / create new)
  - image gallery
  - set thumbnail source
  - assets upload/list/delete
  - links create/list/delete
  - timeline create/list
- Filter Management page (auth-only):
  - view current filter values and counts
  - rename `brand/series/scale` values in batch
  - create new dynamic filter values for `brand/series/scale`
  - create new `tag` values
  - treat `status` as static enum (no create/delete)

### Recommended (P1)
- Handle `429` rate limit with retry messaging using `Retry-After`.
- Pull-to-refresh on list/detail pages.
- Better upload progress indicators for asset/image uploads.
- Empty states for all lists (kits/assets/links/timeline/tags).

## 6) Screen-to-API Mapping

### Login Screen
- `POST /auth/login`
- `POST /auth/refresh` (token renewal)

### Dashboard Screen
- `GET /stats`
- `GET /kits?skip=0&limit=...`
- `GET /assets?kit_id=...` (for recent kit thumbnails)

### Kits Screen
- `GET /kits` (default browse)
- `GET /kits/search` (when any filter is active)
- `GET /assets?kit_id=...` (thumbnail resolution)

### Add Kit Screen
- `POST /kits`
- `POST /assets` (for each selected image after kit creation)

### Kit Detail Screen
- `GET /kits/{kit_id}`
- `GET /assets?kit_id=...`
- `GET /links` (filter by `kit_id` client-side for now)
- `GET /kits/{kit_id}/timeline`
- `POST /assets`, `DELETE /assets/{asset_id}`
- `POST /links`, `DELETE /links/{link_id}`
- `POST /kits/{kit_id}/timeline`

### Kit Detail Tag Actions
- `PUT /kits/{kit_id}` with `tag_ids`
- `GET /tags`
- `POST /tags`

### Filter Management Screen (Auth only)
- `GET /kits` (load all kits for aggregate values)
- `PUT /kits/{kit_id}` (batch rename field values)
- `GET /tags`
- `POST /tags` (create tag option)

## 7) Data/State Notes for Mobile
- Persist `access_token` + `refresh_token` in secure storage (Keychain/Keystore).
- On `401`:
  1. call `/auth/refresh` once,
  2. retry failed request,
  3. if still failing, return to login.
- Cache lightweight list data locally for perceived performance.
- Asset files are remote; use URL-based image loading with caching.

## 8) Known Gaps and Suggested Backend Enhancements

### Gap A: Thumbnail source is not server-persisted
- Current web implementation stores selected thumbnail source in local storage.
- Suggested backend enhancement:
  - add `kits.thumbnail_asset_id` nullable foreign key,
  - return it in `GET /kits` and `GET /kits/{kit_id}`,
  - accept it in `PUT /kits/{kit_id}`.

### Gap B: Links list endpoint is global
- Currently `GET /links` returns all links and UI filters by `kit_id`.
- Suggested enhancement:
  - support `GET /links?kit_id=...` server-side filtering.

### Gap C: Asset thumbnail variants
- Optional enhancement:
  - expose explicit resized preview URL in API response to optimize mobile bandwidth.

### Gap D: Dynamic filter dictionaries are frontend-local
- Current dynamic additions for `brand/series/scale` in Filter Management are client-local (local storage), not server-persisted dictionary resources.
- Suggested backend enhancement:
  - add dedicated filter dictionary endpoints/resources (e.g. `/filters/brands`, `/filters/series`, `/filters/scales`) for create/list/delete/rename with auth controls.

## 9) Suggested Mobile Implementation Sequence
1. Auth + token refresh infrastructure.
2. Kits list + search filters + detail read-only.
3. Kit detail editing (tags/assets/links/timeline).
4. Filter Management (auth-only) and bulk rename utilities.
5. Thumbnail source polish + settings.

## 10) Definition of Done for Mobile Parity
- Every P0 capability above is available and validated against the same backend.
- App can complete full lifecycle:
  1. login
  2. create kit with images
  3. browse/search kits
  4. open kit detail and manage assets/links/timeline
  5. set thumbnail source and see it reflected in list cards
- Error paths (`401`, `429`, validation failures) are user-visible and recoverable.
