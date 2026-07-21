# Easy Life

**One brain, one interface.** AI-agents-as-a-service platform for Israeli SMBs: connect your channels (WhatsApp, Instagram, Facebook, Email, your store), enable pre-built agents, everything flows into one shared brain — unified inbox, CRM, live feed, approval inbox, cash-flow.

## Dev quickstart
```bash
# 1. Infrastructure
docker compose up -d          # Postgres (pgvector) :5442, Redis :6390

# 2. API
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload  # :8000  (docs: /docs)

# 3. Web
cd web
npm install
npm run dev                    # :5173
```

Demo data + fake live events: `python -m app.seed` (run inside api/ venv).

## Docs
- `CLAUDE.md` — architecture, brain schema, connector interface, conventions
- `PLAN.md` — the 6-month execution plan
