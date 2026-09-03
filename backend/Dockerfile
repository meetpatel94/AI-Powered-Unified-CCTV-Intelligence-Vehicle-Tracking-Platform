# syntax=docker/dockerfile:1
#
# GP CCTV Intelligence — FastAPI backend image.
#
# Multi-stage: heavy ML wheels are installed in the builder so the final
# runtime image is as small as possible. System ffmpeg is installed for RTSP
# decoding (H.264/H.265); imageio-ffmpeg remains a wheel-bundled fallback.
#
# Secrets are NEVER baked in — all configuration comes from environment
# variables at run time (see .env.example / docker-compose.yml).
#
FROM python:3.11-slim-bookworm AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

# Install build dependencies for opencv/numpy/shapely wheels that need them.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install into a distinct prefix we can copy into the runtime stage.
RUN pip install --prefix=/install -r requirements.txt


# --------------------------------------------------------------------------- #
FROM python:3.11-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/install/bin:$PATH" \
    PYTHONPATH=/app

# Runtime system libraries: ffmpeg (RTSP H.264/H.265 decode) + OpenCV runtime
# libs. No compilers in the final image.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root runtime user.
RUN useradd --create-home --uid 10001 appuser

# Copy installed Python packages from the builder.
COPY --from=builder /install /usr/local

WORKDIR /app
COPY . /app

# Volumes for evidence frames + generated reports (persisted by compose).
RUN mkdir -p /app/shots/evidence /app/shots/reports \
    && chown -R appuser:appuser /app/shots /app
USER appuser

EXPOSE 8000

# Container health/readiness: readiness gating depends on the DB being ready.
HEALTHCHECK --interval=15s --timeout=8s --start-period=40s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/api/system/readiness || exit 1

# Run database migrations then launch the API. Migrations are idempotent and
# gated by the compose `depends_on` health check of PostgreSQL/PostGIS.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
