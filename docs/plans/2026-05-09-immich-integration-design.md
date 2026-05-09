# Immich Integration — Design

Date: 2026-05-09

## Summary

Add an "Import from Immich" panel to the kit image upload sections. Browse Immich tags, filter assets, select images, and add them as external references — no file upload, images are fetched on-demand through a backend proxy.

## Architecture

```
Browser → Artifactory Frontend
           ↓ /api/v1/immich/*  (proxy)
        Artifactory Backend (env: IMMICH_API_KEY)
           ↓ x-api-key
        Immich Server (same Docker host)
```

API key never leaves the server.

## Backend Changes

### 1. Config (`core/config.py`)
- `immich_api_endpoint: str`
- `immich_api_key: str`

### 2. Asset Model Migration
New nullable columns on `assets`:
- `external_source: VARCHAR(32)` — `"immich"` or `null`
- `external_asset_id: VARCHAR(64)` — Immich asset UUID
- `external_thumbnail_url: VARCHAR(512)` — cached preview URL

When `external_source` is null, it's a normal local file. When set, `file_path`/`thumbnail_path` are null.

### 3. Proxy Endpoints (`api/v1/endpoints/immich.py`)

| Endpoint | Maps to Immich |
|----------|---------------|
| `GET /immich/tags` | `GET /tags` |
| `POST /immich/search` | `POST /search/metadata` |
| `GET /immich/assets/{id}/thumbnail` | `GET /assets/{id}/thumbnail?size=preview` |
| `GET /immich/assets/{id}/original` | `GET /assets/{id}/original?edited=true` |

All use shared `requests.Session` with `x-api-key` + `trust_env = False`.

### 4. Asset Create Extension
`POST /assets` accepts optional form fields: `external_source`, `external_asset_id`, `external_thumbnail_url`. When provided, skips file validation — creates a pointer record.

### 5. Asset Schema
`AssetRead` gains `external_source`, `external_asset_id`, `external_thumbnail_url`.

## Frontend Changes

### 6. ImmichPicker Component

Full-screen modal panel with 3 states:

**State 1 — Tag Browser:**
- Fetch `GET /immich/tags` on mount
- Display all tags as toggle chips
- Button: "Search with selected tags"

**State 2 — Results Grid:**
- `POST /immich/search` with selected `tagIds`, `page=1`, `size=60`
- Infinite scroll loads more pages
- Bulk actions: "Select all visible" / "Select all matching" / "Clear"
- Shift+click range selection
- Each thumbnail is a toggle (click to select/deselect, visual checkmark)

**State 3 — Confirmation:**
- Sticky bottom bar: "N selected · [Confirm & Add to Kit]"
- On confirm: creates asset records via `POST /assets` for each selected image, passes them to parent section

### 7. NewKitPage + KitWorkspacePage
- "Import from Immich" button next to each file upload label
- On confirm from ImmichPicker, adds external assets to the section's items

### 8. ImageViewer
- When `external_source === "immich"`, use `GET /immich/assets/{id}/original` for full image
- Thumbnails use `GET /immich/assets/{id}/thumbnail`

## Selection Design

- Infinite scroll (60/page), no page buttons
- Selection state is a `Set<assetId>`, survives scroll
- "Select all matching" flags every result across ALL pages
- Shift+click for range
- Sticky counter bar at bottom
