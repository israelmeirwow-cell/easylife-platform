# Easy Life — one image serving BOTH the React site and the FastAPI brain on
# the same origin (site at /, API at /api). Lives at the repo root.

# ---- stage 1: build the React frontend ----
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Default (non-demo) build → the app hits the real /api on the same origin.
RUN npm run build

# ---- stage 2: python API + baked frontend ----
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ---- video agent: HyperFrames renders the reel to MP4, in-process ----
# ffmpeg does the encode; chromium supplies the browser (and, just as importantly,
# every shared lib a downloaded Chrome would need); the Noto fonts are what make
# the Hebrew actually render instead of tofu boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg unzip chromium \
      fonts-noto-core fonts-noto-color-emoji fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Node 22 runtime lifted from the official image (no separate download).
COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Bake the CLI *and* resolve its browser at BUILD time. Without this the first
# export would fetch ~400 MB inside the request, on an ephemeral 1 GB disk.
# `browser ensure` reuses the chromium installed above when it can.
RUN npm install -g hyperframes@0.7.71 \
    && hyperframes browser ensure \
    && hyperframes browser path

# The container has 1 GB and also serves the site (idle ~85 MB). One Chrome worker
# (~256 MB) is the safe budget; app/video/renderer.py additionally allows only one
# render at a time and returns 429 rather than queueing.
#
# VIDEO_RENDER_SOFTWARE: there is no GPU here, and HyperFrames' default BeginFrame
# capture silently produces ZERO frames without one (ffmpeg then dies on "frame= 0").
# This switches it to software GL + screenshot capture — slower, but it works.
ENV VIDEO_RENDER_WORKERS=1 \
    VIDEO_RENDER_SOFTWARE=1 \
    VIDEO_RENDER_TIMEOUT=900

WORKDIR /app

COPY api/requirements.txt .
RUN pip install -r requirements.txt

COPY api/ .
# Bake the built site in and point FastAPI at it (main.py serves it when set).
COPY --from=web /web/dist ./web_dist
ENV WEB_DIST=/app/web_dist

EXPOSE 8000

# Migrate the DB to head, then serve the API + SPA.
CMD ["sh", "start.sh"]
