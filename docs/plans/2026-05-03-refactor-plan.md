# Refactor: Component Split + Schema Hygiene + Kit UX — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split monolithic App.jsx into modules, add proper schemas for filter endpoints, and redesign the kit creation/assets UX with sectioned image uploads.

**Architecture:** Pure file extraction (Part 1), Pydantic schema replacement (Part 2), and form/asset UX redesign (Part 3). Parts 1 and 2 are fully independent and can run in parallel. Part 3 depends on Part 1 (needs the extracted files).

**Tech Stack:** React 19, FastAPI, Pydantic v2

---

### Task 1: Extract constants and utils

**Files:**
- Create: `frontend/src/constants.js`
- Create: `frontend/src/utils.js`
- Modify: `frontend/src/App.jsx`

**Step 1: Extract constants.js**

Read App.jsx. Move these to `frontend/src/constants.js`:

```javascript
export const GRADES = ["HG", "RG", "MG", "PG", "SD", "CUSTOM"];
export const BUILD_STATUS = ["NEW", "OPENED", "IN_PROGRESS", "COMPLETED"];
export const LINK_CATEGORIES = ["BUILD_LOG", "REVIEW", "TUTORIAL", "GALLERY"];
export const ASSET_TYPES = ["BOX_ART", "MANUAL", "BUILD_PHOTO", "REFERENCE_IMAGE", "VIDEO", "DOCUMENT"];
export const PAGE_SIZE = 10;
export const THUMBNAIL_PREF_STORAGE_KEY = "artifactory_kit_thumbnail_asset_map";
export const CUSTOM_FACET_STORAGE_KEY = "artifactory_custom_facet_values";

export const EMPTY_KIT_FILTERS = {
    q: "",
    grade: [],
    brand: [],
    series: [],
    build_status: [],
    scale: [],
    tag: [],
};

export const EMPTY_KIT_FORM = {
    name: "",
    grade: "HG",
    series: "",
    brand: "Bandai",
    scale: "1/144",
    kit_number: "",
    purchase_date: "",
    purchase_price: "",
    purchase_shop: "",
    build_status: "NEW",
    tag_ids: [],
};
```

**Step 2: Extract utils.js**

Move these functions:

```javascript
export function caseFold(value) {
    return String(value || "").trim().toLowerCase();
}

export function buildCaseInsensitiveFacetOptions(rows, customValues = {}) {
    // ... full function from App.jsx lines 50-76
}

export function buildKitEditForm(kit) {
    // ... full function from App.jsx lines 78-91
}

export function toUserMessage(err) {
    // ... full function from App.jsx lines 93-100
}
```

**Step 3: Update App.jsx**

Replace the extracted code with:
```javascript
import { GRADES, BUILD_STATUS, LINK_CATEGORIES, ASSET_TYPES, PAGE_SIZE, THUMBNAIL_PREF_STORAGE_KEY, CUSTOM_FACET_STORAGE_KEY, EMPTY_KIT_FILTERS, EMPTY_KIT_FORM } from "./constants";
import { caseFold, buildCaseInsensitiveFacetOptions, buildKitEditForm, toUserMessage } from "./utils";
```

**Step 4: Build and verify**

```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add frontend/src/constants.js frontend/src/utils.js frontend/src/App.jsx
git commit -m "refactor extract constants and utils from App.jsx"
```

---

### Task 2: Extract Sidebar and AppHeader components

**Files:**
- Create: `frontend/src/components/Sidebar.jsx`
- Create: `frontend/src/components/AppHeader.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Extract Sidebar.jsx**

```javascript
import { NavLink } from "react-router-dom";

export default function Sidebar({ token, onLogout }) {
    const items = [
        { to: "/dashboard", label: "Dashboard", short: "DB" },
        { to: "/kits", label: "Kits", short: "KT" },
        ...(token ? [{ to: "/settings/filters", label: "Filters", short: "FL" }] : []),
        { to: "/settings", label: "Settings", short: "ST" },
    ];

    return (
        <aside className="sidebar">
            {/* ... full JSX from App.jsx Sidebar function ... */}
        </aside>
    );
}
```

**Step 2: Extract AppHeader.jsx**

```javascript
export default function AppHeader({ title, subtitle, error }) {
    return (
        <header className="app-header">
            <div className="app-header-copy">
                <h1>{title}</h1>
                <p className="app-subtitle">{subtitle}</p>
            </div>
            {error ? <p className="error-banner">{error}</p> : null}
        </header>
    );
}
```

**Step 3: Update App.jsx**

Replace the extracted functions with:
```javascript
import Sidebar from "./components/Sidebar";
import AppHeader from "./components/AppHeader";
```

**Step 4: Build and commit**

```bash
cd frontend && npm run build
git add frontend/src/components/ frontend/src/App.jsx
git commit -m "refactor extract Sidebar and AppHeader components"
```

---

### Task 3: Extract page components (Dashboard, Kits, Login, Settings)

**Files:**
- Create: `frontend/src/pages/DashboardPage.jsx`
- Create: `frontend/src/pages/KitsPage.jsx`
- Create: `frontend/src/pages/LoginPage.jsx`
- Create: `frontend/src/pages/SettingsPage.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Extract each page**

Each page file exports its component as default. Imports needed at the top of each file:
- `import { NavLink, useNavigate, useParams } from "react-router-dom"` (as needed)
- `import { api } from "../api/client"` (as needed)
- `import { GRADES, BUILD_STATUS, ... } from "../constants"` (as needed)
- `import { caseFold, toUserMessage, ... } from "../utils"` (as needed)
- `import AppHeader from "../components/AppHeader"` (as needed)

**DashboardPage.jsx** — takes `kits`, `kitPreviewMap`, `stats` as props
**KitsPage.jsx** — takes `kits`, `kitPreviewMap`, `tags`, `facetOptions`, `total`, `filters`, `onFilterChange`, `onToggleFilterValue`, `onClearFilters`, `onLoadMore`, `hasMore`, `loadingMore` as props
**LoginPage.jsx** — takes `onLogin`, `error` as props
**SettingsPage.jsx** — takes `token` as props

**Step 2: Update App.jsx imports**

```javascript
import DashboardPage from "./pages/DashboardPage";
import KitsPage from "./pages/KitsPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
```

**Step 3: Build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/ frontend/src/App.jsx
git commit -m "refactor extract Dashboard, Kits, Login, Settings pages"
```

---

### Task 4: Extract KitWorkspacePage and NewKitPage

**Files:**
- Create: `frontend/src/pages/NewKitPage.jsx`
- Create: `frontend/src/pages/KitWorkspacePage.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Extract NewKitPage.jsx**

Takes `tags`, `onCreate` as props. Same pattern as Task 3.

**Step 2: Extract KitWorkspacePage.jsx**

Takes `token`, `allTags`, `thumbnailAssetMap`, `onSetThumbnailAsset`, `onKitMutated`, `onKitDeleted` as props.

**Step 3: Build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/ frontend/src/App.jsx
git commit -m "refactor extract NewKitPage and KitWorkspacePage"
```

---

### Task 5: Extract FilterManagementPage and finalize App.jsx

**Files:**
- Create: `frontend/src/pages/FilterManagementPage.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Extract FilterManagementPage.jsx**

Takes `token`, `customFacetValues`, `onCreateCustomFacetValue`, `onRenameCustomFacetValue` as props.

**Step 2: Verify final App.jsx**

App.jsx should now be the routing shell + global state + handler functions. Verify it exports `App` as default.

**Step 3: Build, release check, commit**

```bash
cd frontend && npm run build
./scripts/release_check.sh
git add frontend/src/pages/FilterManagementPage.jsx frontend/src/App.jsx
git commit -m "refactor extract FilterManagementPage and finalize App.jsx shell"
```

---

### Task 6: Add FilterValue schemas (Part 2)

**Files:**
- Create: `backend/app/schemas/filter_value.py`
- Modify: `backend/app/api/v1/endpoints/filters.py`

**Step 1: Create schemas**

```python
from pydantic import BaseModel, ConfigDict


class FilterValueCreate(BaseModel):
    value: str

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"value": "Bandai"}]}
    )


class FilterValueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    value: str
```

**Step 2: Update filters.py**

Replace raw `dict` returns with Pydantic models. The `GET /{field}` endpoint returns `list[FilterValueRead]`. The `POST /{field}` endpoint returns `FilterValueRead` and accepts `FilterValueCreate` as body.

**Step 3: Run tests and commit**

```bash
cd backend && uv run --extra dev pytest -v
./scripts/release_check.sh
git add backend/app/schemas/filter_value.py backend/app/api/v1/endpoints/filters.py
git commit -m "refactor add FilterValue schemas and update endpoints"
```

---

### Task 7: Redesign NewKitPage with sectioned form (Part 3)

**Files:**
- Modify: `frontend/src/pages/NewKitPage.jsx`
- Modify: `frontend/src/styles/app.css`

**Step 1: Rewrite NewKitPage**

The new component:
- **Required section**: Name, Grade, Series, Brand, Scale — each with label and asterisk
- **Optional section**: collapsible, contains Kit Number, Purchase Date, Price, Shop, Build Status, Tags
- **Media sections**: 4 file picker areas — Box Art, Manual, Build Photos, Reference Images. Each has a file input + shows selected file count + preview thumbnails
- On submit: create kit first, then upload all selected images in parallel, each tagged with its section's asset type

```javascript
import { useState } from "react";
import { GRADES, BUILD_STATUS, EMPTY_KIT_FORM } from "../constants";
import AppHeader from "../components/AppHeader";
import { api } from "../api/client";

const IMAGE_SECTIONS = [
    { key: "boxArt", label: "Box Art", type: "BOX_ART", multiple: true },
    { key: "manual", label: "Manual", type: "MANUAL", multiple: true },
    { key: "buildPhotos", label: "Build Photos", type: "BUILD_PHOTO", multiple: true },
    { key: "referenceImages", label: "Reference Images", type: "REFERENCE_IMAGE", multiple: true },
];

export default function NewKitPage({ tags, onCreate }) {
    const [form, setForm] = useState(EMPTY_KIT_FORM);
    const [showOptional, setShowOptional] = useState(false);
    // One Files array per section
    const [sectionFiles, setSectionFiles] = useState({
        boxArt: [],
        manual: [],
        buildPhotos: [],
        referenceImages: [],
    });

    function updateSectionFiles(key, fileList) {
        setSectionFiles((prev) => ({ ...prev, [key]: Array.from(fileList) }));
    }

    function toggleTag(id) { /* same as before */ }

    async function handleSubmit(event) {
        event.preventDefault();
        // Build kit payload
        const kitPayload = {
            ...form,
            purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
            purchase_date: form.purchase_date || null,
        };
        const createdKit = await api.createKit(kitPayload);

        // Upload all selected images in parallel
        const uploads = [];
        for (const section of IMAGE_SECTIONS) {
            for (const file of sectionFiles[section.key]) {
                const formData = new FormData();
                formData.set("kit_id", String(createdKit.id));
                formData.set("type", section.type);
                formData.set("description", section.label);
                formData.set("file", file);
                uploads.push(api.uploadAsset(formData));
            }
        }
        await Promise.all(uploads);

        // Reset and notify parent
        setForm(EMPTY_KIT_FORM);
        setSectionFiles({ boxArt: [], manual: [], buildPhotos: [], referenceImages: [] });
        setShowOptional(false);
        if (onCreate) await onCreate(createdKit);
    }

    return (
        <section className="page">
            <AppHeader title="Create Kit" subtitle="Add a new kit to your collection." />

            <form className="kit-form" onSubmit={handleSubmit}>
                {/* Required section */}
                <fieldset className="form-section">
                    <legend>Required Fields</legend>
                    <div className="form-row">
                        <label>Name *</label>
                        <input required value={form.name} onChange={...} />
                    </div>
                    <div className="form-row">
                        <label>Grade *</label>
                        <select value={form.grade} onChange={...}>
                            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    {/* Series, Brand, Scale similarly */}
                </fieldset>

                {/* Optional section - collapsible */}
                <fieldset className="form-section">
                    <legend>
                        <button type="button" onClick={() => setShowOptional(!showOptional)}>
                            {showOptional ? "▾" : "▸"} Optional Details
                        </button>
                    </legend>
                    {showOptional ? (
                        <>
                            <div className="form-row">
                                <label>Kit Number</label>
                                <input value={form.kit_number} onChange={...} />
                            </div>
                            {/* ... price, date, shop, status, tags ... */}
                        </>
                    ) : null}
                </fieldset>

                {/* Media sections */}
                {IMAGE_SECTIONS.map((section) => (
                    <fieldset key={section.key} className="form-section">
                        <legend>{section.label}</legend>
                        <input
                            type="file"
                            accept="image/*"
                            multiple={section.multiple}
                            onChange={(e) => updateSectionFiles(section.key, e.target.files)}
                        />
                        {sectionFiles[section.key].length > 0 ? (
                            <div className="file-preview-grid">
                                {sectionFiles[section.key].map((file, i) => (
                                    <div key={i} className="file-preview-item">
                                        <img src={URL.createObjectURL(file)} alt={file.name} />
                                        <span>{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <p className="muted">{sectionFiles[section.key].length} file(s) selected</p>
                    </fieldset>
                ))}

                <button type="submit" className="form-submit">Create Kit</button>
            </form>
        </section>
    );
}
```

**Step 2: Add CSS for the sectioned form**

Add to `app.css`:
```css
.kit-form {
  max-width: 680px;
  display: grid;
  gap: 1rem;
}

.form-section {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 1rem;
}

.form-section legend {
  font-weight: 700;
  font-size: 1rem;
}

.form-section legend button {
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.form-row {
  display: grid;
  gap: 0.35rem;
}

.form-row label {
  font-size: 0.85rem;
  color: var(--muted);
}

.file-preview-grid {
  margin-top: 0.6rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.file-preview-item {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #fff;
}

.file-preview-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.file-preview-item span {
  display: block;
  padding: 0.3rem 0.4rem;
  font-size: 0.72rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.form-submit {
  padding: 0.7rem 1.2rem;
  font-size: 1rem;
  font-weight: 600;
}
```

**Step 3: Build, release check, commit**

```bash
cd frontend && npm run build
./scripts/release_check.sh
git add frontend/src/pages/NewKitPage.jsx frontend/src/styles/app.css
git commit -m "refactor redesign NewKitPage with sectioned form and per-type image upload"
```

---

### Task 8: Update Assets tab in KitWorkspacePage

**Files:**
- Modify: `frontend/src/pages/KitWorkspacePage.jsx`
- Modify: `frontend/src/styles/app.css`

**Step 1: Redesign the Assets tab**

Replace the flat upload form + table layout with section-based view. Group existing assets by type into sections, each section shows its assets as a thumbnail grid with delete buttons.

Each section also has a compact "Add" file picker.

**Step 2: Build, release check, commit**

```bash
cd frontend && npm run build
./scripts/release_check.sh
git add frontend/src/pages/KitWorkspacePage.jsx frontend/src/styles/app.css
git commit -m "refactor redesign Assets tab with section-based layout"
```

---

### Task 9: Final validation

```bash
./scripts/release_check.sh
git log --oneline -10
git push
```
