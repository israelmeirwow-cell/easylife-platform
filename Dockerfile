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

# The video agent PLANS the reel, writes its HyperFrames composition and previews
# it live in the browser — none of which needs extra runtime deps here.
#
# MP4 export is deliberately OFF in this image. HyperFrames renders by driving its
# own Chromium (~256 MB per worker) plus ffmpeg; running that in the container that
# also serves the website risks OOM-killing the site, and the CLI + browser are not
# baked in, so a first render would fetch ~400 MB at request time onto an ephemeral
# disk. Export therefore belongs in a dedicated render worker (RQ/Redis are already
# provisioned) — until then the API reports can_render=false and the UI hides export.
ENV VIDEO_RENDER_ENABLED=0

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
