# Gujarat Police — Unified AI CCTV Intelligence Platform

Desktop-first, dark command-center frontend for the Gujarat Police AI CCTV programme.
**Implemented screens: Dashboard, Live View, Camera Map, Watchlist and Alerts.**
The remaining modules (Vehicle Search, Analytics, Investigation, Camera Health,
Reports, Users & Roles, System Settings) are inert sidebar placeholders until they
are built.

Routing is `react-router-dom`: `/` → Dashboard, `/live-view` → Live CCTV Monitoring,
`/camera-map` → GIS Camera Map, `/watchlist` → Watchlist Management,
`/alerts` → Alert Management & Response.

Stack: **React 19 + TypeScript + Vite + Tailwind CSS 3 + lucide-react**. Frontend-only,
realistic mock data, no backend calls.

---

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle
```

Primary target is a **1440–1600px desktop viewport** (the layout has a 1360px min-width;
it is an operations console, not a responsive marketing site).

---

## Dashboard composition

| Region | Contents |
| --- | --- |
| Left rail (190px) | Emblem + wordmark, 12 nav items (Alerts badged `12`), System Status card, © 2026 Gujarat Police |
| Top header (62px) | Centered global search, notification bell `12`, settings, operator chip |
| KPI row | Total Cameras / Vehicles Detected / Alerts / Watchlist Matches / Active Users |
| Situational row | Live CCTV Feeds (34%) · GIS Camera Map (39%) · Recent Alerts + Camera Health (27%) |
| Intelligence row | Vehicle Search (20%) · Vehicle Journey Timeline (47%) · AI Analytics (33%) |

---

## Live View composition (`/live-view`)

| Region | Contents |
| --- | --- |
| Page header | `LIVE CCTV MONITORING` + subtitle, Live Cameras count, Online / Reconnecting / Offline pills, wall clock |
| Toolbar | Camera search, Location / Department / Status / Codec selects, 2×2·3×3·4×4 grid switch, fullscreen |
| Filter chips | All Cameras · Online · Offline · Critical · ANPR Active · AI Detection (each with live counts) |
| Camera wall | 12 feeds — ID, location, zone, department, LIVE badge, ANPR tag, quality/FPS/resolution/codec, timestamp, latency, and fullscreen / snapshot / mute / zoom / details controls |
| Overlays | Cyan AI boxes (car, bike, person, crowd); red ANPR boxes with corner brackets + plate & confidence on C-038 (`GJ01AB1234`) and C-115 (`GJ05JK6789`); `WATCHLIST MATCH`, `SPEED VIOLATION`, `CROWD DETECTED` banners; `RECONNECTING…` and `SIGNAL LOST` states |
| Stream Health strip | Online / Reconnecting / Offline / Degraded counters plus live Avg FPS, Avg Latency, Packet Loss and Ingest bars |
| Intelligence rail | **Selected Camera Intelligence** (preview, identity, stream/codec/FPS/resolution/latency/bitrate/packet-loss/heartbeat, RTSP source, detected vehicles, latest ANPR, recent events, View Details · Snapshot · Fullscreen) and **Live ANPR OCR Feed** (plate, camera, time, confidence — appends a new read every ~3.2 s, watchlist hits in red) |

Live behaviour is simulated in hooks so it maps 1:1 onto the future gateway:
`useLiveClock` (overlay timestamps), `useAnprFeed` (→ `anpr:hit` WebSocket topic),
`useTelemetryTick` + `drift()` (→ `kpi:tick` telemetry frames).

---

## Camera Map composition (`/camera-map`)

Full-screen GIS intelligence workspace over the Ahmedabad–Gandhinagar corridor
(with Kalol, Adalaj, Sanand, Aslali, Dahegam and the Vadodara expressway on the edges).

| Region | Contents |
| --- | --- |
| Page header | `GIS CAMERA MAP` + subtitle, Layers / Filters / Fullscreen / Refresh controls, wall clock |
| Stats strip | Total Cameras 12,842 · Online 11,243 (87%) · Offline 1,128 (9%) · Warning / Poor Signal 471 (4%) · Active Alerts 12 |
| Map canvas | Hand-authored dark GIS base: Sabarmati + riverfront, canals, lakes, green belts, railways, SVP airport runway, urban blocks and minor streets, national highways / expressways / arterials / ring road with rotated road labels (NH-147, S.G. Highway, Ring Road, Ashram Road, Sarkhej–Gandhinagar Hwy, Vadodara Expressway…) and place labels tiered metro → city → town → area → POI |
| Markers | 68 cameras — glowing green Online, red Critical, orange Warning, gray Offline; density clustering with a severity-tinted count badge, auto-expanding as you zoom past 2.6× |
| Marker popup | Camera ID, location, area/city, department, status, codec, resolution, FPS, latency, heartbeat, detected vehicles, live thumbnail + `View Live Feed` (deep-links to `/live-view?camera=C-045`); flips/clamps so it never hides under a deck |
| Map controls | Zoom in / out (with live `×` readout), locate-centre, road vs satellite base style, layer menu (cameras, clusters, alerts, route, labels, density heat) and fullscreen |
| Left deck | `MAP FILTERS` — location search, status All/Online/Offline/Warning/Critical with counts, department checkboxes, H.264 / H.265 / MJPEG codec chips, ANPR Active + AI Detection toggles, visible-camera tally |
| Right deck | `SELECTED CAMERA INTELLIGENCE` — preview with LIVE / alert banner, identity, stream health, FPS, latency, codec, resolution, packet loss, vehicles detected, latest ANPR plate, recent detections, `View Live Feed` |
| Bottom deck | `VEHICLE JOURNEY` — plate tabs (GJ01AB1234 · GJ05JK6789 · GJ18CD4521), collapsible, with chronological sighting cards C-001 Shahibaug Road 10:21:15 AM → C-007 Naranpura Road 10:28:42 AM → C-015 Kudasan Road 10:34:18 AM → C-038 Gift City Road 10:44:03 AM (speed + heading per hit) |
| Route overlay | Connected cyan polyline with animated flow dash and numbered nodes 1–4; the final Gift City leg turns red for the watchlist state, and a red `ALERT: Watchlist Match` callout (GJ01AB1234 · C-038 · Gift City Road · 10:44:03 AM · 98.7%) offers View Details · Track Vehicle · Dismiss |
| Legend | Online · Warning / Poor Signal · Critical / Alert · Offline · Camera Cluster · Tracked Vehicle Route |

Interactions: drag to pan, wheel to zoom about the cursor, click a marker to select
(popup + right deck), click a cluster to zoom into it, click a journey card or route node
to jump the map to that sighting.

---

## Structure

```
src/
├─ assets/                 # CCTV thumbnails + vehicle snapshot
├─ components/
│  ├─ common/              # Panel shell, ViewAll link, police emblem (inline SVG)
│  ├─ layout/              # Sidebar (NavLink routing), SystemStatusCard, TopHeader
│  ├─ dashboard/           # KpiRow, LiveFeedsPanel, GisCameraMapPanel,
│  │                       # RecentAlertsPanel, CameraHealthPanel,
│  │                       # VehicleSearchPanel, JourneyTimelinePanel, AiAnalyticsPanel
│  ├─ liveview/            # LiveViewHeader, LiveCameraCard, SelectedCameraPanel,
│  │                       # AnprFeedPanel, StreamHealthPanel
│  └─ cameramap/           # BaseMap, CameraMarkerLayer (+ buildClusters), CameraPopup,
│                          # RouteLayer, MapControls, MapFilterPanel,
│                          # MapCameraIntelPanel, JourneyPanel, MapStatsStrip/MapLegend
├─ data/
│  ├─ mockData.ts          # dashboard values + navigation (single source of truth)
│  ├─ mapData.ts           # GIS geometry: roads, river, labels, markers, tracked route
│  ├─ liveViewData.ts      # 12-camera fleet, ANPR seed rows, stream health metrics
│  ├─ gisGeometry.ts       # 1600×1000 world: roads, water, rail, blocks, place labels
│  └─ cameraMapData.ts     # 68 map cameras, fleet stats, tracked route + alert payload
├─ hooks/                  # useLiveClock, useAnprFeed, useTelemetryTick, useMapViewport
├─ pages/                  # Dashboard.tsx, LiveView.tsx, CameraMap.tsx (composition only)
├─ services/               # integration seams (see below)
├─ types/                  # index.ts (shared) + liveView.ts (camera/stream/ANPR)
└─ index.css               # Tailwind layers + .panel / .panel-title primitives
```

Every panel is a self-contained component fed by typed props/data, so replacing a mock
import with a data hook touches one file.

---

## Backend integration seams (already stubbed)

| File | Purpose |
| --- | --- |
| `services/api.ts` | Typed REST client (`VITE_API_BASE_URL`, default `/api/v1`) returning the same types the UI already consumes |
| `services/realtime.ts` | WebSocket channel for `alert:new`, `camera:state`, `anpr:hit`, `kpi:tick` (`VITE_WS_URL`) |
| `services/streams.ts` | RTSP → HLS/WHEP URL helpers (`VITE_STREAM_GATEWAY`); cameras already carry `streamUrl` |

The GIS layers are hand-authored SVG in fixed world coordinate spaces — `1000 × 700` for
the dashboard mini-map (`data/mapData.ts`) and `1600 × 1000` for the Camera Map
(`data/gisGeometry.ts`). Every screen-space value goes through one `project(x, y)` from
`useMapViewport`, so swapping in MapLibre/Leaflet means replacing that projection and
re-expressing `mapCameraNodes` / `trackedRoute` as lat-lng — markers, clustering, popup,
route and decks are unchanged. `MapCameraNode` already carries `lat`/`lng` placeholders
for real camera coordinates.

### Suggested next steps
1. Add `react-router-dom` and promote the sidebar items to real routes.
2. Introduce TanStack Query wrapping `services/api.ts`, then delete the mock imports.
3. Replace wall thumbnails with `<video>` + `hls.js` / WebRTC using `toHlsUrl(camera.id)`
   or `toWhepUrl(camera.id)` — `LiveCamera.streamUrl` already carries the RTSP source.
4. Wire `createRealtimeChannel()` into the alerts rail, KPI strip, ANPR ticker and the
   Camera Map (`camera:state` → marker status, `alert:new` → map alert callout).
5. Build the next module (Camera Map or Vehicle Search) and flip its `available` flag
   in `data/mockData.ts` to make the sidebar item routable.

---

## Notes
- Colour system, spacing scale and glow shadows live in `tailwind.config.js`.
- CCTV imagery and the vehicle snapshot are synthetic stand-ins for evidence frames.
- `scripts/screenshot.mjs` (Playwright, dev-only) renders any route to a PNG for visual
  checks: `node scripts/screenshot.mjs /live-view shots/live-view.png`.
- Adding a screen: build it under `pages/`, register the route in `App.tsx`, then set
  `available: true` on its `navItems` entry. Existing screens are untouched by this.
