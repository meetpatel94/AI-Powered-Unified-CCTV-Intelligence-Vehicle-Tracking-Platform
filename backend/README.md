# GP CCTV Intelligence — Backend

Production-ready FastAPI backend for the Gujarat Police Unified CCTV
Intelligence Platform: Sentinel-driven camera registry, RTSP stream gateway,
genuine YOLO + ANPR vehicle intelligence, and the Phase-3 operational layer —
watchlist, real-time alerts, evidence snapshots, GIS, camera health,
investigation case files, JWT auth + RBAC, and dashboard/analytics feeds.

Nothing is fabricated: detections come only from real model inference on real
RTSP frames; a missing model fail-safes to `MODEL_NOT_READY` with **no**
detections, and the mock/dev fixtures used for verification are clearly
labelled.

## Layout

```
backend/
├─ app/
│  ├─ main.py              # FastAPI app: 14 routers, error envelope, lifespan tasks
│  ├─ core/                # settings, logging, errors, permission catalogue
│  ├─ db/                  # engine, session, Base
│  ├─ models/              # cameras, streams, vehicles (tracks/sightings/journeys),
│  │                       # watchlist (entries/matches), alerts, evidence,
│  │                       # health (status/events), investigation (cases), auth (users/roles/sessions)
│  ├─ schemas/             # Pydantic request/response models
│  ├─ services/
│  │  ├─ sentinel.py       # catalogue client: parse/normalize/validate
│  │  ├─ cameras.py        # registry upsert + queries
│  │  ├─ stream_gateway.py # FFmpeg workers, backoff, live-frame buffer
│  │  ├─ pipeline.py       # YOLO detection → tracking → ANPR → evidence →
│  │  │                    #   watchlist → alerts → WebSocket, per camera
│  │  ├─ vehicle_intel.py  # tracks, ANPR sightings, cross-camera journeys
│  │  ├─ watchlist.py      # entries CRUD + exactly-once match engine
│  │  ├─ alerts.py         # dedupe + severity + alert lifecycle
│  │  ├─ evidence.py       # SHA-256-hashed JPEG snapshots + retention task
│  │  ├─ camera_health.py  # LIVE/DEGRADED/RECONNECTING/ERROR/OFFLINE/UNKNOWN
│  │  ├─ gis.py            # GeoJSON cameras/routes/nearby (PostGIS optional)
│  │  ├─ investigation.py  # dossiers, timelines, case files
│  │  ├─ dashboard.py      # KPI + activity series + journeys + analytics
│  │  └─ auth.py           # JWT access/refresh rotation, bcrypt, bootstrap admin
│  └─ api/                 # 14 routers + permission dependencies (deps.py)
├─ alembic/                # migrations 0001-0003 (0003 = intelligence ops)
├─ devtools/
│  ├─ verify_phase3.py     # 67-check end-to-end integration verification
│  ├─ mock_sentinel.py     # local stand-in for the Sentinel catalogue
│  └─ run_demo.py          # mock Sentinel + synthetic RTSP + API
├─ docker-compose.yml      # local PostGIS
├─ .env.example            # copy to .env — never commit secrets
└─ requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and fill Sentinel credentials. Secrets stay in
`.env` (gitignored). Key groups:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL (`postgresql+psycopg2://…`) |
| `SENTINEL_BASE_URL` / `SENTINEL_API_KEY` / `SENTINEL_API_SECRET` | Official Sentinel catalogue auth |
| `CORS_ORIGINS` | Comma-separated frontend origins |
| `VEHICLE_MODEL_PATH` | Genuine YOLO weights (fail-safe if missing) |
| `EVIDENCE_FRAMES_DIR`, `EVIDENCE_RETENTION_DAYS` | Evidence snapshot store + retention |
| `ALERT_DEDUPE_SECONDS`, `ALERT_ON_CAMERA_FAILURE` | Real-time alert engine |
| `CAMERA_HEALTH_POLL_SECONDS` | Health monitor cadence |
| `AUTH_ENABLED`, `JWT_SECRET_KEY`, `BOOTSTRAP_ADMIN_*` | Auth / RBAC (open mode when `AUTH_ENABLED=false`) |

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit secrets
docker compose up -d          # PostGIS
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

For a fully offline demo (mock Sentinel + synthetic RTSP + API):

```bash
python devtools/run_demo.py
```

## Endpoints (v0.2.0 — 14 routers)

| Area | Method + Path | Description |
| --- | --- | --- |
| Platform | `GET /health`, `GET /api/status` | Liveness, DB + Sentinel connectivity |
| Registry | `GET/POST /api/ingest`, `GET /api/cameras`, `GET /api/cameras/{id}` | Sentinel catalogue → camera registry |
| Streams | `GET /api/streams`, `POST /api/streams/{id}/start|stop`, `POST /api/cameras/{id}/stream/restart`, `GET /api/streams/{id}/frame.jpg`, `GET /api/streams/{id}/live` | FFmpeg gateway + MJPEG preview |
| Vehicles | `GET /api/vehicles/search`, `GET /api/vehicles/{plate}/journey` | Genuine ANPR sightings + cross-camera journeys |
| Pipeline | `GET /api/pipeline/status` | Per-camera YOLO/ANPR worker state |
| Watchlist | `GET/POST /api/watchlist`, `PATCH/DELETE /api/watchlist/{id}`, `GET /api/watchlist/matches`, `GET /api/watchlist/stats` | Entries CRUD + match log |
| Alerts | `GET /api/alerts/recent`, `GET /api/alerts/stats`, `POST /api/alerts/{id}/acknowledge|resolve|status` | Real-time alert engine + lifecycle |
| Evidence | `GET /api/evidence`, `GET /api/evidence/{id}/image`, `GET /api/evidence/{id}/verify` | SHA-256-verified JPEG snapshots |
| GIS | `GET /api/gis/cameras`, `GET /api/gis/summary`, `GET /api/gis/vehicle/{plate}/route`, `GET /api/gis/nearby` | GeoJSON intelligence (PostGIS optional) |
| Health | `GET /api/cameras/health`, `GET /api/cameras/{id}/health`, `GET /api/cameras/health/events` | Fleet health + event log |
| Investigation | `GET /api/investigation/{plate}/dossier|timeline`, `GET/POST /api/investigation/cases`, `GET /api/investigation/search` | Dossiers + case files |
| Dashboard | `GET /api/dashboard/kpis|activity|journeys`, `GET /api/analytics/summary` | Command-centre feeds |
| Auth | `POST /api/auth/login|refresh|logout|change-password`, `GET /api/auth/me`, `GET /api/auth/config`, `GET/POST /api/users`, `GET /api/roles` | JWT + RBAC |
| Realtime | `WS /api/ws` | `anpr:hit`, `watchlist:match`, `alert:new`, `alert:update`, `camera:health`, `stream:*` |

`POST /api/ingest` (and GET) calls the official Sentinel `/api/ingest`
endpoint, normalizes metadata, and upserts by `camera_id`. Stream URLs
(`rtsp_url`, `webrtc_url`, `hls_url`) come only from the catalogue — never
hard-coded.

## Auth modes

- **Open mode** (`AUTH_ENABLED=false`, default for development): every request
  runs as an implicit admin principal so the dashboard works without a login
  screen.
- **Secure mode** (`AUTH_ENABLED=true`): JWT bearer auth with rotating refresh
  tokens, bcrypt password hashing, permission-based RBAC
  (ADMIN / SUPERVISOR / INVESTIGATOR / OPERATOR / VIEWER), and WebSocket
  authentication via `?token=`. A bootstrap admin is created on first run only
  when the users table is empty.

## Verification

`devtools/verify_phase3.py` runs 67 end-to-end checks against a running API
(mock Sentinel fixtures): registry ingest, RBAC/user CRUD, watchlist CRUD, the
full genuine-hit pipeline (sighting → match → alert → evidence with duplicate
suppression), alert lifecycle, evidence image + SHA-256 verify, GIS routes,
camera-health states, dashboard KPIs, investigation dossier/cases, and the
WebSocket upgrade.

```bash
# with the demo stack running (API :8000, mock Sentinel :8899)
DATABASE_URL="postgresql+psycopg2://…" python devtools/verify_phase3.py
# → RESULT: 67 passed, 0 failed
```

## Frontend

The React dashboard (`../gp-cctv-dashboard`) consumes this API directly: its
pages call the endpoints above through `src/services/api.ts` +
`src/hooks/useIntelligence.ts` and fall back to bundled mock fixtures when the
backend is unreachable, so the UI always renders. See that README for details.
