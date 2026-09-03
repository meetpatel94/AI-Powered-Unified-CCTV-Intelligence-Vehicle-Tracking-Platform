# syntax=docker/dockerfile:1
#
# GP CCTV Intelligence — React/TypeScript dashboard image.
# Builds the Vite production bundle and serves it via nginx. The nginx config
# (docker/nginx.conf) proxies /api (incl. the /api/ws WebSocket) to the
# backend service and serves static assets — the browser never needs to know
# the backend address. No secrets are baked into the image.
#
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time API base. The app defaults to same-origin /api which nginx proxies.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build


# --------------------------------------------------------------------------- #
FROM nginx:1.27-alpine AS runtime

# Security-oriented default config + reverse proxy to the backend.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
