# Gap A: Thumbnail Source Server-Persisted — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `kits.thumbnail_asset_id` FK so kit cover/thumbnail selection persists server-side across devices.

**Architecture:** New nullable FK column on `kits` table referencing `assets.id`. API schemas expose the field for read/write. Frontend uses API as source of truth with localStorage as transient fallback.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, Alembic, React

---

### Task 1: Add thumbnail_asset_id to Kit model and schema

**Files:**
- Modify: `backend/app/models/kit.py`
- Modify: `backend/app/schemas/kit.py`
- Modify: `backend/app/crud/kit.py`

**Step 1: Read the files**

Read `backend/app/models/kit.py`, `backend/app/schemas/kit.py`, and `backend/app/crud/kit.py`.

**Step 2: Add column to Kit model**

In `backend/app/models/kit.py`, add the import:
```python
from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String
```

Add the column in the Kit class (after `build_status`):
```python
thumbnail_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
```

**Step 3: Add field to schemas**

In `backend/app/schemas/kit.py`:

`KitBase`: add after `tag_ids`:
```python
thumbnail_asset_id: int | None = None
```

`KitUpdate`: add after `tag_ids`:
```python
thumbnail_asset_id: int | None = None
```

`KitRead`: add after `tags`:
```python
thumbnail_asset_id: int | None = None
```

**Step 4: Update CRUD create_kit**

In `backend/app/crud/kit.py`, change the `create_kit` function to include `thumbnail_asset_id` in the excluded set:

Change `exclude={"tag_ids"}` to `exclude={"tag_ids"}` — actually `thumbnail_asset_id` is already a valid column name matching the model, so `model_dump(exclude={"tag_ids"})` will already include it. No change needed to CRUD.

But verify: since `thumbnail_asset_id` is now in `KitBase`, `model_dump(exclude={"tag_ids"})` will include it. The `Kit` constructor expects keyword args matching column names. `thumbnail_asset_id` matches the column name. So no CRUD change needed.

However, `update_kit` uses `model_dump(exclude_unset=True, exclude={"tag_ids"})` which means if `thumbnail_asset_id` is not set (None), it won't be in the dump. If the user explicitly sets it to `None`, it will be included and update the column. This is correct behavior — no change needed.

**Step 5: Run existing tests**

```bash
cd backend && uv run --extra dev pytest -v
```
Expected: All 37 tests pass (no regression).

**Step 6: Commit**

```bash
git add backend/app/models/kit.py backend/app/schemas/kit.py
git commit -m "gap A add thumbnail_asset_id FK to Kit model and schemas"
```

---

### Task 2: Generate Alembic migration

**Files:**
- Create: `backend/alembic/versions/*_add_thumbnail_asset_id.py` (auto-generated)

**Step 1: Generate migration**

```bash
cd backend && uv run alembic revision --autogenerate -m "add thumbnail_asset_id to kits"
```

**Step 2: Verify the generated migration**

Read the generated file. It should add the `thumbnail_asset_id` column with `ForeignKey("assets.id")`.

**Step 3: Verify migration cycle**

```bash
cd backend && uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head
```
Expected: No errors.

**Step 4: Run tests**

```bash
cd backend && uv run --extra dev pytest -v
```
Expected: All 37 tests pass.

**Step 5: Commit**

```bash
git add backend/alembic/versions/* thumbnail_asset_id*
git commit -m "gap A alembic migration for thumbnail_asset_id column"
```

---

### Task 3: Write tests for thumbnail_asset_id

**Files:**
- Modify: `backend/tests/test_kits.py`

**Step 1: Read existing test_kits.py**

Understand the existing test patterns.

**Step 2: Add tests**

Add these test functions:

```python
def test_create_kit_with_thumbnail_asset_id(client, auth_headers) -> None:
    """Creating a kit accepts thumbnail_asset_id."""
    payload = {
        "name": "Thumb Test",
        "grade": "HG",
        "series": "Test Series",
        "brand": "Bandai",
        "scale": "1/144",
        "thumbnail_asset_id": None,
    }
    response = client.post("/api/v1/kits", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["thumbnail_asset_id"] is None


def test_update_kit_thumbnail_asset_id(client, auth_headers) -> None:
    """Updating a kit with thumbnail_asset_id persists the value."""
    create_resp = client.post("/api/v1/kits", json={
        "name": "Thumb Update Test",
        "grade": "MG",
        "series": "Test Series",
        "brand": "Bandai",
        "scale": "1/100",
    }, headers=auth_headers)
    kit_id = create_resp.json()["id"]

    # Set thumbnail_asset_id to a value (in practice this would be a valid asset id,
    # but the FK constraint won't be enforced in SQLite by default unless PRAGMA foreign_keys=ON).
    update_resp = client.put(f"/api/v1/kits/{kit_id}", json={
        "thumbnail_asset_id": 999,
    }, headers=auth_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["thumbnail_asset_id"] == 999

    # Set it back to None
    update_resp2 = client.put(f"/api/v1/kits/{kit_id}", json={
        "thumbnail_asset_id": None,
    }, headers=auth_headers)
    assert update_resp2.status_code == 200
    assert update_resp2.json()["thumbnail_asset_id"] is None


def test_kit_read_includes_thumbnail_asset_id(client, auth_headers) -> None:
    """Kit read responses include the thumbnail_asset_id field."""
    create_resp = client.post("/api/v1/kits", json={
        "name": "Thumb Read Test",
        "grade": "RG",
        "series": "Test Series",
        "brand": "Bandai",
        "scale": "1/144",
    }, headers=auth_headers)
    kit_id = create_resp.json()["id"]

    resp = client.get(f"/api/v1/kits/{kit_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "thumbnail_asset_id" in data
    assert data["thumbnail_asset_id"] is None
```

**Step 3: Run the new tests**

```bash
cd backend && uv run --extra dev pytest tests/test_kits.py -v
```
Expected: New tests PASS along with existing kit tests.

**Step 4: Run full test suite**

```bash
cd backend && uv run --extra dev pytest -v
```
Expected: 40 tests PASS (37 + 3 new).

**Step 5: Commit**

```bash
git add backend/tests/test_kits.py
git commit -m "gap A add thumbnail_asset_id API tests"
```

---

### Task 4: Update frontend to use API as thumbnail authority

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Read `frontend/src/App.jsx`**

Focus on:
- `setKitThumbnailSource` function (around line 1591-1600)
- `loadKitPreviews` effect (around line 1461-1495)
- The `preferredThumbnailAssetMap` state

**Step 2: Update `setKitThumbnailSource` to call the API**

Replace the existing function. The function currently only updates localStorage state. Now it should also call `PUT /kits/{kit_id}`:

```javascript
async function setKitThumbnailSource(kitId, assetId) {
    try {
        await api.updateKit(kitId, { thumbnail_asset_id: assetId || null });
    } catch (_) {
        // Proceed even if API call fails — localStorage is the fallback.
    }
    setPreferredThumbnailAssetMap((prev) => {
        const next = { ...prev };
        if (assetId === null || assetId === undefined) {
            delete next[String(kitId)];
        } else {
            next[String(kitId)] = assetId;
        }
        return next;
    });
}
```

**Step 3: Update `loadKitPreviews` to prefer API field**

In the `loadKitPreviews` effect, the thumbnail resolution logic currently only checks `preferredThumbnailAssetMap`. Update it to check `kit.thumbnail_asset_id` first:

Find the line:
```javascript
const preferredId = preferredThumbnailAssetMap[String(kit.id)];
```

Change to:
```javascript
const preferredId = kit.thumbnail_asset_id || preferredThumbnailAssetMap[String(kit.id)];
```

**Step 4: Update `handleKitMutation` to refresh kit data from API**

After a kit mutation (update), the `handleKitMutation` function already reloads kits. The `preferredThumbnailAssetMap` should also sync from the API response. In the `loadKitPreviews` function, after resolving, if `kit.thumbnail_asset_id` is set, also update the local map:

After the image resolution block in `loadKitPreviews`, add:
```javascript
if (kit.thumbnail_asset_id && preferredThumbnailAssetMap[String(kit.id)] !== kit.thumbnail_asset_id) {
    preferredThumbnailAssetMap[String(kit.id)] = kit.thumbnail_asset_id;
}
```

Wait — this would cause a state update inside a passive effect. Instead, simply rely on the read path (Step 3) to always prefer the API value. The localStorage map stays as a fallback cache, always overridden by the API field.

So actually, Step 3 alone is sufficient for the read path. No additional sync needed.

**Step 5: Build frontend**

```bash
cd frontend && npm run build
```
Expected: Build succeeds.

**Step 6: Run release check**

```bash
cd /Users/wangshenhao/Desktop/Projects/Python/Artifactory && ./scripts/release_check.sh
```
Expected: All checks pass.

**Step 7: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "gap A frontend uses API thumbnail_asset_id as authority"
```

---

### Task 5: Final validation

**Step 1: Run release check**

```bash
./scripts/release_check.sh
```
Expected: Backend 40 tests PASS, frontend build OK, alembic cycle OK.

**Step 2: Verify git status**

```bash
git status
git log --oneline -5
```
