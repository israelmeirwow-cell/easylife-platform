#!/bin/sh
# Migrate the DB to head, then serve the API. Railway sets $PORT.
set -e

echo "→ alembic upgrade head"
alembic upgrade head

PORT="${PORT:-8000}"
echo "→ starting uvicorn on 0.0.0.0:${PORT}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
