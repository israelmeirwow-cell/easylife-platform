# Easy Life — Platform CLAUDE.md

SaaS platform: a library of pre-built AI agents that Israeli SMB owners connect to their business self-serve. **One brain, one interface.** Hebrew/RTL first.

## Monorepo layout
```
api/        FastAPI backend (Python 3.12) — the brain, connectors, agents runtime
web/        React SPA (Vite + TS + Tailwind), RTL, PWA — the dashboard
agents/     Agent packages (manifest.yaml + config.schema.json + runtime) — added from Week 4
deploy/     Docker compose (prod/staging), CI deploy scripts
docs/       Runbooks, connection guides (Hebrew)
```

## Core principle: THE ONE BRAIN
All agents and humans share the same Postgres state. **There is no agent-to-agent messaging.** An agent "knows" what others did by reading `events` (timeline) + `memories` (pgvector semantic search). The dashboard feed, contact timeline, and agent context are the same `events` table read three ways.

Every state change MUST:
1. Write its domain row (message/lead/approval/...) AND an `events` row **in the same transaction**
2. Never delete from `events` (append-only)

## Brain schema (all tables carry `tenant_id`, `created_at`)
- `tenants` (name, plan, settings jsonb)
- `users` (email, role: owner|staff, wa_phone, push_subscription jsonb)
- `channels` (kind: whatsapp|instagram|facebook|email|woocommerce|shopify|grow|greeninvoice, status, credentials_encrypted, meta jsonb)
- `contacts` (name, phones[], emails[], handles jsonb, tags[], notes, custom jsonb) — auto-created from any inbound message, merged by phone/email
- `conversations` (contact_id, channel_id, status: open|pending|closed, assignee: agent|human, last_msg_at)
- `messages` (conversation_id, direction: in|out, sender_type: contact|agent|human, body, media jsonb, channel_msg_id, ts)
- `leads` (contact_id, stage: new|contacted|qualified|won|lost, value_agorot, source_channel, owner)
- `tasks` (title, due_at, status, contact_id?, created_by)
- `approvals` (requested_by_agent, action_type, payload jsonb, preview_text, status: pending|approved|rejected|expired|executed|failed, decided_by, decided_at, executed_at, result jsonb)
- `events` (BIGSERIAL, actor_type: agent|human|system|contact, actor_id, verb, entity_type, entity_id, payload jsonb, ts) — **APPEND-ONLY**
- `memories` (scope: contact|business|global, entity_id?, text, embedding vector(1024), source_event_id, importance, ts)
- `agent_configs` (agent_kind, config jsonb, guardrails jsonb, status: draft|active|paused, version)
- `documents` (kind: invoice|receipt|order, source_channel, amount, currency, direction: in|out, ts) — cash-flow feed
- `usage_events` (kind: llm|transcription|embedding, model, tokens_in, tokens_out, cost_usd_micros, ts) — metering/quotas/billing

Event verbs use `entity.verb` form: `message.received`, `message.sent`, `lead.seen`, `lead.stage_changed`, `approval.requested`, `approval.decided`, `order.created`, `payment.received`, `memory.written`.

**Event flow:** insert into `events` → trigger `pg_notify('events', tenant_id)` → (a) SSE hub pushes to the tenant's open dashboards; (b) dispatcher enqueues RQ jobs for subscribed agents.

**Approval state machine:** pending → approved → executed|failed; pending → rejected; pending → expired (timeout → escalation). Every transition emits an event. Boss approves via dashboard inbox, web push, or WhatsApp reply "1"/"2".

## Connector interface (api/app/connectors/)
```python
class ChannelConnector:
    kind: str
    async def connect(self, channel: Channel) -> None            # setup/pairing
    def verify_webhook(self, request) -> bool                    # signature check
    def normalize_inbound(self, payload) -> NormalizedMessage    # channel payload → common shape
    async def send_outbound(self, channel, message) -> str       # returns channel_msg_id
    async def health(self, channel) -> ChannelHealth
```
Webhook ingress: `POST /webhooks/{channel_kind}/{connection_id}` → look up channel → verify → normalize → contacts auto-create/merge → messages + events (one txn). Agents and humans NEVER see channel-specific payloads.

Channels: WhatsApp = Evolution API v2 (customer's own number, QR pairing) + Meta Cloud API (official tier). IG/FB = Meta Graph API direct (one Meta app). Email = Gmail API OAuth polling / generic IMAP; platform outbound = Resend. Store = WooCommerce REST (port from `../whatsapp_agent/app/woocommerce/`), Shopify later. Cash-flow = Green Invoice API + Grow webhooks + store orders + manual/CSV. NO bank feeds.

## Stack decisions (settled — do not relitigate)
- Backend: FastAPI + SQLAlchemy 2 (async) + Alembic; RQ + rq-scheduler on Redis (NOT Celery); SSE via sse-starlette (NOT WebSockets)
- DB: Postgres 16 + pgvector, single DB, `tenant_id` filtering enforced in the repository layer (RLS deferred). Redis is never a source of truth
- Frontend: React 18 + Vite + TS + Tailwind (RTL, luxury-dark champagne-gold-on-charcoal theme), TanStack Query, ECharts for charts, PWA via vite-plugin-pwa. NOT Next.js, NOT HTMX
- AI: Claude tiered (Haiku classify / Sonnet converse+summarize / Opus weekly analysis) + prompt caching; Voyage embeddings; Groq Whisper transcription. Platform-owned API keys; per-tenant cost attribution in `usage_events`
- Secrets: `channels.credentials_encrypted` via Fernet, master key in env
- Billing: Grow (Meshulam) recurring + Green Invoice invoices (Israeli market)

## Conventions
- Hebrew UI, English code/comments. All UI strings RTL-safe (use logical CSS properties `ms-`/`me-`)
- Money in agorot (int), field names `amount_agorot`; costs in `usd_micros` for LLM metering
- Timestamps: timestamptz UTC in DB, displayed Asia/Jerusalem
- Every new feature that touches state emits events — if it's not in the feed, it didn't happen
- Cross-tenant isolation tests are sacred: they run in CI and block deploy on failure
- Tests: pytest (api), vitest (web). Port the 49-test discipline from `../whatsapp_agent/tests/`

## Reference assets (read-only, do not modify)
- `../whatsapp_agent/` — production agent; `app/brain/agent.py` ports onto the shared brain (Week 4), `app/handoff/escalation.py` → approval service, `app/analytics/costs.py` → usage_events
- `../orchestrator_agents/web/app.py` — approval-gate + SSE UI pattern
- `../lead_agent/agent_graph.py` — agent #2 (Month 3)
- Full 6-month plan: `PLAN.md`
