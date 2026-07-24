# Easy Life brain (FastAPI) — production image for Railway / any Docker host.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps first (cached layer)
COPY requirements.txt .
RUN pip install -r requirements.txt

# App code + alembic
COPY . .

# Railway injects $PORT; default to 8000 locally.
EXPOSE 8000

# Run DB migrations then boot the API.
CMD ["sh", "start.sh"]
