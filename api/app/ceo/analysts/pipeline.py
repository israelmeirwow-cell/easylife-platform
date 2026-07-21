"""Pipeline analyst — stalled, closeable and slipping deals.

Self-calibrating: "stalled" is measured against this tenant's OWN median
time-in-stage (reconstructed from deal.stage_changed events); static fallback
thresholds apply until the tenant has enough closed-deal history (low-n rule).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from statistics import median

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ceo.registry import Analyst, FindingDraft
from app.models import Deal, Event, Lead

OPEN_STAGES = ("lead", "qualified", "proposal", "negotiation")
CLOSEABLE = ("proposal", "negotiation")

STAGE_HE = {
    "lead": "ליד",
    "qualified": "מוכשר",
    "proposal": "הצעה",
    "negotiation": "משא ומתן",
    "won": "נסגר בזכייה",
    "lost": "נסגר בהפסד",
}


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _shekels(agorot: int) -> str:
    return f"₪{round(agorot / 100):,}"


class PipelineAnalyst(Analyst):
    kind = "pipeline"
    title_he = "אנליסט צבר עסקאות"
    emits = (
        "pipeline.stalled_deal",
        "pipeline.closeable_now",
        "pipeline.aging_lead",
    )
    defaults = {
        # static fallbacks until >=min_history_n won deals give own-history medians
        "stalled_days_proposal": 7,
        "stalled_days_negotiation": 14,
        "stalled_days_other": 21,
        "stalled_own_history_factor": 1.75,  # stage time > 1.75x own median = stalled
        "min_history_n": 5,
        "aging_lead_days": 10,
        "closeable_horizon_days": 7,
        "max_findings_per_kind": 3,
    }

    async def compute(self, session: AsyncSession, tenant_id: uuid.UUID, cfg: dict) -> dict:
        now = datetime.now(timezone.utc)

        deals = (
            (await session.execute(select(Deal).where(Deal.tenant_id == tenant_id)))
            .scalars()
            .all()
        )

        # reconstruct last stage-entry per deal from deal.stage_changed events
        stage_events = (
            (
                await session.execute(
                    select(Event)
                    .where(
                        Event.tenant_id == tenant_id,
                        Event.verb.in_(("deal.stage_changed", "deal.created")),
                    )
                    .order_by(Event.ts.asc())
                )
            )
            .scalars()
            .all()
        )
        last_stage_entry: dict[str, datetime] = {}
        stage_durations: dict[str, list[float]] = {}  # stage -> [days spent] (history)
        prev_entry: dict[str, tuple[str, datetime]] = {}  # deal_id -> (stage, entered)
        for ev in stage_events:
            deal_id = ev.entity_id
            ts = _aware(ev.ts)
            if deal_id is None or ts is None:
                continue
            if ev.verb == "deal.created":
                stage = (ev.payload or {}).get("stage", "lead")
                prev_entry[deal_id] = (stage, ts)
                last_stage_entry[deal_id] = ts
                continue
            payload = ev.payload or {}
            frm, to = payload.get("from"), payload.get("to")
            if deal_id in prev_entry and frm:
                p_stage, p_ts = prev_entry[deal_id]
                if p_stage == frm:
                    stage_durations.setdefault(frm, []).append(
                        (ts - p_ts).total_seconds() / 86400
                    )
            prev_entry[deal_id] = (to or "", ts)
            last_stage_entry[deal_id] = ts

        own_median_days = {
            stage: median(vals) for stage, vals in stage_durations.items() if vals
        }
        history_n = sum(len(v) for v in stage_durations.values())

        open_deals = []
        for d in deals:
            if d.stage not in OPEN_STAGES:
                continue
            entered = last_stage_entry.get(str(d.id)) or _aware(d.created_at) or now
            days_in_stage = (now - entered).total_seconds() / 86400
            open_deals.append(
                {
                    "id": str(d.id),
                    "title": d.title,
                    "stage": d.stage,
                    "value_agorot": d.value_agorot or 0,
                    "days_in_stage": round(days_in_stage, 1),
                    "expected_close": _aware(
                        datetime.combine(d.expected_close, datetime.min.time())
                    ).isoformat()
                    if d.expected_close
                    else None,
                    "who": getattr(d, "account_name", None) or getattr(d, "contact_name", None),
                }
            )

        deal_values = [d["value_agorot"] for d in open_deals if d["value_agorot"]]
        median_deal_value = median(deal_values) if deal_values else 0

        # aging leads (leads table, stage new/contacted)
        leads = (
            (
                await session.execute(
                    select(Lead).where(
                        Lead.tenant_id == tenant_id, Lead.stage.in_(("new", "contacted"))
                    )
                )
            )
            .scalars()
            .all()
        )
        aging_leads = []
        for lead in leads:
            created = _aware(lead.created_at) or now
            age_days = (now - created).total_seconds() / 86400
            aging_leads.append(
                {
                    "id": str(lead.id),
                    "contact_id": str(lead.contact_id),
                    "stage": lead.stage,
                    "age_days": round(age_days, 1),
                    "value_agorot": lead.value_agorot or 0,
                }
            )

        return {
            "now": now.isoformat(),
            "open_deals": open_deals,
            "own_median_days": own_median_days,
            "history_n": history_n,
            "median_deal_value_agorot": median_deal_value,
            "aging_leads": aging_leads,
        }

    def detect(self, metrics: dict, cfg: dict) -> list[FindingDraft]:
        drafts: list[FindingDraft] = []
        own = metrics["own_median_days"]
        history_ok = metrics["history_n"] >= cfg["min_history_n"]
        median_value = metrics["median_deal_value_agorot"]

        # --- stalled deals -------------------------------------------------
        stalled = []
        for d in metrics["open_deals"]:
            if history_ok and d["stage"] in own:
                threshold = own[d["stage"]] * cfg["stalled_own_history_factor"]
                confidence = 1.0
            else:
                threshold = {
                    "proposal": cfg["stalled_days_proposal"],
                    "negotiation": cfg["stalled_days_negotiation"],
                }.get(d["stage"], cfg["stalled_days_other"])
                confidence = 0.7  # static fallback, not own-history
            if d["days_in_stage"] > threshold:
                stalled.append((d, threshold, confidence))

        stalled.sort(key=lambda t: t[0]["value_agorot"], reverse=True)
        for d, threshold, confidence in stalled[: cfg["max_findings_per_kind"]]:
            severity = "high" if d["value_agorot"] >= median_value and median_value > 0 else "medium"
            who = f" ({d['who']})" if d["who"] else ""
            drafts.append(
                FindingDraft(
                    kind="pipeline.stalled_deal",
                    severity=severity,
                    title_he=f"עסקה תקועה: {d['title']}",
                    summary_he=(
                        f"«{d['title']}»{who} בשווי {_shekels(d['value_agorot'])} נמצאת "
                        f"{d['days_in_stage']:.0f} ימים בשלב {STAGE_HE.get(d['stage'], d['stage'])} — "
                        f"מעבר לסף של {threshold:.0f} ימים."
                    ),
                    metrics={
                        "deal_id": d["id"],
                        "value_agorot": d["value_agorot"],
                        "days_in_stage": d["days_in_stage"],
                        "threshold_days": round(threshold, 1),
                        "stage": d["stage"],
                    },
                    evidence=[{"entity_type": "deal", "entity_id": d["id"], "role": "subject"}],
                    recommendation={
                        "action_he": f"ליצור קשר ולדחוף את «{d['title']}» — תזכורת או הצעה משופרת",
                        "why_he": "עסקאות שנוגעים בהן אחרי עצירה חוזרות לתנועה; שקט = דעיכה",
                        "priority": "high" if severity == "high" else "medium",
                    },
                    falsifiability={
                        "statement_he": "אם ניגע בעסקה ותוך 14 יום היא לא תתקדם שלב — ההמלצה הופרכה",
                        "metric": f"deal.{d['id']}.stage_advanced",
                        "baseline": 0,
                        "comparator": ">",
                        "target": 0,
                        "horizon_days": 14,
                    },
                    confidence=confidence,
                )
            )

        # --- closeable now -------------------------------------------------
        closeable = [
            d for d in metrics["open_deals"] if d["stage"] in CLOSEABLE and d["value_agorot"] > 0
        ]
        closeable.sort(key=lambda d: d["value_agorot"], reverse=True)
        top = closeable[:1]  # one headline opportunity, not a list
        for d in top:
            drafts.append(
                FindingDraft(
                    kind="pipeline.closeable_now",
                    severity="info",
                    title_he=f"הכי קרובה לכסף: {d['title']}",
                    summary_he=(
                        f"«{d['title']}» בשווי {_shekels(d['value_agorot'])} בשלב "
                        f"{STAGE_HE.get(d['stage'], d['stage'])} — העסקה הבשלה ביותר לסגירה כרגע."
                    ),
                    metrics={
                        "deal_id": d["id"],
                        "value_agorot": d["value_agorot"],
                        "stage": d["stage"],
                    },
                    evidence=[{"entity_type": "deal", "entity_id": d["id"], "role": "subject"}],
                    recommendation={
                        "action_he": "לתאם שיחת סגירה היום",
                        "why_he": "שלב הצעה/משא ומתן עם הערך הגבוה ביותר — כאן הכסף הקרוב",
                        "priority": "medium",
                    },
                    falsifiability={
                        "statement_he": "אם תוך 14 יום העסקה לא נסגרה ולא התקדמה — ההערכה הופרכה",
                        "metric": f"deal.{d['id']}.stage_advanced",
                        "baseline": 0,
                        "comparator": ">",
                        "target": 0,
                        "horizon_days": 14,
                    },
                    confidence=0.9,
                )
            )

        # --- aging leads (aggregate, not per-lead spam) --------------------
        aged = [
            lead for lead in metrics["aging_leads"] if lead["age_days"] > cfg["aging_lead_days"]
        ]
        if aged:
            total_value = sum(lead["value_agorot"] for lead in aged)
            oldest = max(lead["age_days"] for lead in aged)
            drafts.append(
                FindingDraft(
                    kind="pipeline.aging_lead",
                    severity="medium" if len(aged) >= 3 or total_value > median_value else "low",
                    title_he=f"{len(aged)} לידים מתיישנים ללא טיפול",
                    summary_he=(
                        f"{len(aged)} לידים בשלב חדש/נוצר-קשר מעל {cfg['aging_lead_days']} ימים "
                        f"(הוותיק ביותר: {oldest:.0f} ימים). לידים מתקררים מהר."
                    ),
                    metrics={
                        "count": len(aged),
                        "oldest_days": round(oldest, 1),
                        "total_value_agorot": total_value,
                        "threshold_days": cfg["aging_lead_days"],
                    },
                    evidence=[
                        {"entity_type": "lead", "entity_id": lead["id"], "role": "subject"}
                        for lead in aged[:5]
                    ],
                    recommendation={
                        "action_he": "לעבור על הלידים הישנים — לקדם או לסגור",
                        "why_he": "ליד שלא טופל שבועיים כמעט לעולם לא נסגר; ניקוי משאיר צינור אמין",
                        "priority": "medium",
                    },
                    falsifiability={
                        "statement_he": "אם אחרי טיפול הלידים לא יתקדמו/ייסגרו תוך 21 יום — הופרך",
                        "metric": "pipeline.aging_leads.count",
                        "baseline": len(aged),
                        "comparator": "<",
                        "target": len(aged),
                        "horizon_days": 21,
                    },
                    confidence=1.0,
                )
            )

        return drafts
