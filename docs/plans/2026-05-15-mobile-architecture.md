# Artifactory Mobile — Architecture & Project Structure

Date: 2026-05-15

## Stack

- **Framework**: React Native 0.84+ (New Architecture)
- **Managed by**: Expo SDK 54+
- **Navigation**: Expo Router (file-based, like Next.js)
- **State**: React hooks only (same pattern as web — no Redux)
- **HTTP**: fetch (same API client patterns from web)
- **Secure Storage**: expo-secure-store (Keychain/Keystore for tokens)
- **Image Viewer**: react-native-reanimated + gesture-handler (or expo-image with zoom)
- **File Picker**: expo-image-picker
- **Bottom Sheet**: @gorhom/bottom-sheet (for ImmichPicker and tag pickers)
- **Builds**: EAS Build (Expo cloud, no local Xcode required)
- **Updates**: EAS Update (OTA, no App Store review for JS changes)

## Image Availability And Offline Cache Policy

Artifactory mobile must treat kit images as durable user data, not as disposable remote-only media. Users should be able to browse previously viewed kit images when the phone has no network, the Artifactory backend is offline, or an external source such as Immich is unreachable from the current network.

The image viewer should always attempt the highest quality source first and degrade gracefully:

1. Original file or original external source image.
2. App-local cached display copy, when available.
3. Backend-served preview or transformed copy, when available.
4. Backend or external-source thumbnail as the final remote fallback.
5. App-local cached thumbnail as the final offline fallback.

For local Artifactory uploads, the original file endpoint is the best-quality source and the backend thumbnail endpoint is only for grids, preview strips, and low-quality fallback. For Immich assets, the Immich original proxy is the best-quality source and the Immich preview thumbnail is a fallback.

The mobile app should maintain an app-local image cache with at least two tiers:

- Display cache: downscaled enough for smooth mobile viewing, but materially better than grid thumbnails.
- Thumbnail cache: small images for grids, preview strips, and offline placeholders.

Cache writes should be opportunistic: whenever the viewer successfully loads an original or high-quality preview, store a display-sized copy and a thumbnail-sized copy locally. Cache reads should be transparent to the UI: if remote loading fails, the same image slot falls back to cached copies without breaking swipe/zoom navigation. Cache storage should be bounded by size and age, with recently viewed kit images retained preferentially.

## Offline Asset Queue

Mobile asset capture is local-first. A photo taken with the camera or chosen from the library is copied into app document storage, converted into display and thumbnail derivatives, inserted into the local SQLite asset store, and shown in the kit immediately. Uploads are represented as SQLite jobs and may be queued, uploading, failed, or done. The app checks `/health/ready` on foreground/resume and kit detail entry, then uploads queued jobs one at a time only while the app is foreground and the backend is reachable.

iOS background execution is not assumed. If the app is minimized or killed during an upload, the next launch/resume resets stale uploading jobs back to queued and retries without deleting local files. Unsynced originals are kept indefinitely until the user removes the pending local asset or the upload succeeds. Synced assets keep display and thumbnail derivatives for offline viewing; remote-derived display caches are capped and evicted least-recently-used first.

The web frontend remains backend-first for this phase. It does not show mobile-only pending assets and does not maintain a browser upload queue. When the backend or an external image source is unavailable, web views should show explicit unavailable states and retryable placeholders instead of implying the asset exists locally.

## What Ports Directly from Web

```
web frontend/src/          →  mobile/
├── api/client.js          →  lib/api/client.ts      (nearly identical)
├── constants.js           →  lib/constants.ts       (identical)
├── utils.js               →  lib/utils.ts           (identical)
```

The API client's `request()`, `setAuthToken()`, `loadTokenFromStorage()`, and all `api.*` methods port with only one change: `window.localStorage` → `expo-secure-store`.

## Project Structure

```
mobile/
├── app/                        # Expo Router — file-based routing
│   ├── _layout.tsx             # Root layout (providers, auth gate)
│   ├── (auth)/                 # Auth group (no tab bar)
│   │   ├── login.tsx           # Login screen
│   │   └── _layout.tsx
│   ├── (tabs)/                 # Main app with tab bar
│   │   ├── _layout.tsx         # Tab bar configuration
│   │   ├── dashboard.tsx       # Dashboard (stats + recent kits)
│   │   ├── kits.tsx            # Kits list (search, filter, paginate)
│   │   └── settings.tsx        # Settings + filter management
│   ├── kits/
│   │   ├── new.tsx             # Add Kit (sectioned form)
│   │   └── [id]/
│   │       ├── index.tsx       # Kit workspace (tabs: overview/assets/links/timeline)
│   │       ├── assets.tsx      # Assets tab (content embedded in workspace or sub-route)
│   │       ├── links.tsx
│   │       └── timeline.tsx
│   └── settings/
│       └── filters.tsx         # Filter Management (auth-protected)
│
├── lib/
│   ├── api/
│   │   ├── client.ts           # HTTP client (ported from web)
│   │   └── auth.ts             # Token storage via expo-secure-store
│   ├── constants.ts            # GRADES, BUILD_STATUS, EMPTY_KIT_FORM, etc.
│   ├── utils.ts                # caseFold, buildKitEditForm, toUserMessage, etc.
│   └── hooks/
│       ├── useAuth.ts           # Auth state + silent refresh
│       ├── useKits.ts           # Kit list + filter state
│       └── useAssets.ts         # Asset upload with progress
│
├── components/
│   ├── ui/                     # Shared UI primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Tag.tsx
│   │   ├── KitCard.tsx
│   │   ├── MetricCard.tsx
│   │   └── ErrorBanner.tsx
│   ├── forms/
│   │   ├── KitForm.tsx          # Reusable form sections (create + edit)
│   │   ├── FileSection.tsx      # Per-type image section with preview + remove
│   │   └── TagPicker.tsx        # Assign existing / create new tag
│   ├── ImageGallery.tsx         # Grouped by type, tap to open viewer
│   ├── ImageViewer.tsx          # Full-screen viewer with zoom/pan/swipe
│   ├── ImmichPicker.tsx         # Bottom sheet: tags → search → select → confirm
│   ├── CoverImageSection.tsx    # Current cover + "Change" action
│   └── SortToggle.tsx           # Newest / Oldest pill
│
├── assets/                      # Icons, images
│   └── immich-icon.svg
│
├── app.json                     # Expo config
├── package.json
├── tsconfig.json
└── eas.json                     # EAS Build config
```

## Navigation Design

```
┌──────────────────────────────────┐
│  Top Nav (sticky)                │
│  Artifactory · Kits · Settings   │
├──────────────────────────────────┤
│                                  │
│  Tab: Dashboard │ Kits │ Settings │
│                                  │
│  ┌──────────────┐  ┌──────────┐ │
│  │ Total Kits    │  │ Total $  │ │
│  │      42       │  │ $1,234   │ │
│  └──────────────┘  └──────────┘ │
│  ┌──────────────┐  ┌──────────┐ │
│  │ Completion    │  │ Active   │ │
│  │    67.3%      │  │    3     │ │
│  └──────────────┘  └──────────┘ │
│                                  │
│  Recent Kits                     │
│  ┌────┬────┐ ┌────┬────┐        │
│  │IMG │Kit │ │IMG │Kit │        │
│  └────┴────┘ └────┴────┘        │
│  ...                             │
└──────────────────────────────────┘
```

Bottom tab bar: Dashboard · Kits · Settings (same as web sidebar items, minus Filters which is under Settings)

## Key Design Decisions

### 1. Shared API client
The web `client.js` ports directly with one change: `window.localStorage` → `expo-secure-store`. The token refresh lock, 401 handling, and all auth logic carry over unchanged.

### 2. Native components for forms
React Native `TextInput` with `autoComplete` provides the datalist/combobox UX. The `Select` uses a bottom sheet action sheet (native iOS picker feel). Tags use tappable chips.

### 3. Image viewer
Use `react-native-reanimated` + `react-native-gesture-handler` for pinch-zoom and pan, wrapped in a modal. The same thumb + original URL pattern applies. Immich images route through the proxy.

### 4. ImmichPicker as a bottom sheet
On mobile, a bottom sheet is more natural than a full-screen modal. Slides up from the bottom. Same three phases: tag select → thumb grid → confirm.

### 5. File upload with progress
`expo-image-picker` for camera/gallery. Upload progress tracked with `fetch` + streaming (XMLHttpRequest for actual progress events). Same status badges (Ready → Uploading → Done/Failed).

### 6. Offline resilience
- `expo-secure-store` persists tokens across app restarts
- Kit list data cached in AsyncStorage for cold opens
- Immich thumbnails handled via `onError` fallback (same as web)

## Development Workflow

```bash
# 1. Create project
npx create-expo-app@latest artifactory-mobile --template blank-typescript

# 2. Install dependencies
npx expo install expo-router expo-secure-store expo-image-picker
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install @gorhom/bottom-sheet expo-image

# 3. Copy shared code from web
cp ../frontend/src/api/client.js lib/api/client.ts   # + adapt localStorage → SecureStore
cp ../frontend/src/constants.js lib/constants.ts     # no changes needed
cp ../frontend/src/utils.js lib/utils.ts             # no changes needed

# 4. Development
npx expo start               # QR code → open in Expo Go on iPhone

# 5. Build for App Store
eas build --platform ios --profile production
eas submit --platform ios
```

## Implementation Sequence

| Phase | Days | What |
|-------|------|------|
| 1 | 7 | Auth flow, API client, secure storage, silent refresh |
| 2 | 5 | Dashboard (stats cards + recent kits + sort toggle) |
| 3 | 7 | Kits list (search, filters, pagination, sort, kit cards) |
| 4 | 7 | Kit detail overview (metadata, tags, gallery, cover) |
| 5 | 5 | Add Kit form (sectioned, image sections, Immich import) |
| 6 | 5 | Kit workspace tabs (assets, links, timeline) |
| 7 | 5 | Image viewer (zoom/pan, Immich support, set cover) |
| 8 | 3 | Filter Management + Settings |
| 9 | 5 | Polish, edge cases, App Store submission |

**Total: ~44 days for a solo developer with AI assistance**
