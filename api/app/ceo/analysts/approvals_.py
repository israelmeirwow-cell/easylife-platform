"""Approvals analyst — keep the boss from becoming the bottleneck.

Pending approvals are agent work stuck waiting on a human decision; money-
bearing action types (refund/discount) escalate faster. A high rejection rate
for an action type is a signal pointed at US (agent config needs tuning), not
at the boss.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ceo.registry import Analyst, FindingDraft
from app.models import Approval

MONEY_ACTION_TYPES = ("refund", "discount", "send_discount", "cancel_order", "payment")


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


class ApprovalsAnalyst(Analyst):
    kind = "approvals"
    title_he = "אנליסט אישורים"
    emits = (
        "approvals.stale_pending",
        "approvals.high_rejection_type",
    )
    defaults = {
        "stale_hours_medium": 24,
        "stale_hours_high": 72,
        "money_stale_hours": 24,
        "rejection_rate_threshold": 0.5,
        "rejection_min_n": 4,
        "history_days": 30,
    }

    async def compute(self, session: AsyncSession, tenant_id: uuid.UUID, cfg: dict) -> dict:
        now = datetime.now(timezone.utc)
        since = now - timedelta(days=cfg["history_days"])

        pending = (
            (
                await session.execute(
                    select(Approval).where(
                        Approval.tenant_id == tenant_id, Approval.status == "pending"
                    )
                )
            )
            .scalars()
            .all()
        )
        pending_rows = []
        for a in pending:
            age_h = (now - (_aware(a.created_at) or now)).total_seconds() / 3600
            pending_rows.append(
                {
                    "id": str(a.id),
                    "action_type": a.action_type,
                    "preview_text": a.preview_text,
                    "age_hours": round(age_h, 1),
                    "is_money": a.action_type in MONEY_ACTION_TYPES,
                }
            )
        pending_rows.sort(key=lambda r: r["age_hours"], reverse=True)

        decided = (
            (
                await session.execute(
                    select(Approval).where(
                        Approval.tenant_id == tenant_id,
                        Approval.status.in_(("approved", "rejected", "executed", "failed")),
                        Approval.created_at >= since,
                    )
                )
            )
            .scalars()
            .all()
        )
        by_type: dict[str, dict] = {}
        for a in decided:
            b = by_type.setdefault(a.action_type, {"n": 0, "rejected": 0})
            b["n"] += 1
            if a.status == "rejected":
                b["rejected"] += 1

        return {"pending": pending_rows, "decided_by_type": by_type}

    def detect(self, metrics: dict, cfg: dict) -> list[FindingDraft]:
        drafts: list[FindingDraft] = []

        stale = [
            p
            for p in metrics["pending"]
            if p["age_hours"] > (cfg["money_stale_hours"] if p["is_money"] else cfg["stale_hours_medium"])
        ]
        if stale:
            worst = stale[0]
            any_money = any(p["is_money"] for p in stale)
            severity = (
                "high"
                if any_money or worst["age_hours"] > cfg["stale_hours_high"]
                else "medium"
            )
            drafts.append(
                FindingDraft(
                    kind="approvals.stale_pending",
                    severity=severity,
                    title_he=f"{len(stale)} אישורים מחכים לך",
                    summary_he=(
                        f"{len(stale)} החלטות ממתינות לאישורך (הוותיקה: {worst['age_hours']:.0f} שעות — "
                        f"«{worst['preview_text'][:60]}»). "
                        + ("חלקן כספיות — הלקוח מחכה." if any_money else "הסוכנים חסומים עד החלטה.")
                    ),
                    metrics={
                        "count": len(stale),
                        "oldest_hours": worst["age_hours"],
                        "money_count": sum(1 for p in stale if p["is_money"]),
                    },
                    evidence=[
                        {"entity_type": "approval", "entity_id": p["id"], "role": "subject"}
                        for p in stale[:5]
                    ],
                    recommendation={
                        "action_he": "לפתוח את תיבת האישורים ולהחליט — דקה לכל החלטה",
                        "why_he": "כל שעה של המתנה היא לקוח שמחכה וסוכן שעומד",
                        "priority": "high" if severity == "high" else "medium",
                    },
                    falsifiability={
                        "statement_he": "אם אחרי טיפול יישארו אישורים מעל יממה תוך 3 ימים — הופרך",
                        "metric": "approvals.pending_over_24h.count",
                        "baseline": len(stale),
                        "comparator": "<=",
                        "target": 0,
                        "horizon_days": 3,
                    },
                    confidence=1.0,
                )
            )

        for action_type, b in metrics["decided_by_type"].items():
            if b["n"] >= cfg["rejection_min_n"]:
                rate = b["rejected"] / b["n"]
                if rate > cfg["rejection_rate_threshold"]:
                    drafts.append(
                        FindingDraft(
                            kind="approvals.high_rejection_type",
                            severity="info",
                            title_he=f"אתם דוחים את רוב בקשות ה-{action_type}",
                            summary_he=(
                                f"{b['rejected']} מתוך {b['n']} בקשות «{action_type}» נדחו בחודש האחרון "
                                f"({rate:.0%}). כנראה שהסוכן מציע את זה מוקדם מדי — שווה לכוון את ההגדרות."
                            ),
                            metrics={
                                "action_type": action_type,
                                "n": b["n"],
                                "rejected": b["rejected"],
                                "rate": round(rate, 2),
                            },
                            evidence=[],
                            recommendation={
                                "action_he": f"לעדכן את כללי הסוכן לגבי {action_type} (מתי מותר להציע)",
                                "why_he": "פחות בקשות סרק = פחות הפרעות לך ותשובות מהירות ללקוח",
                                "priority": "low",
                            },
                            falsifiability={
                                "statement_he": "אם אחרי כיוון שיעור הדחייה לא ירד מתחת ל-50% תוך 30 יום — הופרך",
                                "metric": f"approvals.rejection_rate.{action_type}",
                                "baseline": round(rate, 2),
                                "comparator": "<",
                                "target": cfg["rejection_rate_threshold"],
                                "horizon_days": 30,
                            },
                            confidence=0.85,
                        )
                    )

        return drafts
