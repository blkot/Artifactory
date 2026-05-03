# Refactor: Component Split + Schema Hygiene + Kit UX — Design

Date: 2026-05-03

## Part 1: Split App.jsx

Pure extraction — zero behavior changes.

```
frontend/src/
├── constants.js              # GRADES, BUILD_STATUS, LINK_CATEGORIES, ASSET_TYPES, PAGE_SIZE, storage keys
├── utils.js                  # caseFold, buildCaseInsensitiveFacetOptions, buildKitEditForm, toUserMessage
├── components/
│   ├── Sidebar.jsx
│   └── AppHeader.jsx
├── pages/
│   ├── DashboardPage.jsx
│   ├── KitsPage.jsx
│   ├── NewKitPage.jsx
│   ├── KitWorkspacePage.jsx
│   ├── SettingsPage.jsx
│   ├── FilterManagementPage.jsx
│   └── LoginPage.jsx
└── App.jsx                   # routing + global state + handle* functions (~100 lines)
```

Each page imports `api` and components directly. `App.jsx` passes global state as props (same pattern as now).

## Part 2: Backend Schema Hygiene

- Add `FilterValueRead` and `FilterValueCreate` Pydantic schemas
- `filters.py` endpoints return `FilterValueRead` instead of raw `dict`
- `FilterValueCreate` validates input before processing

## Part 3A: New Kit UX — Sectioned Form

Form organized in visual sections with clear headers:

**Required Fields** — Name, Grade, Series, Brand, Scale (all label + asterisk)

**Optional Details** — Kit Number, Purchase Date, Price, Shop, Build Status, Tags (collapsed by default, toggle to expand)

**Kit Media** — four upload sections, each with file picker + live preview of selected files:

| Section | Asset Type | Multiple | Preview |
|----------|-----------|----------|---------|
| Box Art | BOX_ART | Yes | Grid of selected images |
| Manual | MANUAL | Yes | Grid of selected images |
| Build Photos | BUILD_PHOTO | Yes | Grid of selected images |
| Reference Images | REFERENCE_IMAGE | Yes | Grid of selected images |

**Submit** — one button at bottom. On create, kit is saved first, then all selected images upload in parallel with their section's asset type.

## Part 3B: Assets Tab (Existing Kit)

Same section-based layout as creation, but shows existing assets in each section with ability to add more. Existing assets show thumbnail + filename + delete button.

## What does NOT change

- Kit filters on KitsPage (user confirmed they're good)
- Dashboard, Settings, Login pages
- Backend API endpoints (only schemas added, no endpoint changes)
- Color scheme / theme CSS variables
