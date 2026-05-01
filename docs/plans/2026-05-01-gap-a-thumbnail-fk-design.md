# Gap A: Thumbnail Source Server-Persisted — Design

Date: 2026-05-01

## Summary

Add `kits.thumbnail_asset_id` FK so the selected kit cover image is stored server-side instead of only in browser localStorage. This enables cross-device consistency for mobile parity.

## What Changes

### Backend

**Kit model** (`backend/app/models/kit.py`):
- Add: `thumbnail_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)`
- FK cascades as SET NULL on asset deletion (SQLite default for nullable FK)

**Kit schemas** (`backend/app/schemas/kit.py`):
- `KitBase`: add `thumbnail_asset_id: int | None = None`
- `KitUpdate`: add `thumbnail_asset_id: int | None = None`
- `KitRead`: add `thumbnail_asset_id: int | None = None`

**CRUD**: `create_kit()` auto-handles via `model_dump()`. `update_kit()` already uses `setattr` loop, no change needed.

**Alembic**: migration to add the column.

### Frontend

**App.jsx**:
- Read path: use `kit.thumbnail_asset_id` from API as source of truth. Fall back to localStorage only when unset.
- Write path: `setKitThumbnailSource` calls `PUT /kits/{kit_id}` with `thumbnail_asset_id` (or `null` to use placeholder).
- localStorage remains as transient cache, not authority.

## What Does NOT Change
- Thumbnail generation on upload (300x300, existing)
- Cover image UI in KitWorkspacePage
- Asset deletion with thumbnails
