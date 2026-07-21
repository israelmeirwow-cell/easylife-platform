# Easy Life — CEO Analyst Library: Build-Ready Specification

Synthesis of domain research (what SMB owners act on), data reality (what our schema can compute today), and architecture research (claude-seo fan-out pattern adapted to deterministic analysts + single LLM synthesis).

**Governing principles** (from all three tracks):
- Every finding = observation → why it matters → ONE suggested action, benchmarked against the business's **own history**, never generic B2B benchmarks.
- Cap the brief at 3–5 items. Push over pull. Silence is better than noise.
- Numbers NEVER come from the LLM. Analysts are deterministic Python + SQL; the LLM appears exactly once, at synthesis, to prioritize and phrase.
- Money in agorot, everything filtered by tenant_id, every finding lands in the events feed ("if it's not in the feed, it didn't happen").
- Never say "runway" — we have no expense visibility. Say "expected collections."

---

## 1. Recommended Analyst Roster (7, ordered by value × computable-today)

### #1 — Pipeline Analyst (אנליסט צבר עסקאות / Pipeline)
**Mission:** Surface deals that are stalled, closeable, or slipping — as a short named list to act on today.

- **Inputs:** `deals` (stage, value_agorot, source_channel, created_at, expected_close); `events` verbs `deal.created`, `deal.stage_changed` (payload from/to/value_agorot), `deal.won`, `deal.lost` (ts = close date — NOT deals.created_at).
- **Computations:** per-deal time-in-current-stage (last `deal.stage_changed` ts, else created_at); pipeline value by stage; won/lost this month **by event ts** (fixes the created_at bug in dashboard.py:108 / ceo/context.py:83); own-history median stage duration per stage from event reconstruction (`payload->>'from'` JSONB query); win rate trailing 60/90d.
- **Heuristics (adapted to low volume):** stalled = time-in-stage > 1.5–2× the tenant's OWN median won-deal stage duration (Pipedrive "rotting" pattern); fallback static defaults until ≥5 won deals exist: proposal 7d, negotiation 14d. Closeable = proposal/negotiation with expected_close within 7d or highest value. Win-rate-drop only when ≥8 closed deals in window (MAD-style caution on tiny samples).
- **Findings emitted:** `pipeline.stalled_deal` (high if value ≥ tenant's median deal value, else medium); `pipeline.closeable_now` (info/medium); `pipeline.win_rate_drop` (high, only with sufficient n); `pipeline.aging_lead` (medium — leads stuck in new/contacted > threshold).
- **Degraded until fixes:** demo velocity is degenerate (seed emits all events at one instant) — needs seed backfill (§4). Works correctly for real runtime PATCH stage changes today.
- **Falsifiability:** `{metric: 'deal.<id>.stage', comparator: '==', target: won|advanced, horizon_days: 14}` — "if nudged, does the deal move within 14 days?"

### #2 — Service & Response-Time Analyst (אנליסט שירות וזמני תגובה / Service SLA)
**Mission:** Measure first-response time and unanswered-conversation backlog — the strongest published lever in SMB analytics (5-min vs 30-min = 21× qualification; WhatsApp 15-min unanswered ≈ 21× less likely to convert).

- **Inputs:** `messages` (direction, ts, conversation_id), `conversations` (status, last_msg_at, contact_id), `tickets` (status, priority, created_at); events `ticket.status_changed`, `message.received/sent`.
- **Computations:** first-response time per conversation via SQL window function (inbound → next outbound pairing — no schema change needed); median response by hour-of-day/day-of-week; unanswered backlog (open conversations whose last message is inbound, aged); ticket backlog by status/priority and age; ticket resolution time reconstructed from `ticket.status_changed` events.
- **Heuristics:** unanswered > 15 min during business hours = the headline flag (MIT/HBR-grade numbers only — never vendor-inflated stats); response-time trend vs tenant's own trailing-4-week median; urgent ticket open > 24h = high.
- **Findings emitted:** `service.unanswered_backlog` (critical if any > 2h during business hours, high if > 15 min); `service.response_time_regression` (medium — this week's median > 1.5× own baseline); `service.urgent_ticket_aging` (high); `service.resolution_slowdown` (medium).
- **Degraded:** demo message gaps are synthetic (2–9 min random); real signal arrives only with the Evolution API / WhatsApp connector. Ticket first_response/resolved only from runtime events (no columns).
- **Falsifiability:** `{metric: 'service.median_first_response_minutes', comparator: '<', target: baseline×0.7, horizon_days: 7}`.

### #3 — Approvals Analyst (אנליסט אישורים / Approvals Throughput)
**Mission:** Keep the human-in-the-loop from becoming the bottleneck — pending approvals are agent work stuck waiting on the boss.

- **Inputs:** `approvals` (status, action_type, payload, created_at, decided_at, decided_by); events `approval.requested`, `approval.decided`.
- **Computations:** pending count and age distribution; decision latency (decided_at − created_at) by action_type; approval/rejection mix.
- **Heuristics:** pending > 24h = medium, > 72h = high; a money-bearing action_type (refund, discount) pending > 24h = high regardless; rejection rate > 50% for an action_type = signal that agent config needs tuning (info finding pointed at us, not the boss).
- **Findings emitted:** `approvals.stale_pending` (high/medium by age+type); `approvals.decision_latency_up` (medium); `approvals.high_rejection_type` (info).
- **Degraded:** execution/expiry legs of the state machine are unimplemented — executed_at/result always empty; the approved→executed funnel can't be reported until an executor exists.
- **Falsifiability:** `{metric: 'approvals.pending_over_24h.count', comparator: '<=', target: 0, horizon_days: 3}`.

### #4 — Retention Analyst (אנליסט שימור לקוחות / Gone-Quiet Customers)
**Mission:** A short, value-ranked list of customers who went quiet relative to their OWN cadence — WhatsApp is also the perfect channel to send the win-back.

- **Inputs:** `conversations.last_msg_at`, `messages.ts`, `contacts` (tags, name), `activities.occurred_at`, `deals` (account/contact links, won value as customer-value proxy). Later: `documents` kind=order for true purchase cadence.
- **Computations:** per-contact inter-interaction gap distribution (median gap from messages+activities history); current silence duration; customer value proxy = sum of won deal value_agorot per contact/account.
- **Heuristics (the anti-false-alarm rule from research):** flag only when silence > 1.5–2× that contact's OWN median gap AND ≥ 14 days absolute; require ≥3 prior interactions to have a cadence at all; rank list by value, cap at 5 names. Never a fixed 30/60-day rule (floods low-frequency verticals with false alarms).
- **Findings emitted:** `retention.gone_quiet_customer` (high if top-quartile value, else medium); `retention.day14_no_second_contact` (medium — new contact, no interaction 14d after first, mirroring the decisive first-14-days window); `retention.silent_after_complaint` (high — ticket closed then silence; "stopped complaining" = 3.2× churn signal).
- **Degraded:** activity-recency proxy only — no purchase history, no repeat-order data until `documents`/orders exist. Upgrade path: same detect() logic re-pointed at order cadence.
- **Falsifiability:** `{metric: 'contact.<id>.interactions_since_flag', comparator: '>', target: 0, horizon_days: 21}` — did the win-back re-activate them?

### #5 — Lead Source Analyst (אנליסט מקורות לידים / Source Quality)
**Mission:** Which channel produces leads that become money — revenue-per-source, not lead counts (lead counts are the vanity metric).

- **Inputs:** `leads` (stage, value_agorot, source_channel), `deals` (stage, value_agorot, source_channel); events `lead.stage_changed`, `deal.won`.
- **Computations:** per source_channel: lead count, qualified rate, won value, avg deal size; period-over-period shift.
- **Heuristics:** report shares and own-trend only — with 5 leads / 10 deals, no statistical claims; findings only when a source has ≥5 outcomes; frame as "WhatsApp brought 70% of won value this month" (observation) not "Instagram is bad" (verdict).
- **Findings emitted:** `sources.top_value_source` (info, weekly); `sources.source_gone_cold` (medium — a source that historically produced leads has zero for 2× its usual interval); `sources.low_conversion_source` (low, only with n≥10).
- **Degraded:** no lead→deal FK link (conversion tracking approximate via contact_id); no UTM/campaign/cost data — CAC-per-source BLOCKED until connector-side source tagging (which must be built into message ingestion from day one — it cannot be reconstructed retroactively).
- **Falsifiability:** trend-style: `{metric: 'sources.<ch>.won_value_agorot', comparator: '>', target: prior_period, horizon_days: 30}`.

### #6 — Activity Anomaly Analyst (אנליסט חריגות פעילות / Anomalies)
**Mission:** "Something unusual happened" alerts on message/lead/deal volume — robust, quiet, holiday-aware.

- **Inputs:** `events` (verb × ts daily counts: message.received, lead.created via contact.created, deal.created, ticket.created); an Israeli holiday calendar table/constant.
- **Computations:** daily counts per verb; baseline = median of same weekday over trailing 4–8 weeks; robust z-score via MAD.
- **Heuristics (practitioner consensus for dozens-of-events data):** flag only when |robust z| > 3–3.5 AND sustained (2 consecutive days or majority of window); **total suppression until ≥4 weeks of history**; exclude/annotate Jewish holidays, erev chag, August — otherwise every chag is a fake anomaly. Single-point alerts are forbidden.
- **Findings emitted:** `anomaly.volume_drop` (high — inbound messages collapsed = possibly a broken connector, check first); `anomaly.volume_spike` (info/medium); `anomaly.channel_silent` (high — zero events from a previously active channel for 2+ days).
- **Degraded:** needs 4+ weeks of real (or backfilled) history; demo data has none.
- **Falsifiability:** `{metric: 'events.<verb>.daily_count', comparator: '>=', target: baseline_low, horizon_days: 7}` — did volume normalize?

### #7 — Cashflow Analyst (אנליסט תזרים / Expected Collections)
**Mission:** Expected cash-in by week + a prioritized invoice-chase list ("call these 3 — ₪X is 60+ days old and collection odds are dropping"). #2 in domain value but currently last because it is fully BLOCKED.

- **Inputs (after fixes §4):** `documents` (kind invoice|receipt|order, amount_agorot, direction, ts) + NEW columns contact_id/account_id, deal_id, due_date, status(paid|unpaid), doc_number; events `order.created`, `payment.received` (documented in CLAUDE.md, never emitted — start emitting).
- **Computations:** AR aging buckets (current/31–60/61–90/90+); per-customer actual payment lag (customer who always pays day 50 → model day 50, not stated terms); direct-method rolling collections forecast (4–13 weeks); revenue by week/customer.
- **Heuristics:** research-backed collection odds by bucket (current 95%+, 31–60d 85–90%, 61–90d 70–80%, 90+d <50%); red flags: 90+ bucket > 10–15% of AR, or > 20–25% of receivables past due; chase list capped at 3–5, ranked by amount × age.
- **Findings emitted:** `cashflow.invoice_chase_list` (high); `cashflow.aging_deterioration` (high — 90+ share crossed 15%); `cashflow.weekly_collections_forecast` (info, weekly digest); `cashflow.large_invoice_overdue` (critical above tenant's 90th-percentile invoice size).
- **BLOCKED:** documents table has zero rows and zero writers; schema lacks counterparty/due_date/status. Unblock = migration + seed (§4 item 3). Never present as net cash position.
- **Falsifiability:** `{metric: 'invoice.<id>.status', comparator: '==', target: paid, horizon_days: 14}` per chased invoice.

**Deferred (not in v1 roster):** Pricing/Margin analyst — no products, line items, unit prices, or COGS anywhere in the schema; deals hold one lump value. Revisit with the WooCommerce connector (catalog + line items), starting with the no-COGS tier (discount-leakage/effective-price). Also deferred: AI-cost analyst (`usage_events`) — implement the cheap fix (§4 item 4) now, add the analyst when there's a month of data. Generic funnel benchmarking — ranked lowest value / highest annoyance in research; never build.

---

## 2. Uniform Finding Schema (final)

```python
class EvidenceRef(BaseModel):
    entity_type: str           # 'deal'|'ticket'|'approval'|'contact'|'conversation'|'document'
    entity_id: str             # stringified UUID (matches events.entity_id convention)
    role: str = "subject"

class Falsifiability(BaseModel):
    statement_he: str          # human-readable "how we'd know this was wrong"
    metric: str                # dotted key, e.g. 'service.median_first_response_minutes'
    baseline: float
    comparator: Literal['<','<=','>','>=','==']
    target: float
    horizon_days: int          # machine-checkable: outcomes job re-evaluates after horizon

class Recommendation(BaseModel):
    action_he: str             # the ONE suggested action
    why_he: str
    priority: Literal['high','medium','low']
    approval_action_type: str | None = None   # set when executable via approvals machinery

class Finding(BaseModel):
    id: UUID
    tenant_id: UUID
    analyst: str               # registry kind: 'pipeline'
    kind: str                  # slug: 'pipeline.stalled_deal'
    severity: Literal['critical','high','medium','low','info']
    title_he: str
    summary_he: str            # template-rendered, contains the EXACT numbers
    metrics: dict[str, float | int | str]     # exact values; money in agorot
    evidence: list[EvidenceRef]
    recommendation: Recommendation | None
    falsifiability: Falsifiability | None
    confidence: float          # 1.0 deterministic rule; <1.0 heuristic/low-n
    window_from: datetime
    window_to: datetime
    dedupe_key: str            # sha1(tenant_id + kind + sorted primary entity ids)
    status: Literal['open','acknowledged','acted','resolved','dismissed','falsified','expired']
```

**DB:** `findings` table mirrors this (jsonb for metrics/evidence/recommendation/falsifiability) + `last_seen_at`, `outcome` jsonb `{measured_value, success, measured_at}`. Partial unique index `(tenant_id, dedupe_key) WHERE status='open'` — hourly re-runs bump `last_seen_at` instead of spamming; `finding.updated` emitted only on severity change. One Alembic migration.

---

## 3. Module Architecture

```
api/app/ceo/
├── brief.py          # existing route; becomes findings CONSUMER
├── context.py        # existing topline snapshot, unchanged (fix 'who' getattr bug)
├── schema.py         # Finding + sub-models + compact_finding() serializer
├── registry.py       # Analyst ABC: kind, title_he, requires, schedule, heavy;
│                     #   __init_subclass__ registration; enabled_for(tenant)
├── runner.py         # run_all(session, tenant_id): registry → compute → detect
│                     #   → dedupe → persist + emit finding.created (same txn); RQ wrapper
├── synthesis.py      # compose(findings, ctx): rule renderer (generalized
│                     #   build_rule_brief) + ONE Sonnet call w/ fallback + digit-check
├── outcomes.py       # daily RQ job: falsifiability re-checks → outcome events → memories
└── analysts/
    ├── __init__.py   # pkgutil auto-import (analyst #8 = new file, zero orchestrator edits)
    ├── pipeline.py   ├── service.py    ├── approvals_.py
    ├── retention.py  ├── sources.py    ├── anomaly.py    └── cashflow.py
```

**Flow:** RQ-scheduled `run_analysts(tenant_id)` (hourly + event-triggered on significant verbs) → runner iterates enabled analysts **sequentially in-process** (SQL-bound, sub-second at SMB scale — no per-analyst job fan-out; `heavy=True` escape hatch reserved) → each analyst: `compute()` exact SQL → `detect()` threshold rules → FindingDrafts → runner dedupes against open findings, persists rows AND `emit_event(verb='finding.created', payload=compact_finding)` in the same transaction → existing after_commit → EventBus → SSE delivers to feed/dashboard with zero new plumbing.

**Brief:** `GET /api/ceo/brief` = `gather_context()` topline + SELECT open findings ORDER BY severity, confidence LIMIT 20 → `synthesis.compose()`. Response gains `findings[]`; route signature unchanged.

**LLM policy:** exactly ONE Sonnet call per brief composition, consuming compact findings JSON (~2–4K tokens in, ~800 out, <$0.02 with prompt caching). Analysts have no LLM client — the expensive path is unreachable by construction. Prompt rule: "reference findings by id; copy summary_he verbatim when citing numbers" + post-check that every digit sequence in output exists in some finding; on failure → rule-rendered fallback (same pattern as today's JSONDecodeError path). Every call logged to `usage_events`. Future semantic analysts put Haiku calls INSIDE compute() producing counts/scores. Opus reserved for a future weekly deep-analysis job.

**Caching:** findings persistence IS the compute cache; Redis `ceo:brief:{tenant_id}` (TTL ~15 min) caches only the composed narrative, invalidated on `finding.created`. Redis stays non-source-of-truth.

**Config:** per-tenant thresholds in `agent_configs` (agent_kind=`ceo.analyst.<kind>`, config jsonb e.g. `{stalled_days: 14}`) — tenant-tunable, no code changes, and finally gives that dead table a purpose.

**Learning loop (outcomes.py):** daily job re-runs each acted/expired-horizon finding's falsifiability metric via the owning analyst's compute() → sets outcome jsonb → emits `finding.outcome_measured` (success→resolved, failure→falsified) → writes a business-scope `memories` row with embedding, so future synthesis/`/ask` can cite "last time we pushed stalled negotiations, 2 of 4 closed within 14 days." Per-kind hit rates (from events, no new table) calibrate confidence over time.

**New API:** `GET /api/ceo/findings`, `POST /api/ceo/findings/{id}/acknowledge|dismiss|act` (each emits its event). New event verbs: `finding.created|updated|acknowledged|acted|dismissed|resolved|falsified|outcome_measured`.

---

## 4. Cheap Data-Model Fixes To Do FIRST (ordered)

1. **Add optional `ts` param to `emit_event()`** (events.py:119) — unblocks ALL historical backfill. ~5 lines.
2. **Seed upgrade — realistic history:** backdate deal/lead `created_at` over 8–10 weeks; emit staggered intermediate `deal.stage_changed` events per deal's path; seed `tasks.due_at` (currently all NULL). Turns velocity/anomaly demos from degenerate to real-looking.
3. **Documents migration + seed:** add contact_id/account_id, deal_id, due_date, status, doc_number to `documents`; seed 2–3 months of invoices/receipts/orders with varied payment lags; emit `order.created`/`payment.received`. Unblocks the Cashflow analyst without connectors.
4. **Record `usage_events` in `_call_llm`** (ceo/brief.py:148) — token/cost attribution per tenant; the first table with genuine production data; required by CLAUDE.md anyway.
5. **Fix the "won this month" bug** — dashboard.py:103-111 and ceo/context.py:83 filter on `created_at`; switch to `deal.won` event ts (wrong for any deal living >1 month). Also fix context.py:98 `getattr(d,'account_name')` always-None bug so closeable-deal names reach the brief.
6. **(Optional, later)** `lead_id` FK on deals for true lead→deal conversion; `tickets.first_response_at/resolved_at` columns (or accept event reconstruction).

Items 1–4 ≈ one seed/emit patch + one migration; they convert Cashflow from BLOCKED and Pipeline-velocity/Anomaly from DEGRADED into demo-able.

---

## 5. Build Order — First 3 Analysts

**Phase 0:** schema.py + findings table migration + registry.py + runner.py skeleton + fixes §4 #1, #2, #5.

1. **Pipeline** — refactors rules that half-exist in context.py/brief.py today (proving the migration path for existing logic), runs on the richest seeded table, produces the "deals to nudge today" list that is the demo centerpiece, and exercises the full new machinery: event reconstruction, dedupe, feed emission, brief consumption.
2. **Service/SLA** — the #1-value analysis in all domain research and our best sales story (the agent both measures the problem and IS the fix via auto-reply); computable now from messages ts pairing with zero schema change; validates a second analyst added with zero orchestrator edits (registry claim).
3. **Approvals** — trivially computable, uniquely OURS (no competitor sees this data), and its acknowledge/dismiss/act flow is the input the learning loop needs — building it third means outcome capture is real before outcomes.py ships.

Then: rule-rendered brief consumer → single-call synthesis → Retention + Sources + Anomaly → fix §4 #3 → Cashflow → outcomes.py. Steps through the first three ship value with **zero LLM dependency**, preserving the CEO module's offline-first behavior.

---

## 6. Open Questions for the Founder (max 4)

1. **Vertical focus for v1 demo & thresholds:** fashion/retail (מאניה ג'ינס — long purchase cadence, retention thresholds in weeks) or service businesses (short cadence, SLA-dominant)? Default thresholds and the demo seed story should match one vertical well rather than two poorly.
2. **Brief delivery channel:** the research is unambiguous that push-to-WhatsApp beats dashboard — but that requires outbound WhatsApp sending (Evolution API) before a connector exists for customers. Ship dashboard+SSE first and add WhatsApp push in phase 2, or pull the WhatsApp send-only channel forward?
3. **LLM key now or later:** phases 1–3 work fully rule-rendered. Enable ANTHROPIC_API_KEY synthesis (and its per-tenant cost) from day one for demo polish, or launch offline-first and add synthesis when the first paying tenant lands?
4. **Demo backfill vs first real connector:** invest the next block of effort in the synthetic-history seed (makes ALL analysts demo beautifully to prospects) or in the first real connector (WooCommerce or Evolution API — makes ONE tenant's data real, and source tagging must be built into ingestion from day one since attribution can't be reconstructed retroactively)?