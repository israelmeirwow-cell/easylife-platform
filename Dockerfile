# Easy Life brain (FastAPI) — production image for Railway.
# Lives at the REPO ROOT (not api/) so the build works regardless of whether
# Railway's "root directory" service setting is honored — this Dockerfile
# explicitly scopes its build context to api/ via COPY.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps first (cached layer)
COPY api/requirements.txt .
RUN pip install -r requirements.txt

# App code + alembic (only the api/ subtree)
COPY api/ .

# Railway injects $PORT; default to 8000 locally.
EXPOSE 8000

# Run DB migrations then boot the API.
CMD ["sh", "start.sh"]
