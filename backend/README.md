# GP CCTV Intelligence — Backend

Production-ready FastAPI foundation for the Gujarat Police Unified CCTV
Intelligence Platform. The existing React dashboard is unchanged.

This layer implements:

- Environment-based configuration, CORS, structured logging
- PostgreSQL + PostGIS via SQLAlchemy 2 / Alembic
- **Camera Registry** (`cameras` table)
- Dynamic integration with the official Gujarat Police Sentinel catalogue
  **`/api/ingest`** — camera URLs are **never hard-coded**
- RTSP stream gateway (FFmpeg, TCP, exponential backoff) — YOLO / ANPR **not**
  implemented yet

## Layout

```
backend/
├─ app/
│  ├─ main.py              # FastAPI app, CORS
│  ├─ core/                # settings, logging
│  ├─ db/                  # engine, session, Base
│  ├─ models/camera.py     # Camera Registry ORM
│  ├─ schemas/             # Pydantic response models
│  ├─ services/
│  │  ├─ sentinel.py       # catalogue client, parse/normalize/validate
│  │  └─ cameras.py        # upsert + queries
│  └─ api/
│     ├─ health.py         # GET /health, GET /api/status
│     └─ cameras.py        # GET /api/cameras, GET /api/cameras/{id},
│                          # GET|POST /api/ingest
├─ alembic/                # migrations (PostGIS + cameras)
├─ docker-compose.yml      # local PostGIS
├─ .env.example            # copy to .env — never commit secrets
└─ requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and fill Sentinel credentials. Secrets stay in
`.env` (gitignored).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy URL (`postgresql+psycopg2://…`) |
| `SENTINEL_BASE_URL` | Official Sentinel origin (default `https://sentinel.gujarat.gov.in`) |
| `SENTINEL_INGEST_PATH` | Catalogue path (default `/api/ingest`) |
| `SENTINEL_API_KEY` / `SENTINEL_API_SECRET` | Catalogue auth |
| `CORS_ORIGINS` | Comma-separated frontend origins |

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

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness + database + Sentinel connectivity |
| GET | `/api/status` | Backend status (DB, Sentinel URL, camera count) |
| GET | `/api/cameras` | All Camera Registry rows |
| GET | `/api/cameras/{camera_id}` | Single camera |
| GET/POST | `/api/ingest` | Fetch Sentinel catalogue, validate, upsert registry |
| GET | `/api/streams` | All stream workers + idle registry cameras |
| GET | `/api/streams/{id}/status` | CONNECTING / LIVE / RECONNECTING / OFFLINE / ERROR |
| POST | `/api/streams/{id}/start` | Start FFmpeg worker using catalogue RTSP URL |
| POST | `/api/streams/{id}/stop` | Stop worker |
| GET | `/api/streams/{id}/frame.jpg` | Latest in-memory JPEG (Live View) |
| GET | `/api/streams/{id}/live` | MJPEG multipart for continuous preview |

`POST /api/ingest` (and GET) calls the official Sentinel `/api/ingest`
endpoint, normalizes metadata, and upserts by `camera_id`. Stream URLs
(`rtsp_url`, `webrtc_url`, `hls_url`) come only from the catalogue.

Next step: connect one government RTSP stream from a registry row for
inference — do not invent URLs.
