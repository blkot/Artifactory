# Kit UX Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix NewKitPage UX (datalist fields, tag creation, image management, post-create navigation), add image viewer component, clean up cover image section.

**Tech Stack:** React 19, FastAPI backend (no backend changes)

---

### Task 1: Datalist comboboxes for Series/Brand/Scale in NewKitPage

**Files:** `frontend/src/pages/NewKitPage.jsx`

Change Series, Brand, Scale from `<input>` to `<input list="options">` with `<datalist>`. Options loaded from:
- All existing kit values for that field (from the `facetOptions`-like data)
- Server filter dictionary values

Since NewKitPage doesn't currently receive facet options, we have two choices:
1. Pass them as props from App.jsx (like KitsPage receives)
2. Fetch them in the component via API

Simpler: pass `facetOptions` and `serverFilterValues` as props from App, same pattern as KitsPage.

Actual change: `<input list="brands" />` with `<datalist id="brands">` populated from merged facet options. Accepts free-text input by default.

### Task 2: Tag creation in NewKitPage

**Files:** `frontend/src/pages/NewKitPage.jsx`

Add "Create + Assign" tag flow matching KitWorkspacePage's tag picker:
- Show existing tags as toggle chips
- Button "+ Create tag" opens inline form: name input + color picker + "Create & Assign" button
- Calls `api.createTag()` then adds the new tag ID to `form.tag_ids`

### Task 3: Image preview with remove + upload status

**Files:** `frontend/src/pages/NewKitPage.jsx`, `frontend/src/styles/app.css`

Each image section gets a unified preview widget:
- After file selection: preview thumbnails with × remove button
- After submit: each image shows status (spinner "Uploading..." → "✓" or "✗")
- Upload status tracked per-file: `{ file, status: "pending" | "uploading" | "done" | "error" }`

Replace `sectionFiles` (File[]) with `sectionItems` ({ file, status, id }[]).
On submit: create kit, then upload each file sequentially updating its status.

### Task 4: Image gallery grouped by type in KitWorkspacePage

**Files:** `frontend/src/pages/KitWorkspacePage.jsx`, new `frontend/src/components/ImageViewer.jsx`, `frontend/src/styles/app.css`

**Gallery:** The Overview tab gallery already shows all image assets. Group them by type with section headers (Box Art, Manual, Build Photos, Reference Images).

**ImageViewer component:**
- Full-canvas overlay: dark backdrop, centered image, fixed position `inset: 0`
- Bottom thumbnail strip: all image assets in order, highlights current
- Prev/Next arrows on left/right sides
- Toolbar: "Set as Cover" button (calls `onSetThumbnailAsset`)
- Keyboard: Left/Right arrows for prev/next, Escape to close
- Click outside image (on backdrop) closes viewer
- Loops: after last image → first image

State: `{ open: boolean, currentIndex: number }`. Props: `images` (all image assets), `currentCoverId`, `onSetCover`.

### Task 5: Remove Cover Image section buttons

**Files:** `frontend/src/pages/KitWorkspacePage.jsx`

In the overview tab, remove the "Set Selected as Cover" / "Use Placeholder" buttons and the cover candidate selection logic (`selectedCoverCandidateId` state and related UI). Keep only the cover image display (shows current cover). Cover is set exclusively from the image viewer now.

### Task 6: Navigate to kit workspace after creation

**Files:** `frontend/src/pages/NewKitPage.jsx`, `frontend/src/App.jsx`

After successful creation + uploads, call `onCreate(createdKit)` which should navigate to `/kits/{createdKit.id}`. Update `handleCreateKit` in App.jsx to accept the created kit and navigate.

---

### Task 7: Final validation

Build, release check, push.
