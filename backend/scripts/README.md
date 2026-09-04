# Demo / Seed Data for PostgreSQL

`seed_demo_data.py` populates the project's PostgreSQL intelligence database
with a **coherent, relational, deterministic DEMO dataset** that exercises every
dashboard surface — cameras, camera health, vehicles, ANPR sightings, tracks,
cross‑camera journeys, watchlist entries/matches, alerts, evidence snapshots,
investigation cases, audit log and intelligence reports.

It is a **stand‑alone operational script**. Nothing in `scripts/` is imported by
the production runtime (`app/`). The script reuses the application's own
configuration, SQLAlchemy engine/session, ORM models and — for reports — the
application's own report service. It **never** calls the Sentinel / external CCTV
APIs and **never** starts the stream gateway, pipeline or web server.

> ⚠️ **All records are synthetic DEMO data.** Camera names/locations are
> plausible‑sounding Gujarat places but are **not** real Gujarat Police camera
> positions. Plates, people, cases, officers and descriptions are **fictitious**.
> No real credentials are stored. **No CCTV video is ever written to PostgreSQL**
> — only metadata and small placeholder JPEG *references* (see below).

---

## 1. What the script does

Fills PostgreSQL (through the existing SQLAlchemy models) in foreign‑key order:

```
roles → users → cameras → camera_health_status → vehicles → vehicle_tracks
→ anpr_sightings → journey_points → watchlist_entries → watchlist_matches
→ alerts → evidence_snapshots → investigation_cases → case_evidence
→ camera_health_events → audit_logs   (then)  → reports
```

Relationships are logically valid end‑to‑end, e.g.

```
Camera → ANPR Sighting → Vehicle → Journey Point
       → Watchlist Match → Alert → Evidence → Investigation Case
```

* Every ANPR sighting references a real camera; reliable reads reference a real
  vehicle. Uncertain/garbage reads never create a vehicle identity.
* Journeys are replayed through the **same rules** as
  `app.services.vehicle_intel._extend_journey` (gap‑split, same‑camera skip,
  haversine distance, implied speed, `> JOURNEY_MAX_SPEED_KPH` anomaly flagging).
* Watchlist matches point at real sightings + real active entries; alert
  dedupe/folding mirrors `app.services.alerts`; entry `match_count` /
  `last_match_at` and vehicle `total_sightings` / `last_seen` / `camera_count` /
  `best_confidence` are **computed from the actual rows**, not hard‑coded.
* Reports are produced by calling `app.services.reports.create_report` — the
  exact code path the API uses — so the CSVs are built from the freshly seeded
  DB and the `reports.file_path` references are real files.

Determinism: every value comes from `random.Random(20260904)`, so each run
produces the same dataset relative to “now”.

---

## 2. How to run it

From the **`backend/`** directory (so `backend/.env` and the relative
`shots/…` output dirs resolve exactly as they do for the app):

```bash
cd backend

# using the project's environment / virtualenv
python -m scripts.seed_demo_data
# or
python scripts/seed_demo_data.py
```

Both invocations work. `python -m scripts.seed_demo_data` is the canonical form
(`scripts/__init__.py` makes it a package).

**Prerequisites**

1. `DATABASE_URL` in `backend/.env` points at your PostgreSQL instance.
2. Migrations applied: `cd backend && alembic upgrade head`.
3. The database encoding is **UTF‑8** (the dataset contains `—` in human‑facing
   labels). The stock `postgres`/`postgis` Docker images are UTF‑8 by default;
   a cluster created with `SQL_ASCII` will reject those strings.

Before inserting, the script verifies the DB dialect is PostgreSQL, that the
connection works, and that all required tables exist — printing a clear
“run `alembic upgrade head`” error if any table is missing.

**Idempotency (safe to run repeatedly).** The default run *seeds or updates*:
dimension rows (roles, users, cameras, vehicles, watchlist entries) are upserted
by natural key; fact rows (sightings, tracks, journeys, matches, alerts,
evidence, cases, health events, audit) are generated **only if the demo fact
dataset does not already exist**. Running it twice therefore never duplicates
anything — the second run reports “demo fact dataset already present — …
use `--reset` to regenerate”. Reports are always regenerated (previous demo
report rows + files are replaced).

---

## 3. How to reset the demo data

```bash
cd backend
python -m scripts.seed_demo_data --reset
```

`--reset` first deletes **only demo‑marked rows** (and their generated files),
then reseeds a fresh dataset. Deletion is tightly scoped to the demo markers
below and **never touches real/production records**:

| Data                | Demo marker (deletion scope)                          |
|---------------------|-------------------------------------------------------|
| cameras             | `camera_id LIKE 'DEMO-CAM-%'`                          |
| vehicles            | `plate ~ '^GJ[0-9]{2}DE[0-9]{4}$'` (the `DE` series)   |
| anpr_sightings      | `source = 'demo_seed'`                                 |
| vehicle_tracks      | `camera_id LIKE 'DEMO-CAM-%'`                          |
| journey_points      | `vehicle_id` of a demo vehicle                         |
| watchlist_entries   | `created_by = 'demo_seed'`                             |
| watchlist_matches   | demo entry **or** demo sighting                        |
| alerts              | `dedupe_key LIKE 'demo_seed:%'`                        |
| evidence_snapshots  | `file_path LIKE 'demo/%'`                              |
| investigation_cases | `case_number LIKE 'GP-CASE-DEMO-%'`                    |
| case_evidence       | demo case                                              |
| health status/events| `camera_id LIKE 'DEMO-CAM-%'`                          |
| users / sessions    | `username LIKE 'demo\_%' AND created_by='demo_seed'`   |
| audit_logs          | `context->>'demo_seed' = 'true'` **or** demo username  |
| reports             | `created_by = 'demo_seed'`                             |
| generated files     | `shots/evidence/demo/**`, `shots/reports/RPT-…csv`     |

System **roles are never deleted** (they are shared with the real app and are
idempotently upserted, exactly like `app.services.auth.seed_roles`).

---

## 4. Tables populated

`roles`, `users`, `cameras`, `camera_health_status`, `camera_health_events`,
`vehicles`, `vehicle_tracks`, `anpr_sightings`, `journey_points`,
`watchlist_entries`, `watchlist_matches`, `alerts`, `evidence_snapshots`,
`investigation_cases`, `case_evidence`, `audit_logs`, `reports`.

`user_sessions` is **not** seeded — those are opaque refresh‑token hashes
created by real logins and are meaningless to fabricate (the schema supports it,
but seeding sessions would serve no dashboard purpose).

---

## 5. Records generated (approximate, deterministic)

| Table                 | Rows  | Notes |
|-----------------------|-------|-------|
| cameras               | 25    | Ahmedabad, Gandhinagar, Vadodara, Surat, Rajkot, Bharuch, Anand |
| camera_health_status  | 25    | 15 LIVE · 3 DEGRADED · 2 RECONNECTING · 2 OFFLINE · 1 ERROR · 2 UNKNOWN |
| camera_health_events  | ~53   | LIVE→DEGRADED→RECONNECTING→OFFLINE chains, recoveries, etc. |
| vehicles              | 75    | `GJ##DE####` plates; car / motorcycle / bus / truck |
| vehicle_tracks        | ~489  | one per camera visit + one per garbage read; ≤10‑point trajectories |
| anpr_sightings        | ~765  | ~615 reliable (OCR ≥ `ANPR_RELIABLE_CONFIDENCE`) + ~150 uncertain/garbage |
| journey_points        | ~426  | realistic legs + ~6 flagged impossible‑speed anomalies |
| watchlist_entries     | 15    | 13 active / 2 inactive; stolen, wanted, suspect, missing, traffic, others |
| watchlist_matches     | ~29   | only for real reliable sightings of active entries |
| alerts                | ~32   | WATCHLIST_MATCH, JOURNEY_ANOMALY, CAMERA_OFFLINE, CAMERA_ERROR |
| evidence_snapshots    | 25    | tiny placeholder JPEGs (metadata + reference only) |
| investigation_cases   | 7     | OPEN / IN_PROGRESS / CLOSED |
| case_evidence         | ~16   | unique (case_id, evidence_id) links |
| users                 | 4     | `demo_admin`, `demo_supervisor`, `demo_investigator`, `demo_operator` |
| audit_logs            | ~19   | logins, watchlist/case create, alert ack/resolve, evidence/case access |
| reports               | 5     | one per report type, CSV written under `shots/reports/` |

Exact counts vary slightly with the wall‑clock time the script runs (the
24 h / 7 d / 30 d activity weighting is relative to “now”) but stay within the
ranges above. The end‑of‑run summary prints the **actual DB counts**.

Demo logins (bcrypt‑hashed with the app's own `hash_password`):
`demo_admin` / `demo_supervisor` / `demo_investigator` / `demo_operator`,
password **`Demo@12345`**. These exist only so the Users/Roles screen and
audit trail have actors; with `AUTH_ENABLED=false` (dev default) the dashboard
runs in open mode and does not require them.

---

## 6. How to verify the PostgreSQL data

The script self‑verifies inside the seeding transaction (and rolls back on any
failure): referential integrity, unique constraints, vehicle/watchlist aggregate
consistency, the ANPR 20 s `(plate, camera)` dedupe window, the reliability
contract, and journey/anomaly coherence. After commit it re‑queries real counts.

Manual checks (adjust connection flags for your environment):

```bash
# Row counts
psql "$DATABASE_URL" -c "\dt"
psql "$DATABASE_URL" -c "SELECT count(*) FROM cameras WHERE camera_id LIKE 'DEMO-CAM-%';"
psql "$DATABASE_URL" -c "SELECT count(*) FROM anpr_sightings WHERE source='demo_seed';"

# Health-state mixture
psql "$DATABASE_URL" -c "SELECT state, count(*) FROM camera_health_status \
  WHERE camera_id LIKE 'DEMO-CAM-%' GROUP BY state ORDER BY 2 DESC;"

# Referential integrity (each should return 0)
psql "$DATABASE_URL" -c "SELECT count(*) FROM anpr_sightings s WHERE source='demo_seed' \
  AND NOT EXISTS (SELECT 1 FROM cameras c WHERE c.camera_id = s.camera_id);"
psql "$DATABASE_URL" -c "SELECT count(*) FROM watchlist_matches m \
  WHERE NOT EXISTS (SELECT 1 FROM anpr_sightings s WHERE s.id = m.sighting_id);"
psql "$DATABASE_URL" -c "SELECT count(*) FROM case_evidence ce \
  WHERE NOT EXISTS (SELECT 1 FROM evidence_snapshots e WHERE e.id = ce.evidence_id);"

# Aggregate consistency (should return 0)
psql "$DATABASE_URL" -c "SELECT count(*) FROM vehicles v \
  WHERE v.plate ~ '^GJ[0-9]{2}DE[0-9]{4}\$' AND v.total_sightings <> \
  (SELECT count(*) FROM anpr_sightings s WHERE s.vehicle_id = v.id);"

# Dashboard's default 24 h window has activity
psql "$DATABASE_URL" -c "SELECT count(*) FROM anpr_sightings \
  WHERE source='demo_seed' AND seen_at >= now() - interval '24 hours';"

# A coherent cross-camera journey
psql "$DATABASE_URL" -c "SELECT journey_id, sequence, camera_id, seen_at, \
  interval_seconds, distance_km, speed_kph, anomaly FROM journey_points \
  WHERE plate='GJ01DE0073' ORDER BY journey_id, sequence;"

# Generated report + evidence files exist
psql "$DATABASE_URL" -c "SELECT report_id, type, status, row_count, file_path \
  FROM reports WHERE created_by='demo_seed' ORDER BY report_id;"
ls -la shots/reports/ shots/evidence/demo/
```

To confirm the **existing API/service layer** serves this data (no Sentinel, no
web server needed) you can call the services directly:

```bash
cd backend
python -c "from app.db.session import SessionLocal; from app.services import dashboard; \
db=SessionLocal(); print(dashboard.dashboard_kpis(db, hours=24)); db.close()"
```

---

## 7. Synthetic‑data notice (repeat, because it matters)

Every row is **fictitious demo data** generated by this script:

* Camera `location_name` values end in `(DEMO)` and are **not** real Gujarat
  Police camera positions; coordinates are jittered around city centroids.
* Stream URLs point at the RFC‑2606 reserved host **`demo-cctv.invalid`** and
  carry **no credentials** — they can never reach a real network. Real stream
  URLs remain configuration‑derived via the Sentinel templates in `.env`; this
  script does not alter that architecture.
* Plates use a reserved `DE` letter series (`GJ##DE####`) so they are trivially
  distinguishable from real reads; names, officers, cases and descriptions are
  labelled `DEMO` / `synthetic`.

---

## 8. No video in PostgreSQL

Consistent with the platform's design, PostgreSQL stores **metadata and
references only** — never continuous CCTV video. The `evidence_snapshots` rows
reference small placeholder JPEG *stills* written under
`EVIDENCE_FRAMES_DIR/demo/YYYY/MM/DD/…jpg` (each a few hundred bytes: a valid
1×1 JPEG carrying a unique `DEMO-SEED` comment so `sha256` differs per record).
`reports.file_path` references CSV documents under `REPORTS_DIR`. Both are
removed by `--reset`. Bounding boxes, trajectories and journey legs are stored
as compact JSON/float columns exactly as the live pipeline stores them.

---

## Command reference

```bash
cd backend

python -m scripts.seed_demo_data            # seed or update (idempotent)
python -m scripts.seed_demo_data --reset    # delete demo data + files, then reseed
python -m scripts.seed_demo_data --help     # usage
```

Exit codes: `0` success, `1` seeding/validation error (the transaction is rolled
back and the reason is printed), `130` interrupted.
