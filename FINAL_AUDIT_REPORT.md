# FINAL AUDIT REPORT — Gujarat Police CCTV Intelligence & Vehicle Tracking Platform

Scope: final integration, cleanup and reliability pass on the existing command-centre
application. **No unrelated features were added and the existing Gujarat Police
command-centre UI was not redesigned** — changes are confined to integration seams,
data sources, correctness and deployment config.

Date: 2026-09-03 · Branch: `arena/01a066f9-ai-powered-unified-cctv-intell`

---

## (1) Issues found

1. **API prefix inconsistency (P2/P1).** `src/services/api.ts` defaulted its REST base to
   `/api/v1`, but the FastAPI backend serves **every** route under `/api` (verified against
   the live OpenAPI route table — there is no `/api/v1`). Many `request()`-based "mock stubs"
   duplicated real endpoints or pointed at endpoints that **do not exist** (`/cameras/live`,
   `/analytics/today`, `/analytics`, `/investigations/{plate}/...`, `/reports/schedules`,
   `/reports/{id}/share`). Each of `api.ts`, `streams.ts` and `realtime.ts` re-derived the base
   independently.
2. **WebSocket client was a stub (P3).** `realtime.ts` opened a socket once at module load, had
   **no reconnect**, no connection-status surface, silently swallowed errors (documented as
   "components keep mock fallback"), and each hook opened its own socket (duplicate connections).
3. **Silent demo fallback (P1/P4).** Live View's `useGatewayLiveCameras` returned bundled demo
   `liveCameras` whenever the registry/gateway was empty, presenting fabricated "live" government
   feeds as operational data. `useAnprFeed` fell back to `anprSeed` and hard-coded
   `watchlistPlates` to mark hits as watchlist matches. No `VITE_DEMO_MODE` existed anywhere, so
   demo content was indistinguishable from production.
4. **Model ↔ migration drift (P7/P13).** Autogenerate diff (fresh DB) reported schema drift:
   redundant `Index("ix_case_evidence_evidence", "evidence_id")` in the model not present in the
   DB, and DB indexes `ix_watchlist_entries_last_match`, `ix_watchlist_matches_alert_id`,
   `ix_users_email`, `ix_alerts_dedupe_key` not declared on the models. This was cosmetic on
   running DBs but violated "models and migrations synchronized" and a clean rebuild guarantee.
5. Dead/obsolete duplicated API methods and a trailing fire-and-forget wrapper that referenced
   a removed route.
6. `BOOTSTRAP_ADMIN_EMAIL` example used `…@gujaratpolice.local`, which the backend's
   `email-validator` correctly rejects as a reserved domain (would fail admin provisioning if
   supplied verbatim).

## (2) Issues fixed

- **Unified API contract (P2).** Added a single `src/config.ts` (`API_BASE`, `DEMO_MODE`,
  `STREAM_GATEWAY`, `resolveWsUrl`). `api.ts` now targets one `/api` base, removed the dead
  `/api/v1` mock-stub methods and obsolete/duplicate helpers (all now covered by canonical real
  methods), removed the orphaned `restartCameraStream` export. All remaining methods map 1:1 to
  verified FastAPI routes and response schemas.
- **Robust realtime client (P3).** Rewrote `realtime.ts`: one shared WebSocket for the SPA,
  exponential backoff reconnect (~2 s → 30 s), connection-status pub/sub
  (`onRealtimeStatus` / `getRealtimeStatus` / `isRealtimeOpen`), reference-counted teardown on
  unmount, and frame validation against the backend's known topic set. `KNOWN_EVENTS` matches the
  backend event hub topics (`detection`, `anpr:hit`, `track`, `journey`, `watchlist:match`,
  `alert:new`, `alert:update`, `camera:state`, `camera:health`). No synthetic events generated.
- **Demo-mode gating (P1/P4).** `VITE_DEMO_MODE=false` is the default; production Docker forces it
  false. Live View + ANPR feed now render **only** real dynamic-registry/stream-gateway data in
  production and show explicit offline/empty states when the backend is unreachable; demo fixtures
  appear only when `VITE_DEMO_MODE=true` and are labelled. ANPR `watchlist` flags are derived from
  real active watchlist entries, and `synthetic` ANPR frames are dropped in production.
- **Model/migration synchronisation (P7/P13).** Removed the redundant model index and declared the
  DB indexes on the models. `alembic revision --autogenerate` against a fresh migrated DB now
  reports **zero drift**.
- **Config/secrets hygiene (P14).** Documented `VITE_*` production semantics; removed the `.local`
  admin-email example.
- Streams helper now uses the unified base and never emits RTSP (gateway HLS/WHEP opt-in only);
  cameras API verified to return only `rtsp_configured` booleans — raw RTSP URLs never reach the
  browser.

## (3) Remaining limitations (not faked — must be closed before "live" operations)

- **No genuine government RTSP / Sentinel access in this sandbox** → the Stream Gateway and the
  RTSP→FFmpeg→AI chain were **not** exercised against a real camera. Only the in-process pipeline
  plumbing was verified.
- **No genuine YOLO weights present** → the detector correctly reports `MODEL_NOT_READY` and
  produces **no** detections (verified by code path; synthetic fallback disabled in production).
- **No PostgreSQL/PostGIS or Docker daemon in the sandbox** → `docker compose up`, real PostGIS
  spatial queries, and a Postgres autogenerate diff could not be executed. Migrations were
  validated end-to-end on SQLite (`upgrade head` clean, zero autogen drift); the PostGIS path is
  gated and falls back to haversine only for local dev.
- **Residual demo fixtures:** several low-level analytics/health/report chart components still
  import bundled demo fixtures as static render baselines. The operational pages are driven by
  real hooks, but a full per-panel offline-state sweep across every chart was out of scope. These
  fixtures are not presented as confirmed government live detections and are not fed by the
  pipeline.
- RTSP transport/backoff/heartbeat, evidence retention and journey dedupe are implemented in
  backend code but not end-to-end verified against live media.

## (4) Exact changed files

```
gp-cctv-dashboard/src/config.ts                      (new)  central runtime config
gp-cctv-dashboard/src/services/api.ts                unified /api contract; removed dead/duplicate methods
gp-cctv-dashboard/src/services/realtime.ts           real shared WS client + reconnect + status
gp-cctv-dashboard/src/services/streams.ts            config-driven stream URLs; no RTSP exposure
gp-cctv-dashboard/src/hooks/useGatewayLiveCameras.ts demo-gated; real registry only in production
gp-cctv-dashboard/src/hooks/useAnprFeed.ts           demo-gated; real watchlist flags; drop synthetic
gp-cctv-dashboard/src/components/liveview/AnprFeedPanel.tsx  honest streaming/offline status
gp-cctv-dashboard/src/pages/LiveView.tsx             production-safe camera selection + offline states
gp-cctv-dashboard/.env.example / Dockerfile         VITE_DEMO_MODE/documentation
backend/app/models/{alerts,auth,investigation,watchlist}.py  model↔migration synchronisation
docker-compose.yml                                  dashboard build args (VITE_DEMO_MODE=false)
```
Also created this report. No new Alembic migration was required (schema already matches after the
model corrections).

## (5) Database migration status

- `alembic upgrade head` runs **clean from scratch** (0001 → 0004) on a fresh DB — no manual
  intervention.
- Revision chain is linear: `0001_create_cameras → 0002_vehicle_intelligence →
  0003_intelligence_ops → 0004_audit_reports`.
- Autogenerate against a fresh migrated DB now reports **zero schema drift** (models == migrations).
- **Unverified in sandbox:** Postgres/PostGIS-specific execution (no server available); full run
  command below.

## (6) API endpoint status

- All routes are under `/api/...` (85+ HTTP routes + `/api/ws`), verified by import + smoke tests.
- Open-mode smoke test: `/health`, `/api/status`, `/api/system/{health,readiness,metrics}`,
  `/api/auth/config`, `/api/cameras`, `/api/cameras/health`, `/api/gis/{cameras,summary,nearby}`,
  `/api/dashboard/kpis`, `/api/analytics/summary`, `/api/watchlist`, `/api/alerts/recent`,
  `/api/reports`, `/api/audit-logs`, `/api/vehicles/search`, `/api/detections/recent`,
  `/api/streams`, `/api/pipeline`, `/api/users`, `/api/roles`, `/api/evidence` → all `200`.
- Auth mode: unauth → `401`; valid bootstrap admin → `200/201`; read-only VIEWER write → `403`.

## (7) WebSocket status

- `/api/ws` handshake + live frame delivery verified with `hub.publish("anpr:hit", …)` reaching the
  connected client as `{event, payload}`.
- Frontend realtime client rewritten: single shared socket, exponential-backoff reconnect
  (~2–30 s), connection-status subscription, ref-counted cleanup, topic whitelist.
- Event topics emitted by the backend (detection/anpr:hit/track/journey/watchlist:match/alert:new/
  alert:update/camera:state/camera:health) all exist in the client's known-topic set.

## (8) Frontend build status

- `npx tsc -b` → clean (0 errors).
- `npm run build` with `VITE_API_BASE_URL=/api VITE_DEMO_MODE=false` → **success**.
- `npm run build` with `VITE_DEMO_MODE=true` → **success** (demo path compiles).
- `oxlint src` → 0 errors, 8 pre-existing warnings (none introduced by this pass).

## (9) Docker status

- `docker-compose.yml` parses as valid YAML; services `db` (PostGIS 16-3.4), `backend`, `dashboard`
  with healthchecks, startup dependencies and persistent volumes are correctly defined.
- Dashboard build now forces `VITE_DEMO_MODE=false`.
- **Unverified in sandbox:** an actual `docker compose up` (no Docker daemon available).

## (10) Real-government-feed verification status

**NOT verified.** No Sentinel catalogue access or government RTSP endpoint is reachable from this
environment, and none was fabricated. The frontend now correctly shows an offline/empty Live View
when the registry/gateway is unreachable rather than demo feeds. Pipeline plumbing is code-verified
only; see (3).

## (11) Genuine-YOLO-weight verification status

**NOT verified / intentionally safe.** No genuine weights are present, so `VehicleDetector`
reports `MODEL_NOT_READY` and emits **no detections** (fail-safe path confirmed). Synthetic
(architecture-only/random-weight) fallback is disabled in production and hard-labelled
`synthetic=True` in development. No fabricated government detections are possible.

## (12) Run the final application

Environment variables are documented in `.env.example` (root), `backend/.env.example` and
`gp-cctv-dashboard/.env.example`. No secrets are committed.

**Docker (production):**
```bash
cp .env.example .env            # set strong POSTGRES_PASSWORD, JWT_SECRET_KEY, BOOTSTRAP_*
# place genuine YOLO weights on the host at ./models/yolov8n.pt (mounted read-only /models)
docker compose up -d --build    # brings up db (PostGIS), backend, dashboard
#   dashboard  http://localhost        (nginx proxies /api and /api/ws to backend)
#   backend    http://127.0.0.1:8000/docs
#   migrate    docker compose exec backend alembic upgrade head
```

**Local development:**
```bash
# backend
cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg2://cctv:...@localhost:5432/cctv_intelligence
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000

# dashboard (separate terminal)
cd gp-cctv-dashboard && npm install
# .env / env: VITE_API_BASE_URL=/api  VITE_DEMO_MODE=false  VITE_WS_URL=  VITE_STREAM_GATEWAY=
npm run dev                          # http://localhost:5173  (proxies /api + /api/ws to :8000)
```

**Key production variables** (all secret/endpoint values come from the environment, never code):
`DATABASE_URL`, `POSTGRES_*`, `JWT_SECRET_KEY`/`ACCESS_TOKEN_EXPIRE_MINUTES`/`REFRESH_TOKEN_EXPIRE_DAYS`,
`BOOTSTRAP_ADMIN_USERNAME/PASSWORD/EMAIL`, `CORS_ORIGINS`, `SENTINEL_BASE_URL`/`INGEST_PATH`/`API_KEY`,
`STREAM_RTSP_TRANSPORT=tcp`, `STREAM_MAX_WORKERS`, `VEHICLE_PIPELINE_ENABLED`, `VEHICLE_MODEL_PATH=/models/yolov8n.pt`,
`VEHICLE_DEVICE`, `VEHICLE_INFER_FPS`, `VEHICLE_ALLOW_SYNTHETIC_FALLBACK=false`, `EVIDENCE_FRAMES_DIR`,
`REPORTS_DIR`, `RATE_LIMIT_ENABLED`, and (frontend build) `VITE_API_BASE_URL=/api`, `VITE_DEMO_MODE=false`,
`VITE_WS_URL`, `VITE_STREAM_GATEWAY`.
