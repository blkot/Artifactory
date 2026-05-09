# Immich Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Immich image browsing to kit image upload, with backend proxy protecting the API key.

**Architecture:** Backend proxy routes forward requests to Immich with server-side API key. New Asset columns store external references instead of local files. Frontend ImmichPicker component provides tag-based browsing with infinite scroll, bulk select, and confirm flow.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React, Playwright (testing)

---

### Task 1: Add Immich config to Settings

**Files:** `backend/app/core/config.py`

**Step 1: Read the file, add fields**

```python
immich_api_endpoint: str = ""
immich_api_key: str = ""
```

**Step 2: Run tests, commit**

```bash
cd backend && uv run --extra dev pytest -v
git add backend/app/core/config.py
git commit -m "immich add config fields for api endpoint and key"
```

---

### Task 2: Add external columns to Asset model + migration

**Files:** `backend/app/models/asset.py`, `backend/app/schemas/asset.py`

**Step 1: Add columns to Asset model**

```python
external_source = Column(String(32), nullable=True)
external_asset_id = Column(String(64), nullable=True)
external_thumbnail_url = Column(String(512), nullable=True)
```

Place after `description` / `is_external_reference`.

**Step 2: Generate migration**

```bash
cd backend && uv run alembic revision --autogenerate -m "add external asset reference columns"
```

If autogenerate produces empty body, write manually with `op.add_column` using `batch_alter_table`.

**Step 3: Update AssetRead schema**

Add to `AssetRead`:
```python
external_source: str | None = None
external_asset_id: str | None = None
external_thumbnail_url: str | None = None
```

**Step 4: Verify migration cycle + tests**

```bash
cd backend && uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head
cd backend && uv run --extra dev pytest -v
```

**Step 5: Commit**

```bash
git add backend/app/models/asset.py backend/app/schemas/asset.py backend/alembic/versions/*external_asset*
git commit -m "immich add external_source/external_asset_id/external_thumbnail_url to Asset"
```

---

### Task 3: Create Immich proxy service

**Files:** Create `backend/app/services/immich_service.py`

**Step 1: Create the service**

```python
import requests
from app.core.config import get_settings

class ImmichService:
    def __init__(self):
        settings = get_settings()
        self.endpoint = settings.immich_api_endpoint.rstrip("/")
        self.session = requests.Session()
        self.session.headers["x-api-key"] = settings.immich_api_key
        self.session.headers["Accept"] = "application/json"
        self.session.trust_env = False

    def get_tags(self) -> list[dict]:
        resp = self.session.get(f"{self.endpoint}/tags")
        resp.raise_for_status()
        return resp.json()

    def search_assets(self, tag_ids: list[str], page: int = 1, size: int = 60) -> dict:
        payload = {
            "page": page,
            "size": size,
            "tagIds": tag_ids,
            "type": "IMAGE",
            "withDeleted": False,
        }
        resp = self.session.post(f"{self.endpoint}/search/metadata", json=payload)
        resp.raise_for_status()
        return resp.json()

    def get_asset_thumbnail(self, asset_id: str) -> bytes:
        resp = self.session.get(
            f"{self.endpoint}/assets/{asset_id}/thumbnail?size=preview",
            headers={"Accept": "*/*"},
        )
        resp.raise_for_status()
        return resp.content

    def get_asset_original(self, asset_id: str) -> bytes:
        resp = self.session.get(
            f"{self.endpoint}/assets/{asset_id}/original?edited=true",
            headers={"Accept": "*/*"},
        )
        resp.raise_for_status()
        return resp.content
```

**Step 2: Commit**

```bash
git add backend/app/services/immich_service.py
git commit -m "immich add proxy service with shared requests session"
```

---

### Task 4: Create Immich proxy endpoints

**Files:** Create `backend/app/api/v1/endpoints/immich.py`, modify `backend/app/api/v1/api.py`

**Step 1: Create endpoints**

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.api.deps import require_read_access
from app.services.immich_service import ImmichService

router = APIRouter(prefix="/immich", tags=["immich"])


@router.get("/tags", summary="List Immich tags")
def list_tags(_auth=Depends(require_read_access)) -> list[dict]:
    try:
        return ImmichService().get_tags()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Immich error: {e}")


@router.post("/search", summary="Search Immich assets by tags")
def search_assets(
    body: dict,
    _auth=Depends(require_read_access),
) -> dict:
    tag_ids = body.get("tagIds", [])
    page = body.get("page", 1)
    size = body.get("size", 60)
    try:
        return ImmichService().search_assets(tag_ids, page=page, size=size)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Immich error: {e}")


@router.get("/assets/{asset_id}/thumbnail", summary="Get Immich asset thumbnail")
def get_thumbnail(
    asset_id: str,
    _auth=Depends(require_read_access),
):
    try:
        content = ImmichService().get_asset_thumbnail(asset_id)
        return Response(content=content, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Immich error: {e}")


@router.get("/assets/{asset_id}/original", summary="Get Immich asset original")
def get_original(
    asset_id: str,
    _auth=Depends(require_read_access),
):
    try:
        content = ImmichService().get_asset_original(asset_id)
        return Response(content=content, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Immich error: {e}")
```

**Step 2: Register router in api.py**

Add `from app.api.v1.endpoints import assets, auth, filters, immich, kits, links, stats, tags` and `api_router.include_router(immich.router)`.

**Step 3: Run tests and commit**

```bash
cd backend && uv run --extra dev pytest -v
git add backend/app/api/v1/endpoints/immich.py backend/app/api/v1/api.py
git commit -m "immich add proxy endpoints for tags, search, thumbnails, originals"
```

---

### Task 5: Update POST /assets for external references

**Files:** `backend/app/api/v1/endpoints/assets.py`, `backend/app/schemas/asset.py`, `backend/app/services/asset_service.py`

**Step 1: Update AssetService.create_asset**

Accept optional `external_source`, `external_asset_id`, `external_thumbnail_url`. When `external_source` is provided, skip file upload — create the record with external fields and null file_path.

In `asset_service.py`, modify `create_asset`:
```python
async def create_asset(
    self,
    kit_id: int,
    asset_type: AssetType,
    file: UploadFile | None = None,
    description: str | None = None,
    is_external_reference: bool = False,
    external_source: str | None = None,
    external_asset_id: str | None = None,
    external_thumbnail_url: str | None = None,
) -> Asset:
```

When `external_source` is set, skip file processing and create asset directly:
```python
if external_source:
    asset = Asset(
        kit_id=kit_id,
        type=asset_type,
        file_path=None,
        thumbnail_path=None,
        original_filename=external_asset_id or "immich_asset",
        file_size=0,
        mime_type="image/jpeg",
        description=description,
        is_external_reference=True,
        external_source=external_source,
        external_asset_id=external_asset_id,
        external_thumbnail_url=external_thumbnail_url,
    )
    self.db.add(asset)
    self.db.commit()
    self.db.refresh(asset)
    return asset
```

**Step 2: Update upload_asset endpoint**

Add optional form fields:
```python
external_source: str | None = Form(default=None),
external_asset_id: str | None = Form(default=None),
external_thumbnail_url: str | None = Form(default=None),
```

Make `file` optional:
```python
file: UploadFile | None = File(default=None),
```

Pass them through to `AssetService.create_asset`.

**Step 3: Run tests and commit**

```bash
cd backend && uv run --extra dev pytest -v
git add backend/app/api/v1/endpoints/assets.py backend/app/services/asset_service.py
git commit -m "immich accept external reference fields in POST /assets"
```

---

### Task 6: Write tests

**Files:** Create `backend/tests/test_immich.py`

**Step 1: Write test file**

Test the proxy endpoints with mocked ImmichService:

```python
from unittest.mock import patch, MagicMock

def test_immich_tags_endpoint(client, auth_headers):
    with patch("app.api.v1.endpoints.immich.ImmichService") as MockService:
        instance = MockService.return_value
        instance.get_tags.return_value = [{"id": "uuid-1", "name": "gundam", "value": "gundam"}]
        resp = client.get("/api/v1/immich/tags", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "gundam"

def test_create_external_asset(client, auth_headers):
    # Create kit first
    kit_resp = client.post("/api/v1/kits", json={
        "name": "Immich Test Kit", "grade": "HG", "series": "Test",
        "brand": "Bandai", "scale": "1/144",
    }, headers=auth_headers)
    kit_id = kit_resp.json()["id"]

    # Create external asset (no file upload)
    resp = client.post("/api/v1/assets", data={
        "kit_id": str(kit_id),
        "type": "BOX_ART",
        "external_source": "immich",
        "external_asset_id": "abc-123-def",
        "external_thumbnail_url": "http://immich/api/assets/abc-123/thumbnail",
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["external_source"] == "immich"
    assert data["external_asset_id"] == "abc-123-def"
    assert data["file_path"] is None

def test_immich_service_error_returns_502(client, auth_headers):
    with patch("app.api.v1.endpoints.immich.ImmichService") as MockService:
        instance = MockService.return_value
        instance.get_tags.side_effect = Exception("Connection refused")
        resp = client.get("/api/v1/immich/tags", headers=auth_headers)
        assert resp.status_code == 502

def test_immich_thumbnail_proxy(client, auth_headers):
    with patch("app.api.v1.endpoints.immich.ImmichService") as MockService:
        instance = MockService.return_value
        instance.get_asset_thumbnail.return_value = b"\xff\xd8\xff"  # JPEG magic bytes
        resp = client.get("/api/v1/immich/assets/test-id/thumbnail", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/jpeg"
```

**Step 2: Run tests**

```bash
cd backend && uv run --extra dev pytest tests/test_immich.py -v
cd backend && uv run --extra dev pytest -v
```

**Step 3: Commit**

```bash
git add backend/tests/test_immich.py
git commit -m "immich add proxy endpoint tests with mocked service"
```

---

### Task 7: Create ImmichPicker React component

**Files:** Create `frontend/src/components/ImmichPicker.jsx`

**Step 1: Create the component**

Full-screen modal with three phases. Key state:

```javascript
const [phase, setPhase] = useState("tags"); // "tags" | "results" 
const [tags, setTags] = useState([]);
const [selectedTags, setSelectedTags] = useState(new Set());
const [assets, setAssets] = useState([]);
const [selectedAssets, setSelectedAssets] = useState(new Set());
const [loading, setLoading] = useState(false);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(false);
const [error, setError] = useState("");
const loaderRef = useRef(null);
```

Add `api` methods to `client.js`:
```javascript
getImmichTags: () => request("/immich/tags"),
searchImmichAssets: (tagIds, page = 1, size = 60) =>
    request("/immich/search", {
        method: "POST",
        body: JSON.stringify({ tagIds, page, size }),
    }),
```

Component structure:
```
Phase "tags":
  <div.immich-picker-backdrop>
    <div.immich-picker-panel>
      <h2>Immich — Select Tags</h2>
      <div.tag-grid> (toggle chips for each tag) </div>
      <button onClick={startSearch}>Search</button>
    </div>

Phase "results":
  <div.immich-picker-backdrop>
    <div.immich-picker-panel>
      <h2>Select Images ({selectedAssets.size} selected)</h2>
      <div.bulk-actions>
        [Select all visible] [Select all matching] [Clear]
      </div>
      <div.thumb-grid ref={scrollContainer}>
        {assets.map(asset => (
          <div.thumb-item onClick={toggleAsset}>
            <img src={immichThumbUrl(asset.id)} />
            {selectedAssets.has(asset.id) ? <div.checkmark /> : null}
          </div>
        ))}
        <div ref={loaderRef} /> {/* infinite scroll trigger */}
      </div>
      <div.sticky-bar>
        {selectedAssets.size} selected · [Confirm & Add]
      </div>
    </div>
```

Infinite scroll via IntersectionObserver on `loaderRef`. Shift-click for range selection. "Select all matching" stores a `selectAll: true` flag — confirm iterates over all loaded assets.

Confirm calls `onConfirm(selectedAssets)` — the parent receives `[{ id, thumbnail_url, external_asset_id }]`.

Props: `{ open, onClose, onConfirm }`

**Step 2: Build and commit**

```bash
cd frontend && npm run build
git add frontend/src/components/ImmichPicker.jsx frontend/src/api/client.js
git commit -m "immich add ImmichPicker component with tag browser and thumbnail grid"
```

---

### Task 8: Add Immich button to NewKitPage + KitWorkspacePage

**Files:** `frontend/src/pages/NewKitPage.jsx`, `frontend/src/pages/KitWorkspacePage.jsx`

**Step 1: Add ImmichPicker integration to NewKitPage**

Add state: `const [immichOpen, setImmichOpen] = useState(null);` (null or section key).
Next to each file input label, add the Immich button:

```jsx
<label className="file-input-btn">Select files...</label>
<button type="button" className="immich-btn"
    onClick={() => setImmichOpen(section.key)}>
    Immich
</button>
```

On confirm from ImmichPicker:
```javascript
function handleImmichConfirm(immichAssets) {
    // Convert immich assets to our section item format
    const items = immichAssets.map(a => ({
        key: nextKey++,
        file: null,
        status: "done",
        externalAssetId: a.id,
        thumbnailUrl: a.thumbnail_url,
        previewUrl: immichThumbUrl(a.id),
        filename: a.originalFileName || a.id,
    }));
    setSectionItems(prev => ({
        ...prev,
        [immichOpen]: [...prev[immichOpen], ...items],
    }));
    setImmichOpen(null);
}
```

**Step 2: Same for KitWorkspacePage assets tab**

Add Immich button next to each section's file input.

**Step 3: Build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/NewKitPage.jsx frontend/src/pages/KitWorkspacePage.jsx
git commit -m "immich add Immich button to kit creation and assets tab"
```

---

### Task 9: Update ImageViewer for Immich assets

**Files:** `frontend/src/components/ImageViewer.jsx`

**Step 1: Handle external_source**

When `current.external_source === "immich"`, use `API_BASE_URL/immich/assets/{external_asset_id}/original` for the full image and `API_BASE_URL/immich/assets/{id}/thumbnail` for thumbnails.

```javascript
function getAssetUrl(asset) {
    if (asset.external_source === "immich") {
        return `${API_BASE_URL}/immich/assets/${asset.external_asset_id}/original`;
    }
    return api.assetFileUrl(asset.id);
}

function getThumbUrl(asset) {
    if (asset.external_source === "immich") {
        return `${API_BASE_URL}/immich/assets/${asset.external_asset_id}/thumbnail`;
    }
    return api.assetFileUrl(asset.id);
}
```

**Step 2: Build and commit**

```bash
cd frontend && npm run build
git add frontend/src/components/ImageViewer.jsx
git commit -m "immich handle external immich assets in ImageViewer"
```

---

### Task 10: CSS for ImmichPicker

**Files:** `frontend/src/styles/app.css`

Add styles for:
- `.immich-picker-backdrop` — fixed full-canvas dark overlay
- `.immich-picker-panel` — centered white panel, max-width 1000px
- `.tag-grid` — flex wrap toggle chips
- `.thumb-grid` — CSS grid, auto-fill, scrollable
- `.thumb-item` — relative, hover border, selected checkmark overlay
- `.bulk-actions` — flex row bar at top
- `.sticky-bar` — fixed bottom bar with confirm button
- `.immich-btn` — small outlined button next to file input

**Step 2: Build, release check, commit**

```bash
cd frontend && npm run build
./scripts/release_check.sh
git add frontend/src/styles/app.css
git commit -m "immich add CSS for ImmichPicker component"
```

---

### Task 11: Final validation

```bash
./scripts/release_check.sh
git log --oneline -12
git push
```
