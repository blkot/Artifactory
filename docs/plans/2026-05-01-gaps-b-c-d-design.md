# Gaps B, C, D: Combined Design

Date: 2026-05-01

## Gap B: Server-side links filtering

Add `?kit_id=` query param to `GET /links`.

- `crud/link.py`: `list_links(db, kit_id=None)` — filter by `kit_id` when provided
- `endpoints/links.py`: accept optional `kit_id` query param
- Frontend: remove client-side `.filter()` in KitWorkspacePage

## Gap C: Thumbnail URLs in API

Add thumbnail serving endpoint and expose URL in asset responses.

- New endpoint: `GET /assets/{asset_id}/thumbnail` — serves thumbnail file, returns 404 if asset has none
- `AssetRead` schema: add `thumbnail_url: str | None` computed from the asset's `thumbnail_path`. Return `f"/api/v1/assets/{id}/thumbnail"` when thumbnail exists
- No frontend changes (existing code uses `api.assetFileUrl` for images — thumbnails are served separately)

## Gap D: Server-persisted filter dictionaries

New table and endpoints for custom filter values (brand/series/scale) that persist server-side.

- New model: `FilterValue` — columns: `id`, `field` (str), `value` (str), `created_at`. Unique constraint on `(field, value)` with case-insensitive comparison handled at application level
- New endpoints:
  - `GET /filters/{field}` — list values for a field
  - `POST /filters/{field}` — create a value (body: `{"value": "..."}`)
  - `DELETE /filters/{field}/{value}` — remove a value
- Frontend: FilterManagementPage calls these endpoints instead of localStorage
