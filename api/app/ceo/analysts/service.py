"""Service analyst — first-response times and unanswered-conversation backlog.

The strongest published SMB lever: minutes-fast replies convert dramatically
better. Flags unanswered inbound conversations and response-time regressions
vs the tenant's own trailing baseline.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from statistics import median

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ceo.registry import Analyst, FindingDraft
from app.models import Conversation, Message, Ticket


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


class ServiceAnalyst(Analyst):
    kind = "service"
    title_he = "אנליסט שירות וזמני תגובה"
    emits = (
        "service.unanswered_backlog",
        "service.response_time_regression",
        "service.urgent_ticket_aging",
    )
    defaults = {
        "unanswered_minutes_high": 15,
        "unanswered_minutes_critical": 120,
        "regression_factor": 1.5,  # this week's median > 1.5x own 4-week baseline
        "min_pairs_for_baseline": 8,
        "urgent_ticket_hours": 24,
        "window_days": 7,
        "baseline_days": 28,
    }

    async def compute(self, session: AsyncSession, tenant_id: uuid.UUID, cfg: dict) -> dict:
        now = datetime.now(timezone.utc)
        since = now - timedelta(days=cfg["baseline_days"])

        msgs = (
            (
                await session.execute(
                    select(Message)
                    .where(Message.tenant_id == tenant_id, Message.ts >= since)
                    .order_by(Message.conversation_id, Message.ts.asc())
                )
            )
            .scalars()
            .all()
        )

        # first-response pairing: inbound -> next outbound in same conversation
        pairs: list[tuple[datetime, float]] = []  # (inbound ts, response minutes)
        pending_inbound: dict[str, datetime] = {}
        last_inbound: dict[str, datetime] = {}
        last_direction: dict[str, str] = {}
        for m in msgs:
            conv = str(m.conversation_id)
            ts = _aware(m.ts)
            if ts is None:
                continue
            if m.direction == "in":
                pending_inbound.setdefault(conv, ts)
                last_inbound[conv] = ts
            else:
                started = pending_inbound.pop(conv, None)
                if started is not None:
                    pairs.append((started, (ts - started).total_seconds() / 60))
            last_direction[conv] = m.direction

        week_ago = now - timedelta(days=cfg["window_days"])
        week_pairs = [mins for ts, mins in pairs if ts >= week_ago]
        base_pairs = [mins for ts, mins in pairs if ts < week_ago]
        median_week = median(week_pairs) if week_pairs else None
        median_base = median(base_pairs) if base_pairs else None

        # unanswered: open conversations whose last message is inbound
        open_convs = (
            (
                await session.execute(
                    select(Conversation).where(
                        Conversation.tenant_id == tenant_id,
                        Conversation.status.in_(("open", "pending")),
                    )
                )
            )
            .scalars()
            .all()
        )
        unanswered = []
        for c in open_convs:
            conv_id = str(c.id)
            if last_direction.get(conv_id) == "in":
                waited_min = (now - last_inbound[conv_id]).total_seconds() / 60
                unanswered.append(
                    {
                        "conversation_id": conv_id,
                        "contact_id": str(c.contact_id),
                        "waiting_minutes": round(waited_min, 1),
                    }
                )
        unanswered.sort(key=lambda u: u["waiting_minutes"], reverse=True)

        urgent_tickets = (
            (
                await session.execute(
                    select(Ticket).where(
                        Ticket.tenant_id == tenant_id,
                        Ticket.status.in_(("new", "open", "pending")),
                        Ticket.priority == "urgent",
                    )
                )
            )
            .scalars()
            .all()
        )
        aging_urgent = []
        for t in urgent_tickets:
            age_h = (now - (_aware(t.created_at) or now)).total_seconds() / 3600
            if age_h > cfg["urgent_ticket_hours"]:
                aging_urgent.append(
                    {"ticket_id": str(t.id), "subject": t.subject, "age_hours": round(age_h, 1)}
                )

        return {
            "median_response_week_min": round(median_week, 1) if median_week is not None else None,
            "median_response_baseline_min": round(median_base, 1) if median_base is not None else None,
            "pairs_week_n": len(week_pairs),
            "pairs_baseline_n": len(base_pairs),
            "unanswered": unanswered,
            "aging_urgent_tickets": aging_urgent,
        }

    def detect(self, metrics: dict, cfg: dict) -> list[FindingDraft]:
        drafts: list[FindingDraft] = []

        # --- unanswered backlog (the headline) -----------------------------
        over_high = [
            u for u in metrics["unanswered"] if u["waiting_minutes"] > cfg["unanswered_minutes_high"]
        ]
        if over_high:
            worst = over_high[0]["waiting_minutes"]
            critical = worst > cfg["unanswered_minutes_critical"]
            hours = worst / 60
            worst_he = f"{hours:.1f} שעות" if worst >= 90 else f"{worst:.0f} דקות"
            drafts.append(
                FindingDraft(
                    kind="service.unanswered_backlog",
                    severity="critical" if critical else "high",
                    title_he=f"{len(over_high)} שיחות ממתינות למענה",
                    summary_he=(
                        f"{len(over_high)} שיחות פתוחות שההודעה האחרונה בהן היא של הלקוח, "
                        f"מעל {cfg['unanswered_minutes_high']} דקות ללא מענה (הארוכה ביותר: {worst_he}). "
                        f"מענה מהיר הוא המנוף החזק ביותר להמרה."
                    ),
                    metrics={
                        "count": len(over_high),
                        "worst_waiting_minutes": worst,
                        "threshold_minutes": cfg["unanswered_minutes_high"],
                    },
                    evidence=[
                        {"entity_type": "conversation", "entity_id": u["conversation_id"], "role": "subject"}
                        for u in over_high[:5]
                    ],
                    recommendation={
                        "action_he": "לענות עכשיו לשיחות הממתינות — או להפעיל מענה אוטומטי של הסוכן",
                        "why_he": "לקוח שלא נענה רבע שעה מתקרר; זה בדיוק מה שסוכן הווצאפ פותר",
                        "priority": "high",
                    },
                    falsifiability={
                        "statement_he": "אם אחרי מענה לא תיפתח תנועה בשיחות תוך 7 ימים — הופרך",
                        "metric": "service.unanswered.count",
                        "baseline": len(over_high),
                        "comparator": "<",
                        "target": len(over_high),
                        "horizon_days": 7,
                    },
                    confidence=1.0,
                )
            )

        # --- response-time regression vs own baseline ----------------------
        mw, mb = metrics["median_response_week_min"], metrics["median_response_baseline_min"]
        if (
            mw is not None
            and mb is not None
            and metrics["pairs_week_n"] >= cfg["min_pairs_for_baseline"]
            and metrics["pairs_baseline_n"] >= cfg["min_pairs_for_baseline"]
            and mw > mb * cfg["regression_factor"]
        ):
            drafts.append(
                FindingDraft(
                    kind="service.response_time_regression",
                    severity="medium",
                    title_he="זמן התגובה שלכם הואט",
                    summary_he=(
                        f"חציון זמן התגובה השבוע: {mw:.0f} דקות, לעומת {mb:.0f} דקות "
                        f"בממוצע שלכם ב-4 השבועות הקודמים — האטה של פי {mw / mb:.1f}."
                    ),
                    metrics={
                        "median_week_min": mw,
                        "median_baseline_min": mb,
                        "factor": round(mw / mb, 2),
                    },
                    evidence=[],
                    recommendation={
                        "action_he": "לבדוק מה השתנה — עומס? היעדרות? ולהחזיר את הקצב",
                        "why_he": "האטה בזמני מענה מקדימה ירידה בהמרות ושביעות רצון",
                        "priority": "medium",
                    },
                    falsifiability={
                        "statement_he": f"אם החציון לא ירד מתחת ל-{mb * cfg['regression_factor']:.0f} דקות תוך 7 ימים — עדיין רגרסיה",
                        "metric": "service.median_first_response_minutes",
                        "baseline": mw,
                        "comparator": "<",
                        "target": round(mb * cfg["regression_factor"], 1),
                        "horizon_days": 7,
                    },
                    confidence=0.9,
                )
            )

        # --- urgent tickets aging ------------------------------------------
        for t in metrics["aging_urgent_tickets"][:3]:
            drafts.append(
                FindingDraft(
                    kind="service.urgent_ticket_aging",
                    severity="high",
                    title_he=f"טיקט דחוף פתוח {t['age_hours']:.0f} שעות",
                    summary_he=(
                        f"«{t['subject']}» מסומן דחוף ופתוח כבר {t['age_hours']:.0f} שעות "
                        f"(מעל הסף של {cfg['urgent_ticket_hours']} שעות)."
                    ),
                    metrics={
                        "ticket_id": t["ticket_id"],
                        "age_hours": t["age_hours"],
                        "threshold_hours": cfg["urgent_ticket_hours"],
                    },
                    evidence=[{"entity_type": "ticket", "entity_id": t["ticket_id"], "role": "subject"}],
                    recommendation={
                        "action_he": "לטפל בטיקט הדחוף היום",
                        "why_he": "תלונה דחופה שמזדקנת היא הסיכון הגדול ביותר לנטישה",
                        "priority": "high",
                    },
                    falsifiability={
                        "statement_he": "אם הטיקט ייסגר תוך 3 ימים והלקוח יגיב — טופל; אחרת הופרך",
                        "metric": f"ticket.{t['ticket_id']}.resolved",
                        "baseline": 0,
                        "comparator": ">",
                        "target": 0,
                        "horizon_days": 3,
                    },
                    confidence=1.0,
                )
            )

        return drafts
