"""The CEO agent — Easy Life's central brain layer.

Reads the whole-business context (see context.py) and produces an executive
brief in Hebrew: headline, highlights, risks, prioritized recommendations, and
"what to focus on now". Works fully offline with deterministic rules; when an
Anthropic key + SDK are present it upgrades to an LLM-written brief and can
answer free-text questions ("על מה כדאי לי להתמקד הבוקר?").
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.ceo.context import CeoContext, gather_context

STAGE_HE = {
    "lead": "ליד",
    "qualified": "מוכשר",
    "proposal": "הצעה",
    "negotiation": "משא ומתן",
    "won": "נסגר בזכייה",
    "lost": "נסגר בהפסד",
}


def _shekels(agorot: int) -> str:
    return f"₪{round(agorot / 100):,}"


# ----------------------------- rule-based brief ---------------------------- #


def build_rule_brief(ctx: CeoContext) -> dict:
    highlights: list[str] = []
    risks: list[str] = []
    recommendations: list[dict] = []
    focus_now: list[str] = []

    # headline
    headline = (
        f"צינור פתוח של {_shekels(ctx.pipeline_value_agorot)} ב-{ctx.open_deals_count} עסקאות, "
        f"{ctx.events_last_24h} פעולות ב-24 השעות האחרונות."
    )

    # highlights
    if ctx.won_this_month_agorot > 0:
        highlights.append(f"נסגרו החודש עסקאות בשווי {_shekels(ctx.won_this_month_agorot)}.")
    if ctx.inbound_last_24h > 0:
        highlights.append(f"{ctx.inbound_last_24h} פניות נכנסות חדשות ביממה — הסוכנים קלטו אותן אוטומטית.")
    if ctx.closeable_deals:
        top = ctx.closeable_deals[0]
        highlights.append(
            f"העסקה הכי בשלה לסגירה: «{top['title']}» ({_shekels(top['value_agorot'])}, {STAGE_HE.get(top['stage'], top['stage'])})."
        )

    # risks
    if ctx.urgent_tickets:
        urgent = [t for t in ctx.urgent_tickets if t["priority"] == "urgent"]
        if urgent:
            risks.append(f"{len(urgent)} טיקטים דחופים פתוחים — לטפל היום כדי למנוע נטישה.")
        elif ctx.open_tickets_count:
            risks.append(f"{ctx.open_tickets_count} פניות שירות פתוחות ממתינות למענה.")
    stalled = ctx.deals_by_stage.get("negotiation", {}).get("count", 0)
    if stalled:
        val = ctx.deals_by_stage.get("negotiation", {}).get("value_agorot", 0)
        risks.append(f"{stalled} עסקאות תקועות במשא ומתן ({_shekels(val)}) — דחיפה יכולה להזיז אותן.")

    # recommendations (prioritized)
    if ctx.pending_approvals:
        recommendations.append(
            {
                "title": f"לאשר {len(ctx.pending_approvals)} החלטות שממתינות לך",
                "why": "סוכנים חוסמים פעולות (החזרים/הנחות/הסלמות) עד אישורך — כל עיכוב מעכב לקוח.",
                "priority": "high",
            }
        )
        focus_now.append(f"לעבור על {len(ctx.pending_approvals)} האישורים הממתינים")
    if ctx.closeable_deals:
        names = "»، «".join(d["title"] for d in ctx.closeable_deals[:2])
        recommendations.append(
            {
                "title": "לדחוף את העסקאות הבשלות לסגירה",
                "why": f"«{names}» בשלב הצעה/משא ומתן — הכי קרובות לכסף.",
                "priority": "high",
            }
        )
        focus_now.append(f"להתקדם עם «{ctx.closeable_deals[0]['title']}»")
    high_tasks = [t for t in ctx.open_tasks if t["priority"] == "high"]
    if high_tasks:
        recommendations.append(
            {
                "title": f"לסגור {len(high_tasks)} משימות בעדיפות גבוהה",
                "why": "משימות שסומנו קריטיות — הן חוסמות התקדמות של דברים אחרים.",
                "priority": "medium",
            }
        )
        focus_now.append(high_tasks[0]["title"])
    if ctx.urgent_tickets:
        recommendations.append(
            {
                "title": "לענות לפניות השירות הפתוחות",
                "why": "מענה מהיר מוריד נטישה ומשפר שביעות רצון.",
                "priority": "medium" if not any(t["priority"] == "urgent" for t in ctx.urgent_tickets) else "high",
            }
        )

    if not focus_now:
        focus_now.append("הכל תחת שליטה — אפשר להתמקד בצמיחה ובגיוס לידים חדשים.")

    return {
        "headline": headline,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "highlights": highlights,
        "risks": risks,
        "recommendations": recommendations,
        "focus_now": focus_now[:3],
        "source": "rules",
    }


# ------------------------------- LLM upgrade ------------------------------- #

_SYSTEM = (
    "אתה סוכן ה-CEO של Easy Life — המוח המרכזי של עסק קטן. אתה מקבל תמונת מצב "
    "מלאה (עסקאות, משימות, טיקטים, אישורים ממתינים, פעילות) ומחזיר תדריך מנהלים "
    "קצר, חד וממוקד-פעולה בעברית. דבר ישירות לבעל העסק, בלי מליצות. "
    "החזר JSON תקין בלבד עם המפתחות: headline (str), highlights (list[str]), "
    "risks (list[str]), recommendations (list of {title, why, priority in high|medium|low}), "
    "focus_now (list[str], עד 3)."
)


def _llm_ready() -> bool:
    if not settings.ANTHROPIC_API_KEY:
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def _call_llm(prompt: str, system: str, max_tokens: int = 1200) -> str | None:
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
    except Exception:
        return None


async def generate_brief(session: AsyncSession, tenant_id: uuid.UUID) -> dict:
    ctx = await gather_context(session, tenant_id)
    if _llm_ready():
        prompt = (
            "תמונת מצב העסק (JSON):\n"
            + json.dumps(ctx.to_dict(), ensure_ascii=False)
            + "\n\nכתוב את תדריך המנהלים. החזר JSON בלבד."
        )
        raw = _call_llm(prompt, _SYSTEM)
        if raw:
            try:
                data = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
                data["generated_at"] = datetime.now(timezone.utc).isoformat()
                data["source"] = "llm"
                data.setdefault("highlights", [])
                data.setdefault("risks", [])
                data.setdefault("recommendations", [])
                data.setdefault("focus_now", [])
                return data
            except (json.JSONDecodeError, ValueError):
                pass
    return build_rule_brief(ctx)


async def answer_question(session: AsyncSession, tenant_id: uuid.UUID, question: str) -> dict:
    ctx = await gather_context(session, tenant_id)
    if _llm_ready():
        prompt = (
            "תמונת מצב העסק (JSON):\n"
            + json.dumps(ctx.to_dict(), ensure_ascii=False)
            + f"\n\nשאלת בעל העסק: {question}\n\nענה בעברית, קצר וממוקד-פעולה, על בסיס הנתונים בלבד."
        )
        answer = _call_llm(
            prompt,
            "אתה סוכן ה-CEO של Easy Life. ענה בעברית בקצרה וישירות, מבוסס על הנתונים שקיבלת.",
            max_tokens=600,
        )
        if answer:
            return {"answer": answer.strip(), "source": "llm"}
    # rule-based fallback: answer from the brief's focus list
    brief = build_rule_brief(ctx)
    lines = ["הנה מה שחשוב עכשיו:"] + [f"• {f}" for f in brief["focus_now"]]
    if brief["risks"]:
        lines.append("שים לב: " + brief["risks"][0])
    return {"answer": "\n".join(lines), "source": "rules"}
