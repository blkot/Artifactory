# Gaps B, C, D: Combined Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add server-side links filtering, thumbnail URL endpoint, and server-persisted filter dictionaries.

**Architecture:** Three independent backend features. Gap B adds a query param. Gap C adds a file-serving endpoint and schema field. Gap D adds a new model with CRUD endpoints.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, Alembic, React

---

### Task 1: Gap B — Add kit_id filter to GET /links

**Files:**
- Modify: `backend/app/crud/link.py`
- Modify: `backend/app/api/v1/endpoints/links.py`
- Modify: `frontend/src/App.jsx`

**Step 1: Update CRUD**

In `backend/app/crud/link.py`, change `list_links`:

```python
def list_links(db: Session, kit_id: int | None = None) -> list[Link]:
    query = db.query(Link)
    if kit_id is not None:
        query = query.filter(Link.kit_id == kit_id)
    return query.order_by(Link.created_at.desc()).all()
```

**Step 2: Update endpoint**

In `backend/app/api/v1/endpoints/links.py`, change `get_links`:

```python
def get_links(
    kit_id: int | None = None,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
) -> list[LinkRead]:
    return list_links(db, kit_id=kit_id)
```

**Step 3: Update frontend**

In `frontend/src/App.jsx`, in the KitWorkspacePage component, find where links are loaded (around line 581-591). Change `api.getLinks()` to accept kit_id:

```javascript
api.getLinks(Number(kitId)),
```

In `client.js`, update `getLinks` to accept optional kit_id:

```javascript
getLinks: (kitId = null) => {
    const params = new URLSearchParams();
    if (kitId !== null) {
        params.set("kit_id", String(kitId));
        return request(`/links?${params.toString()}`);
    }
    return request("/links");
},
```

Also remove the client-side filter in App.jsx: the line `.filter((link) => link.kit_id === Number(kitId))` is no longer needed since the server now filters.

**Step 4: Run release check**

```bash
./scripts/release_check.sh
```

**Step 5: Commit**

Commit with: "gap B add kit_id filter to links endpoint and frontend"

---

### Task 2: Gap C — Thumbnail endpoint and schema

**Files:**
- Modify: `backend/app/api/v1/endpoints/assets.py`
- Modify: `backend/app/schemas/asset.py`

**Step 1: Add thumbnail endpoint to assets.py**

```python
@router.get(
    "/{asset_id}/thumbnail",
    summary="Download thumbnail",
    description="Download or stream the thumbnail file if available.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Asset or thumbnail not found"}},
)
def get_asset_thumbnail(
    asset_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
):
    asset = get_asset(db, asset_id)
    if not asset or not asset.thumbnail_path:
        raise AssetNotFoundException(asset_id)

    path = Path(asset.thumbnail_path)
    if not path.exists():
        raise AssetNotFoundException(asset_id)
    return FileResponse(path=path)
```

**Step 2: Add thumbnail_url to AssetRead**

In `backend/app/schemas/asset.py`, add after `thumbnail_path`:

```python
@computed_field
@property
def thumbnail_url(self) -> str | None:
    if self.thumbnail_path:
        return f"/api/v1/assets/{self.id}/thumbnail"
    return None
```

Note: Since `AssetRead` uses `from_attributes=True`, and `thumbnail_url` is a computed field (not from DB), we need to use Pydantic's `@computed_field`. Or, since this needs the asset ID, we can use a Pydantic computed field.

Actually, a simpler approach — `computed_field` requires `model_config` from Pydantic v2. Let's use this:

```python
from pydantic import computed_field

class AssetRead(BaseModel):
    ...existing fields...
    
    @computed_field
    @property
    def thumbnail_url(self) -> str | None:
        if self.thumbnail_path:
            return f"/api/v1/assets/{self.id}/thumbnail"
        return None
```

**Step 3: Run release check**

```bash
./scripts/release_check.sh
```

**Step 4: Commit**

Commit with: "gap C add thumbnail endpoint and thumbnail_url to asset schema"

---

### Task 3: Gap D — Filter dictionary model

**Files:**
- Create: `backend/app/models/filter_value.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/*_add_filter_values.py` (auto-generated)

**Step 1: Create model**

```python
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from app.db import Base


class FilterValue(Base):
    __tablename__ = "filter_values"

    id = Column(Integer, primary_key=True, index=True)
    field = Column(String(50), nullable=False, index=True)
    value = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("field", "value", name="uq_filter_value_field_value"),
    )
```

**Step 2: Register model in `__init__.py`**

Add import and `"FilterValue"` to `__all__`.

**Step 3: Generate migration**

```bash
cd backend && uv run alembic revision --autogenerate -m "add filter_values table"
```

**Step 4: Verify migration cycle and run tests**

**Step 5: Commit**

Commit with: "gap D add FilterValue model and migration"

---

### Task 4: Gap D — Filter dictionary endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/filters.py`
- Modify: `backend/app/api/v1/api.py` (register router)

**Step 1: Create endpoints**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_read_access, require_write_access
from app.db import get_db
from app.models.filter_value import FilterValue

router = APIRouter(prefix="/filters", tags=["filters"])


@router.get(
    "/{field}",
    summary="List filter values",
    description="Return all custom filter values for a given field (brand/series/scale).",
)
def get_filter_values(
    field: str,
    db: Session = Depends(get_db),
    _auth=Depends(require_read_access),
) -> list[dict]:
    if field not in ("brand", "series", "scale"):
        raise HTTPException(status_code=404, detail="Unknown filter field")
    values = (
        db.query(FilterValue)
        .filter(FilterValue.field == field)
        .order_by(FilterValue.value)
        .all()
    )
    return [{"id": v.id, "value": v.value} for v in values]


@router.post(
    "/{field}",
    status_code=status.HTTP_201_CREATED,
    summary="Create filter value",
    description="Add a new custom filter value for a field.",
)
def create_filter_value(
    field: str,
    body: dict,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> dict:
    if field not in ("brand", "series", "scale"):
        raise HTTPException(status_code=404, detail="Unknown filter field")
    value = str(body.get("value", "")).strip()
    if not value:
        raise HTTPException(status_code=400, detail="Value is required")

    existing = (
        db.query(FilterValue)
        .filter(FilterValue.field == field, FilterValue.value == value)
        .first()
    )
    if existing:
        return {"id": existing.id, "value": existing.value}

    fv = FilterValue(field=field, value=value)
    db.add(fv)
    db.commit()
    db.refresh(fv)
    return {"id": fv.id, "value": fv.value}


@router.delete(
    "/{field}/{value}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete filter value",
)
def delete_filter_value(
    field: str,
    value: str,
    db: Session = Depends(get_db),
    _auth=Depends(require_write_access),
) -> None:
    fv = (
        db.query(FilterValue)
        .filter(FilterValue.field == field, FilterValue.value == value)
        .first()
    )
    if not fv:
        raise HTTPException(status_code=404, detail="Filter value not found")
    db.delete(fv)
    db.commit()
```

**Step 2: Register router**

In `backend/app/api/v1/api.py`:
```python
from app.api.v1.endpoints import assets, auth, filters, kits, links, stats, tags

api_router.include_router(filters.router)
```

**Step 3: Run release check and commit**

---

### Task 5: Gap D — Frontend integration

**Files:**
- Modify: `frontend/src/api/client.js` (add filter value API methods)
- Modify: `frontend/src/App.jsx` (update FilterManagementPage)

**Step 1: Add API methods**

In `client.js`, add to the `api` object:

```javascript
getFilterValues: (field) => request(`/filters/${field}`),
createFilterValue: (field, value) => request(`/filters/${field}`, {
    method: "POST",
    body: JSON.stringify({ value }),
}),
deleteFilterValue: (field, value) => request(`/filters/${field}/${encodeURIComponent(value)}`, {
    method: "DELETE",
}),
```

**Step 2: Update FilterManagementPage**

In `App.jsx`, the `FilterManagementPage` component:

- Add state for server-loaded filter values: `const [serverFacetValues, setServerFacetValues] = useState({ brand: [], series: [], scale: [] })`
- Load on mount: call `api.getFilterValues(field)` when field changes
- Replace localStorage reads/writes for `customFacetValues` with API calls
- `onCreateCustomFacetValue` calls `api.createFilterValue` instead of updating localStorage
- `onRenameCustomFacetValue` calls the existing kit update + `api.createFilterValue` for the new name
- Remove `CUSTOM_FACET_STORAGE_KEY` localStorage persistence (or keep as fallback)

**Step 3: Build and run release check**

---

### Task 6: Final validation

Run `./scripts/release_check.sh` — all must pass.
