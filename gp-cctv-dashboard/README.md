# Gujarat Police — Unified AI CCTV Intelligence Platform

Desktop-first, dark command-center frontend for the Gujarat Police AI CCTV programme.
**Implemented screens: Dashboard, Live View, Camera Map, Watchlist, Alerts, Analytics
and Investigation.** The remaining modules (Vehicle Search, Camera Health, Reports,
Users & Roles, System Settings) are inert sidebar placeholders until they are built.

Routing is `react-router-dom`: `/` → Dashboard, `/live-view` → Live CCTV Monitoring,
`/camera-map` → GIS Camera Map, `/watchlist` → Watchlist Management,
`/alerts` → Alert Management & Response, `/analytics` → AI Analytics & Intelligence,
`/investigation` → Investigation & Vehicle Intelligence.

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

## Analytics composition (`/analytics`)

Dedicated **AI ANALYTICS & INTELLIGENCE** workspace. Date / location / camera filters
drive a pure `computeAnalytics(filters)` snapshot so the page is ready to swap onto
`GET /api/v1/analytics` and `analytics:tick`.

| Region | Contents |
| --- | --- |
| Page header | `AI ANALYTICS` + subtitle, Date Range / Location / Camera selects, Export Report, Refresh, wall clock |
| KPI strip | Vehicles Detected 18,729 · ANPR Reads 14,382 · AI Events 2,846 · Watchlist Matches 7 · Active Cameras 11,243 |
| Row 1 | **Vehicle Detection Trend** (area) · **Vehicle Types** donut (Cars / Two Wheelers / Heavy Vehicles / Buses) · **AI Events by Type** (Speed, Wrong Direction, Crowd, No Helmet, Signal Jump, Other) |
| Row 2 | **ANPR Performance** (processed / successful / OCR confidence / unreadable) · **Camera Activity** ranked by detections · **Top Detection Locations** (Gift City Road, S.G. Highway, Shahibaug Road, Naranpura Road, Vadodara City Center) |
| Row 3 | **Watchlist Match Trend** (daily matches + critical overlay) · **Hourly Activity** 7×24 heatmap |
| Bottom | **Intelligence Summary** — peak traffic, highest location, highest alert category, ANPR confidence, fleet mix, unusual-activity flags + `View Detailed Report` |

---

## Investigation composition (`/investigation`)

Dedicated **INVESTIGATION & VEHICLE INTELLIGENCE** workspace: an analyst console for
reconstructing one vehicle's movement across the camera network, reviewing the AI events
it triggered and filing a case with its evidence.

| Region | Contents |
| --- | --- |
| Page header | `INVESTIGATION` + subtitle, live case chip (`INV-2026-0914 · ACTIVE · opened … · Gandhinagar Command`), plate search, date + time-range picker, location and camera filters, wall-clock readout, Refresh, Export Case, New Investigation |
| Search area | Oversized plate entry prefilled `GJ01AB1234`, Vehicle / Camera / Person-Event mode switch, fuzzy-match · watchlist-only · include-re-reads toggles, index candidate cards, recent-investigation chips (`INV-2026-0914`, `INV-2026-0898`, `INV-2026-0871`, `INV-2026-0799`, `INV-2026-0755`) |
| **TARGET VEHICLE** | Snapshot with AI + ANPR boxes, `GJ01AB1234`, `White Swift Dzire`, White, LMV · Sedan, owner / registration / insurance / fitness, AI attribute confidence bars, **WATCHLIST MATCH** badge (High Priority Vehicles · WL-001 · critical), 98.7% peak confidence, First Seen `10:21:15 AM`, Last Seen `10:44:03 AM`, 14 total sightings across 10 cameras, current position + last ping |
| **CROSS-CAMERA JOURNEY** | Horizontal reconstruction C-001 Shahibaug Road Ahmedabad → C-007 Naranpura Road Ahmedabad → C-015 Kudasan Road Gandhinagar → C-038 Gift City Road Gandhinagar — numbered nodes, snapshots, per-leg duration / distance / average speed, replay control, paired with a pan-zoom GIS mini-map (shared `useMapViewport` + `BaseMap`) whose cyan route turns red on the watchlist leg |
| **INVESTIGATION DETAILS** rail | Target status, watchlist category + entry, matching-camera chips (route nodes tagged), detection count, ANPR confidence (peak / mean + share of reads ≥ 95%), first / last / current location with lat-lng, movement corridor, investigation status, case reference, escalate action |
| **SIGHTING HISTORY** | All 14 reads — timestamp, camera ID + department, location / area / city / zone, plate confidence bar, vehicle type + lane + speed, direction arrow, evidence snapshot — with sortable columns and camera / city / confidence / route-node filters |
| **RELATED EVENTS** | Watchlist Match (ALRT-2461), Speed Violation (ALRT-2458), Wrong Direction (ALRT-2452), Red Light Violation (ALRT-2449), ANPR Plate Variance (ALRT-2444) with metric, evidence and acknowledge actions |
| **ROUTE ANALYSIS** | Journey duration `22 min 48 s`, cameras crossed 10, distance estimate `21.8 km`, average time between cameras `1 min 45 s`, movement direction `Ahmedabad → Gandhinagar · bearing 072° ENE`, per-leg bars, longest gap |
| **RELATED VEHICLES / POSSIBLE ASSOCIATIONS** | Derived co-detection cards — `GJ27RS3391` convoy (7 shared gantries), `GJ05JK6789` stolen-vehicle read on 5 shared gantries, `GJ18CD4521` time-correlated, `Arjun Rathod` registered owner — each with a dossier deep link and watchlist action |
| **EVIDENCE GALLERY** | One archived frame per sighting with camera ID, timestamp, clip reference, OCR confidence and tags; All / Route nodes / Watchlist / per-camera filters; View and Fullscreen controls |
| Bottom analytics | **Sightings Over Time** (5-minute buckets, peak 10:30) · **Camera Frequency** (reads per camera, route nodes highlighted, click to filter) · **Location Distribution** (donut by area + city totals) |
| Action bar | Track Live · View Camera · Add to Watchlist · Create Case · Export Evidence · Close Investigation (with reopen) |

Interactions: clicking a journey node, timeline card or step chip focuses that location on
the mini-map; clicking a sighting row, gallery card, evidence button or "view frame" opens
the detailed evidence viewer (frames, filmstrip, telemetry, fullscreen, prev/next); Create
Case opens a case form (title, priority, offence, FIR, unit, officer, notes and a
multi-select evidence set) and files `CR-118/2026`.

Everything on the screen is derived by pure functions in `data/investigationData.ts`
(`buildRouteLegs`, `computeRouteAnalysis`, `computeInvestigationAnalytics`,
`buildEvidence`, `filterSightings`, `sortSightings`, `caseBundle`), so the four seeded
dossiers stay internally consistent and the page can be pointed at
`GET /api/v1/investigations/:id` + an `investigation:tick` WebSocket topic without
component changes. Every sighting already carries `lat`/`lng` derived from one affine
fit (`worldToLatLng`) ready for real GIS.

---

## Camera Health composition (`/camera-health`)

Dedicated **CAMERA HEALTH & STREAM MONITORING** workspace: an infrastructure console for
camera connectivity, ingest-pipeline quality and AI-processing health across the fleet.

| Region | Contents |
| --- | --- |
| Page header | `CAMERA HEALTH` + `stream monitoring` badge + subtitle, auto-refresh state and sync clock, Refresh, Auto Refresh (pause / resume), Export Report (CSV of the visible grid), Settings |
| KPI strip | Total Cameras **12,842** · Online **11,243 (87%)** · Offline **1,128 (9%)** · Poor Signal **471 (4%)** · Reconnecting **86** (`of 471 poor-signal · retrying now`) — every card is a live filter with a share-of-fleet bar |
| Toolbar | Status chips (All Cameras / Online / Offline / Poor Signal / Reconnecting / Critical, each with counts), department + location selects, codec (H.264 / H.265 / MJPEG) and resolution (720p–4K) filters, search by camera ID / location / area / IP, sort by status, health score, ID, location, department, latency, FPS, bitrate or heartbeat + direction, reset, visible-feed tally |
| **CAMERA HEALTH MONITOR** | 23 monitored feeds including `C-001` Shahibaug Road, `C-007` Naranpura Road, `C-015` Kudasan Road, `C-038` Gift City Road, `C-089` Maninagar Junction, `C-115` S.G. Highway and `C-207` Vadodara City Center — Camera ID, Location (+ area / city / zone), Department, Status pill, Stream transport, FPS vs target, Resolution, Codec, Latency + jitter, Bitrate + buffer, Packet Loss, Last Heartbeat + uptime, AI / ANPR state and a live 0–100 health bar carrying the reason for the flag; sticky ID column, green / red / amber / blue indicators, row click selects |
| **SELECTED CAMERA HEALTH** | Preview with LIVE badge or `no video signal`, identity + health score, actions **Restart Stream · View Live · Snapshot · Camera Details**; ingest-pipeline cards for **RTSP** (state, TCP/UDP, `:554`), **WebRTC** (state, latency, ICE candidate) and **HLS** (state, segment size, playlist lag); codec, resolution, FPS, bitrate, latency, jitter, packet loss, buffer, last heartbeat, uptime; fps + latency sparklines; AI / ANPR pipeline (model, version, inference ms, queue depth, GPU util, frames processed); "requires attention" reasons; expandable details (IP, edge node, firmware, install date, 24 h restarts, zone, geo, RTSP URL) |
| **STREAM QUALITY** | Fleet FPS / latency / bitrate / packet-loss trends — 24 five-minute buckets (`08:50–10:45`) with avg / low / peak readouts and the operator's warning thresholds drawn as dashed reference lines |
| **CAMERA STATUS DISTRIBUTION** | Donut of the three fleet buckets + legend, with Reconnecting (86, *of Poor Signal*) and Critical (214, *of Offline / Poor Signal*) callouts — the sub-states are live states rather than extra cameras, and the three shares are largest-remainder rounded to exactly 100% |
| **HEALTH BY LOCATION** | Every monitored area ranked worst-first (Aslali 0 → Shahibaug / Kudasan / Vadodara 100) with mean score, ok · degraded · down split and camera count; clicking drills the monitor search into that area |
| **CRITICAL CAMERAS** | Feeds needing an operator, longest incident first — location, issue, evidence line, duration and a per-feed action (Restart Stream / Re-pair ANPR / Escalate) |
| **RECENT HEALTH EVENTS** | Timeline of disconnects, reconnect attempts, signal degradation, recoveries, codec changes and AI / ANPR processing events with timestamps, camera links and `auto` resolved badges; per-kind filters |
| Settings modal | Latency warn / critical, packet-loss warn / critical, min FPS %, heartbeat warn, telemetry refresh interval, auto-restart / critical-alert / ANPR-alert toggles, a live "would flag N of M feeds" preview and restore-defaults |

Health is not stored: `evaluateCamera(camera, settings)` in `data/cameraHealthData.ts`
derives per-metric tone, the 0–100 score and the "requires attention" list purely from the
thresholds, so the Settings modal genuinely drives the grid tones, the location ranking and
the critical list. Telemetry breathes through `liveCamera(camera, tick)` (frozen while Auto
Refresh is paused), and the monitor grid is fed by the same 23-camera registry used by the
Camera Map, so IDs, locations, departments, codecs and thumbnails stay consistent.

Backend seams already in place: `getCameraHealthDetail` / `restartCameraStream` in
`services/api.ts`, the `camera:health` topic in `services/realtime.ts`, per-camera
`streamUrl` (RTSP) plus `rtsp` / `webrtc` / `hls` state objects on `HealthCamera`, and
`worldToLatLng` from `data/gisProjection.ts` giving every feed a lat/lng.

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
│  ├─ cameramap/           # BaseMap, CameraMarkerLayer (+ buildClusters), CameraPopup,
│                          # RouteLayer, MapControls, MapFilterPanel,
│                          # MapCameraIntelPanel, JourneyPanel, MapStatsStrip/MapLegend
│  ├─ analytics/           # AnalyticsHeader, AnalyticsKpiRow, trend/types/events/ANPR
│  │                       # camera activity, locations, watchlist trend, heatmap,
│  │                       # intelligence summary + detailed report drawer
│  ├─ camerahealth/        # CameraHealthHeader/KpiRow/Toolbar, CameraHealthMonitorTable,
│  │                       # SelectedCameraHealthPanel, StreamQualityPanel,
│  │                       # StatusDistributionPanel, HealthByLocationPanel,
│  │                       # RecentHealthEventsPanel, CriticalCamerasPanel,
│  │                       # CameraHealthSettingsModal, HealthPrimitives, healthTones
│  └─ investigation/       # InvestigationHeader, TargetVehicleCard,
│                          # InvestigationDetailsPanel, CrossCameraJourneyPanel,
│                          # JourneyRouteMap, SightingHistoryPanel, RelatedEventsPanel,
│                          # RouteAnalysisPanel, RelatedVehiclesPanel, EvidenceViewerModal,
│                          # CreateCaseModal, InvestigationActionBar
├─ data/
│  ├─ mockData.ts          # dashboard values + navigation (single source of truth)
│  ├─ mapData.ts           # GIS geometry: roads, river, labels, markers, tracked route
│  ├─ liveViewData.ts      # 12-camera fleet, ANPR seed rows, stream health metrics
│  ├─ gisGeometry.ts       # 1600×1000 world: roads, water, rail, blocks, place labels
│  ├─ cameraMapData.ts     # 68 map cameras, fleet stats, tracked route + alert payload
│  ├─ analyticsData.ts     # Gujarat analytics snapshot + computeAnalytics(filters)
│  ├─ investigationData.ts # 4 investigation dossiers + route / analytics / evidence
│  │                       #   / case-bundle selectors (pure, API-ready)
│  ├─ cameraHealthData.ts  # 23 monitored feeds, fleet totals, thresholds, events,
│  │                       #   evaluate/filter/sort/location/critical selectors (pure)
│  └─ gisProjection.ts     # one affine world → lat/lng fit shared by every screen
├─ hooks/                  # useLiveClock, useAnprFeed, useTelemetryTick, useMapViewport
├─ pages/                  # Dashboard, LiveView, CameraMap, Watchlist, Alerts, Analytics,
│                          # Investigation, CameraHealth
├─ services/               # integration seams (see below)
├─ types/                  # index.ts (shared) + liveView / cameraMap / watchlist / alerts /
│                          #   analytics / investigation / cameraHealth
└─ index.css               # Tailwind layers + .panel / .panel-title primitives
```

Every panel is a self-contained component fed by typed props/data, so replacing a mock
import with a data hook touches one file.

---

## Backend integration (live)

The dashboard runs against the FastAPI backend in `../backend` (v0.2.0). The
Vite dev server proxies `/api` → `http://127.0.0.1:8000` (see `vite.config.ts`),
and every operational screen renders **real pipeline data when the backend is
reachable, bundled mock fixtures when it is not** — no mode switch, no UI
change.

| File | Purpose |
| --- | --- |
| `services/api.ts` | Typed REST client for all 14 backend routers (watchlist, alerts, evidence, GIS, camera health, investigation, dashboard/analytics, auth) with `authHeaders()` bearer-token injection |
| `services/realtime.ts` | WebSocket channel (`/api/ws`) for `alert:new`, `alert:update`, `watchlist:match`, `camera:health`, `camera:state`, `anpr:hit` — auto-appends `?token=` when a JWT is stored |
| `services/streams.ts` | Centralized playback resolver + URL helpers: real cameras play the backend HLS proxy (`hls_path` → Sentinel `index.m3u8`), gateway MJPEG is the fallback, seeded demo rows are never playable; also `toLiveFrameUrl` thumbnails |
| `hooks/useIntelligence.ts` | The integration layer: DTO → UI-type mappers + polling/WS hooks for every screen (KPIs, recent alerts, health donut, journey timeline, alerts console, watchlist console + CRUD, health fleet, GIS cameras/route, analytics snapshot, investigation dossier + case filing, users/roles) |

Wired screens: **Dashboard** (KPI strip, alert rail, health donut, journey
timeline, AI activity, GIS mini-map), **Alerts** (feed, lifecycle actions,
over-time, top locations), **Watchlist** (KPIs, categories, entries + create,
alert rail, summary, bottom row), **Camera Map** (fleet markers from
`/api/gis/cameras`, tracked route from `/api/gis/vehicle/{plate}/route`),
**Camera Health** (fleet table, distribution, events, real stream restart),
**Investigation** (live dossier, case filing via `POST /api/investigation/cases`),
**Analytics** (real `/api/analytics/summary` merged over the mock baseline).
Users & Access Control still runs on mock fixtures (backend endpoints exist —
`hooks/useIntelligence.ts` ships `useUsersDirectory` ready to wire).

### GIS projection

The GIS layers are hand-authored SVG in fixed world coordinate spaces — `1000 × 700` for
the dashboard mini-map (`data/mapData.ts`) and `1600 × 1000` for the Camera Map
(`data/gisGeometry.ts`). Real registry lat/lngs are projected onto those worlds by
`data/gisProjection.ts` (`worldToLatLng` / `latLngToWorld`, anchored on C-001 Shahibaug
and C-038 GIFT City). Every screen-space value goes through one `project(x, y)` from
`useMapViewport`, so swapping in MapLibre/Leaflet means replacing that projection and
re-expressing `mapCameraNodes` / `trackedRoute` as lat-lng — markers, clustering, popup,
route and decks are unchanged.

### Suggested next steps
1. Wire the Users & Access Control screen onto `useUsersDirectory` (backend RBAC
   endpoints already exist) and add a login screen for `AUTH_ENABLED=true` mode
   (`api.login` / `storeAccessToken` are ready).
2. Introduce TanStack Query wrapping `services/api.ts`, then delete the mock imports.
3. Build the next module (Vehicle Search or Reports) and flip its `available` flag in
   `data/mockData.ts` to make the sidebar item routable.

> Live wall video is already real: `StreamPlayer` plays each camera's
> backend-provided `hls_path` (`/api/streams/{id}/hls/index.m3u8`, which the
> backend resolves to the camera's actual Sentinel `index.m3u8`) through
> `hls.js` (native HLS on Safari), with the gateway MJPEG preview as
> fallback. Seeded `DEMO-CAM-*` registry rows are excluded from the wall by
> the backend `demo_playback` marker — the dashboard never plays a synthetic
> demo feed.

---

## Notes
- Colour system, spacing scale and glow shadows live in `tailwind.config.js`.
- CCTV imagery and the vehicle snapshot are synthetic stand-ins for evidence frames.
- `scripts/screenshot.mjs` (Playwright, dev-only) renders any route to a PNG for visual
  checks: `node scripts/screenshot.mjs /live-view shots/live-view.png`.
- Adding a screen: build it under `pages/`, register the route in `App.tsx`, then set
  `available: true` on its `navItems` entry. Existing screens are untouched by this.
- Runtime smoke checks (dev-only, no browser needed) render each screen through
  `react-dom/server` and assert its content — see `scripts/*-smoke.tsx`:
  `npx vite build --ssr scripts/investigation-smoke.tsx --outDir node_modules/.ssr-inv --emptyOutDir && node node_modules/.ssr-inv/investigation-smoke.js`.
