# Immich API Handoff Notes

This project uses a local Immich OpenAPI export at:

- `docs/immich-openapi-specs.json`

The spec is large, so prefer targeted `rg`/line reads instead of loading it all.

## Local App Context

- Python GUI app entrypoint: `main.py`
- Env file: `.env`
- Required env values:
  - `IMMICH_API_ENDPOINT`, example: `http://192.168.50.68:2283/api`
  - `IMMICH_API_KEY`
- `.env` is ignored by git.
- Python `requests` must bypass local proxy env vars for LAN Immich access:
  - `session.trust_env = False`
- Current dependencies:
  - `requests`
  - `python-dotenv`
  - `pillow`
  - `pillow-heif` for HEIC/HEIF originals

## Auth

The OpenAPI spec lists `api_key` security on the endpoints used here.

Working header:

```http
x-api-key: <IMMICH_API_KEY>
```

For binary image endpoints, use:

```http
Accept: */*
```

## Endpoints Used

### List Tags

Spec anchor: `docs/immich-openapi-specs.json:12704`

```http
GET /tags
```

Purpose: fetch all tags on app startup.

Response: array of `TagResponseDto`.

Important fields:

- `id`: tag UUID, use this for filtering
- `name`: short tag name
- `value`: full tag path, best UI display label
- `color`: optional hex color

Schema anchor: `TagResponseDto` at `docs/immich-openapi-specs.json:24990`

### Search Assets By Tags

Spec anchor: `docs/immich-openapi-specs.json:9582`

```http
POST /search/metadata
Content-Type: application/json
```

Payload used by this app:

```json
{
  "page": 1,
  "size": 60,
  "tagIds": ["<tag uuid>"],
  "type": "IMAGE",
  "withDeleted": false
}
```

Important request fields:

- `tagIds`: array of tag UUIDs
- `type`: `IMAGE` filters to still images
- `page`: starts at `1`
- `size`: max documented as `1000`

Response shape:

```json
{
  "assets": {
    "items": [],
    "count": 0,
    "total": 0,
    "nextPage": null
  },
  "albums": {}
}
```

Useful schema anchors:

- `MetadataSearchDto`: `docs/immich-openapi-specs.json:18651`
- `SearchAssetResponseDto`: `docs/immich-openapi-specs.json:20849`
- `AssetResponseDto`: `docs/immich-openapi-specs.json:16627`
- `AssetTypeEnum`: `docs/immich-openapi-specs.json:16899`

Important asset fields:

- `id`: asset UUID, use for thumbnails/originals
- `originalFileName`: user-facing filename
- `originalMimeType`: useful for debugging unsupported formats
- `width`, `height`: may be present for display info

### Fetch Preview Thumbnail

Spec anchor: `docs/immich-openapi-specs.json:4131`

```http
GET /assets/{id}/thumbnail?size=preview
Accept: */*
```

Purpose: gallery thumbnail/preview display.

Returns binary image data.

Useful `size` values are defined by `AssetMediaSize`.
Schema anchor: `docs/immich-openapi-specs.json:16345`

Current app choice:

- `size=preview`, then scales locally to `260px`

### Fetch Original Image

Spec anchor: `docs/immich-openapi-specs.json:4043`

```http
GET /assets/{id}/original?edited=true
Accept: */*
```

Purpose: double-click thumbnail popup.

Returns the original binary asset. This may be JPG, PNG, HEIC/HEIF, or another image format.

Implementation notes:

- Use `pillow-heif.register_heif_opener()` before decoding HEIC/HEIF.
- Apply `ImageOps.exif_transpose(image)` so phone photos display with correct orientation.
- If original decoding fails, fall back to `/assets/{id}/thumbnail?size=preview`.

## Current GUI Flow

1. Read `.env`.
2. Build `ImmichClient`.
3. On startup, call `GET /tags`.
4. Render each tag as a selectable list item.
5. User selects one or more tags into the filter.
6. Search button calls `POST /search/metadata` with selected `tagIds`.
7. For each returned asset, call `GET /assets/{id}/thumbnail?size=preview`.
8. Double-click a thumbnail to call `GET /assets/{id}/original?edited=true` and show a scaled popup.

## Debugging Notes

- If Python gets `502` while Hoppscotch/Postman works, check proxy env vars:
  - `http_proxy`
  - `https_proxy`
  - `all_proxy`
- This repo already sets `requests.Session.trust_env = False` to avoid routing LAN Immich traffic through local proxies.
- If full image popup says `cannot identify image file`, the asset may be HEIC/HEIF or a non-image response. This repo uses `pillow-heif` and a preview fallback.
- `.env` should be preferred over ambient shell env values. This repo reads it with `dotenv_values(".env")`.

## Quick Smoke Tests

Compile:

```bash
uv run python -m py_compile main.py
```

Check tags:

```bash
uv run python -c "from main import build_client; c=build_client(); print(c.api_endpoint); print(len(c.get_tags()))"
```

Check full image decode:

```bash
uv run python - <<'PY'
from main import build_client

c = build_client()
for tag in c.get_tags():
    assets = c.search_assets_by_tags([tag.id])
    if assets:
        image = c.get_full_image(assets[0].id)
        print(assets[0].name, image.width, image.height)
        break
PY
```
