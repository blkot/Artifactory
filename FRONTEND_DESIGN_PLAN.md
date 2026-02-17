# Frontend Design Plan (Phase A Delivery)

## Goals
- Replace the single-page utility UI with a modern product shell.
- Split workflows by route so each domain has focus: dashboard, kits, kit workspace, tags, settings.
- Keep existing backend API compatibility and current CRUD features.

## UX Direction
- Primary layout: persistent sidebar navigation + top action bar.
- Visual style: soft editorial cards, strong typography, warm-neutral gradients, clear hierarchy.
- Mobile behavior: sidebar collapses into stacked nav chips and single-column content.
- Accessibility baseline: visible focus states, semantic headings, readable contrast, button labels.

## Information Architecture
- `/login`: authentication
- `/dashboard`: summary cards + recent kits + quick actions
- `/kits`: searchable/filterable/paginated inventory
- `/kits/new`: dedicated kit creation form
- `/kits/:kitId`: kit workspace with tabs:
  - `overview`
  - `assets`
  - `links`
  - `timeline`
- `/tags`: tag management
- `/settings`: API/auth session info

## React Architecture
- Router: `react-router-dom` for route-first UI structure.
- App shell components:
  - `AuthGate`
  - `AppLayout` (sidebar + content frame)
  - page-level components by route
- Data strategy:
  - parallel bootstrap fetches where independent (`Promise.all`)
  - route-local loading for assets/links/timeline on kit workspace
  - keep API client as single integration layer

## Performance/Implementation Notes
- Avoid data waterfalls by parallelizing independent startup fetches.
- Keep route components focused and avoid large derived computations on every render.
- Reuse existing API endpoints; do not expand backend scope for this phase.

## Delivered Scope In This Implementation
- Added route-based app shell and navigation.
- Added dashboard page with key metrics and recent kits.
- Added kits list page with existing search filters + pagination.
- Added dedicated kit creation route.
- Added kit workspace route with overview/assets/links/timeline tabs.
- Added tags management route.
- Added settings route for auth/session/API base visibility.
- Replaced old flat single-page structure with modern responsive styles.

## Thumbnail Source Design Proposal
- Current implementation (Phase 6.5):
  - frontend can set per-kit thumbnail source from kit image gallery
  - preference stored in browser local storage (fast, no migration required)
- Recommended persistent design (next backend phase):
  - add nullable `kits.thumbnail_asset_id` foreign key -> `assets.id`
  - enforce that referenced asset belongs to the same kit and is image mime
  - expose in API:
    - `PUT /kits/{kit_id}` accepts `thumbnail_asset_id`
    - `GET /kits` and `GET /kits/{kit_id}` return `thumbnail_asset_id`
  - frontend reads this as single source of truth, with local fallback only if unset
