# PROMPT 1 COMPLETION REPORT — Real-Time AI Intelligence Pipeline (Backend)

Scope: complete the EXISTING Gujarat Police CCTV Hackathon 2026 project's
backend/AI/data/realtime intelligence pipeline. **No new project, no UI redesign,
no replacement of working components** — every change below extends or fixes the
existing Phase 0–4 codebase (Sentinel catalogue → RTSP gateway → YOLO/ByteTrack →
ANPR → vehicle identity → journeys → watchlist → real-time alerts → WebSocket).

Date: 2026-09-03 · Branch: `arena/01a06719-ai-powered-unified-cctv-intell`

---

## 1. What already existed (reused, not re-implemented)

| Stage | Existing implementation |
| --- | --- |
| Government feed | `services/sentinel.py` (dynamic Sentinel `/api/ingest` catalogue, no hard-coded URLs) |
| RTSP | `services/stream_gateway.py` — per-camera FFmpeg worker, real source PTS, reconnect backoff, latest-wins bounded frame buffer, MJPEG preview; NO video files |
| YOLO + tracker | `vision/detector.py` — Ultralytics YOLO + ByteTrack/BoT-SORT (`model.track(persist=True)`), per-camera detector instances, GPU/CPU auto, fail-safe `MODEL_NOT_READY` |
| ANPR | `vision/anpr.py` + `vision/plate_utils.py` — RapidOCR (bundled offline ONNX), Indian-plate normalization/repair |
| Orchestration | `services/pipeline.py` — one worker per live camera, inference-FPS sampling, fleet concurrency semaphore, bounded queue, isolated failures |
| Persistence | `models/vehicle.py` — vehicles, anpr_sightings, vehicle_tracks, journey_points with plate/time/camera indexes |
| Matching/watchlist/alerts | `services/watchlist.py`, `services/alerts.py`, `models/{watchlist,alerts}.py` |
| Realtime | `services/events.py` + `api/intelligence.py` WS hub, reconnect-safe frontend client |
| Ops layer | camera health, GIS, investigation, evidence snapshots, dashboard, reports, audit, auth/RBAC, system metrics |

## 2. What was changed / added

### Backend code
- **`core/config.py`** — new settings + startup validation:
  `ANPR_RELIABLE_CONFIDENCE` (0–1), `AI_STATUS_PUBLISH_SECONDS`, `CROSS_CAMERA_VISUAL_MATCH_ENABLED`.
- **`vision/anpr.py`** — `PlateRead` now carries `uncertain`/`reliable`/`source`;
  reads that fail the Indian plate grammar or fall below the reliability threshold
  are **marked uncertain** (never invented).
- **`vision/detector.py`** — startup pre-flight (`preflight_detector()` /
  `preflight_health()`): model loaded once at boot from `VEHICLE_MODEL_PATH`,
  reports device, weights source, `MODEL_NOT_READY`/`SYNTHETIC_FALLBACK` honestly.
- **`models/vehicle.py`** — `anpr_sightings`: `plate_valid`, `plate_uncertain`, `source` columns.
- **`services/vehicle_intel.py`** —
  - reliable reads → Vehicle Identity + journey; **uncertain reads persisted but never create identity/journey**;
  - sighting search now filters by `since` / `until` / `camera_id`;
  - new `match_cross_camera()` (deterministic plate identity + gap/speed spatial-temporal constraints, implausible legs flagged, never claimed) and config-gated, clearly-labelled low-confidence `cross_camera_metadata_candidates()`.
  - fixed latent bug: unflushed track/sighting inserts inside one session could violate unique constraints.
- **`services/pipeline.py`** —
  - publishes canonical events `vehicle:detected`, `vehicle:tracked`, `anpr:hit` (with `valid`/`uncertain`/`reliable`/`source`/`pts_ms`), keeps legacy `detection`/`track` names;
  - new global `ai_status_snapshot()` / `publish_ai_status()`; `ai:status` published at startup, worker start/stop, and every `AI_STATUS_PUBLISH_SECONDS` (bounded);
  - worker status adds `effective_infer_fps` (measured from frames processed/uptime — never the reported camera FPS), `anpr_ready`, queue pressure;
  - structured per-frame stats log (camera_id, inference/ANPR latency, detection & track counts, queue depth, effective rate).
- **`services/watchlist.py`** — reliability guard (uncertain reads never match);
  exactly-once insert now PostgreSQL **and** SQLite portable; matched_at accepts ISO strings.
- **`services/alerts.py`** — duplicate suppression scoped per exact source
  (vehicle+camera) with a **time-bucket cooldown** key
  (`watchlist_match:{entry}:{camera}:{bucket}`): same window → folded; after the
  window a genuinely new event can raise a fresh alert. Dialect-portable insert.
- **`db/session.py`** — fixed SQLite dev/tests: QueuePool args only for PostgreSQL.
- **`api/intelligence.py`** — new `GET /api/ai/status`; WS topic docs updated.
- **`api/vehicles.py`** — sightings endpoint gains time-range + camera filters;
  new `GET /api/vehicles/{plate}/cross-camera`.
- **`schemas/vehicle.py`** — `SightingOut` reliability/source fields; `PipelineWorkerStatus` gains latency/effective-fps/queue fields.
- **`main.py`** — model pre-flight + initial `ai:status` at startup; root endpoint lists `/api/ai/status`.

### Alembic
- **New migration `0005_anpr_reliability_source`** (`0004_audit_reports → 0005…`):
  adds `plate_valid`, `plate_uncertain`, `source` to `anpr_sightings` + Postgres
  backfill from OCR confidence & plate grammar. Existing camera registry,
  watchlist, alerts, evidence, health, investigation, auth tables untouched.

### Frontend (contract only — no redesign)
- `src/services/realtime.ts` — recognises `vehicle:detected`, `vehicle:tracked`, `ai:status`.
- `src/services/api.ts` — `SightingDto` reliability/source fields; `getAiStatus()`, `getVehicleCrossCamera()`.
- `src/hooks/useAnprFeed.ts` — production drops synthetic **and uncertain** reads.

## 3. APIs added / changed

| API | Change |
| --- | --- |
| `GET /api/ai/status` | **NEW** — global AI health (model ready/device/weights/error, ANPR provider, worker trust flags, effective rates, DB counts). Never fabricates readiness. |
| `GET /api/vehicles/{plate}/sightings` | `/` `since` `until` `camera_id` filters added; returns real observations incl. reliability flags |
| `GET /api/vehicles/{plate}/cross-camera` | **NEW** — deterministic plate-identity cross-camera matching with temporal/spatial constraints |
| `GET /api/pipeline`, `/api/pipeline/summary` | extended worker status (latencies, effective FPS, queue depth, ANPR state) |
| `WS /api/ws` | topics: `vehicle:detected`, `vehicle:tracked`, `ai:status` added alongside existing `detection`, `track`, `anpr:hit`, `watchlist:match`, `alert:new`, `camera:state`, `camera:health` |

## 4. Database
- `anpr_sightings` +3 columns (0005 migration); indexes for plate/time/camera
  already existed and are unchanged. No new tables; no camera-registry changes.

## 5. AI models / dependencies
- **YOLO**: genuine Ultralytics weights from `VEHICLE_MODEL_PATH` (e.g. `yolov8n.pt`
  or custom); `ultralytics`, `torch`, `torchvision`, `lapx`, `opencv-python-headless`,
  `numpy`, `pillow`. GPU automatic via `VEHICLE_DEVICE=auto`.
- **ANPR**: `rapidocr-onnxruntime` + `onnxruntime` (bundled offline PP-OCR).
- **Tracker**: ByteTrack / BoT-SORT via `TRACKER_CONFIG` (Ultralytics).
- **Dev/test**: `backend/requirements-dev.txt` (adds `pytest`; runtime deps unchanged).

## 6. Required environment variables
Existing (unchanged): `DATABASE_URL`, `SENTINEL_BASE_URL/API_KEY/API_SECRET`,
`STREAM_*`, `VEHICLE_MODEL_PATH`, `VEHICLE_DEVICE`, `VEHICLE_CONF_THRESHOLD`,
`VEHICLE_INFER_FPS`, `TRACKER_CONFIG`, `ANPR_*`, `EVIDENCE_*`, `ALERT_DEDUPE_SECONDS`,
`AUTH_ENABLED`, `JWT_SECRET_KEY`, `AI_MAX_CONCURRENT_INFERENCE`, etc.
**NEW**: `ANPR_RELIABLE_CONFIDENCE` (0.75), `AI_STATUS_PUBLISH_SECONDS` (15),
`CROSS_CAMERA_VISUAL_MATCH_ENABLED` (false). See `.env.example` (root + backend).

## 7. Exact end-to-end data flow (real, no mocks)
```
Sentinel /api/ingest ──normalize──▶ Camera Registry (rtsp_url only server-side)
   └─▶ Stream Gateway worker (FFmpeg RTSP→JPEG, source PTS, bounded latest-wins buffer)
        └─▶ PipelineWorker (per camera, sampled at VEHICLE_INFER_FPS, fleet semaphore)
             ├─▶ VehicleDetector (YOLO + ByteTrack/BoT-SORT, per-camera state)
             │     └─ detections → tracking (stable track_id per camera)
             │          └─▶ WS: vehicle:detected / vehicle:tracked (+ legacy detection/track)
             ├─▶ AnprEngine (RapidOCR on vehicle crop)
             │     └─ normalized plate + valid/uncertain/reliable flags
             │          └─▶ record_anpr_sighting → DB (anpr_sightings, plate flags, source, PTS, bbox, lat/lon, track_id)
             │               ├─ reliable: Vehicle Identity upsert + journey point (distance/speed/anomaly)
             │               ├─ WS: anpr:hit (uncertain/reliable + pts_ms)
             │               └─ WS: journey (when a leg is added)
             │                    └─▶ watchlist.process_anpr_hit (reliable only, exactly-once)
             │                         └─▶ WatchlistMatch + evidence snapshot
             │                              └─▶ raise_watchlist_alert (bucket cooldown)
             │                                   └─▶ Alert row + WS: alert:new
             │                                        └─ WS: watchlist:match
             ├─▶ upsert_track (camera_id, track_id, class, first/last seen, plate, trajectory)
             └─▶ pipeline status / ai:status / /api/ai/status (model, device, ANPR, rates)
Every event carries camera_id + pts_ms/timestamp. Camera state changes publish
camera:state/camera:health. No video is stored — evidence is a single JPEG crop
or live-frame snapshot reference only.
```

## 8. What was actually verified in this environment
- `python -m compileall` on `app/`, `alembic/versions/`, `tests/` — OK.
- **36/36 pytest tests pass** (`backend/tests/`): plate normalization/repair,
  ANPR reliability (uncertain never becomes identity), detector lifecycle
  (MODEL_NOT_READY, output schema, tracker reset, synthetic never ready,
  inference failure is isolated), watchlist exactly-once + reliability guard,
  alert cooldown/duplicate suppression (same window folds; different camera/after
  window creates new), vehicle search + time/camera filters, journey generation +
  impossible-travel anomaly, cross-camera plate-identity constraints, track
  trajectory upsert, `/health` and `/api/ai/status` (READY + honest
  MODEL_NOT_READY responses). Deterministic stubs/fixtures only — no fake
  detections in runtime.
- `alembic upgrade head` on a fresh SQLite DB: 0001→0005 clean, single head `0005`.
- App import + OpenAPI: `/api/ai/status`, `/api/vehicles/{plate}/cross-camera`,
  filtered sightings + WS present; `WS /api/ws` registered.
- Live server smoke test (uvicorn, migrated SQLite): `/health`, `/api/status`,
  `/api/ai/status`, `/api/pipeline`, `/api/vehicles/search`, `/api/system/health`,
  `/api/cameras` all 200; `/api/ai/status` reported `MODEL_NOT_READY` honestly.
- Frontend: `npm run build` (`tsc -b && vite build`) — success; `npm run lint` —
  **0 errors** (8 pre-existing warnings only).

## 9. Externally blocked (not faked — code is ready for immediate real execution)
1. **No genuine YOLO weights** in this sandbox → detector correctly returns
   `MODEL_NOT_READY`, zero detections (verified by tests + live endpoint).
   Supply real `VEHICLE_MODEL_PATH` weights (COCO `yolov8n.pt` or a vehicle
   checkpoint) and install `ultralytics/torch` (not installed here).
2. **No government Sentinel API credentials / real RTSP feeds** → no live camera
   was exercised; the gateway/pipeline code paths are unit-verified, and
   `SENTINEL_*` env config is ready.
3. **No PostgreSQL/PostGIS server in this sandbox** → migrations validated on
   SQLite; Postgres-specific backfill statement is dialect-guarded and will run
   automatically on `alembic upgrade head` against PostGIS.
4. **No RapidOCR run** here (provider set to `none` in test env) → RapidOCR is a
   pip dependency in `requirements.txt` and the engine is lazy-loaded in
   production; its status surfaces via `/api/ai/status`.

## 10. Ready for PROMPT 2
Dashboard/GIS integration can now consume: real `/api/ai/status` + pipeline
status, filtered real sightings, cross-camera matches, and the canonical
`vehicle:detected` / `vehicle:tracked` / `anpr:hit` / `watchlist:match` /
`alert:new` / `camera:state` / `ai:status` realtime topics — with no fake or
sample data paths anywhere in the backend runtime.
