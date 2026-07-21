"""Brief synthesis — findings in, executive brief out. ONE LLM call max.

The rule renderer always produces a complete brief from open findings + the
topline context (offline-first). When an Anthropic key + SDK exist, a single
Sonnet call rephrases/prioritizes — and a digit-guard verifies every number in
the LLM output exists in the source findings; any mismatch falls back to the
rule-rendered brief. LLM usage is metered into usage_events.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("easylife.ceo.synthesis")

from app.ceo.context import CeoContext
from app.ceo.runner import compact_finding
from app.config import settings
from app.models import Finding, UsageEvent

_SEV_HE = {"critical": "קריטי", "high": "גבוה", "medium": "בינוני", "low": "נמוך", "info": "מידע"}


def _shekels(agorot: int) -> str:
    return f"₪{round(agorot / 100):,}"


# ----------------------------- rule renderer ------------------------------ #


def rule_compose(ctx: CeoContext, findings: list[Finding]) -> dict:
    headline = (
        f"צינור פתוח של {_shekels(ctx.pipeline_value_agorot)} ב-{ctx.open_deals_count} עסקאות · "
        f"{ctx.events_last_24h} פעולות ב-24 השעות האחרונות."
    )
    highlights: list[str] = []
    risks: list[str] = []
    recommendations: list[dict] = []
    focus_now: list[str] = []

    if ctx.won_this_month_agorot > 0:
        highlights.append(f"נסגרו החודש עסקאות בשווי {_shekels(ctx.won_this_month_agorot)}.")
    if ctx.inbound_last_24h > 0:
        highlights.append(f"{ctx.inbound_last_24h} פניות נכנסות ביממה האחרונה.")

    for f in findings[:8]:
        if f.severity in ("critical", "high"):
            risks.append(f.summary_he)
        elif f.severity == "info":
            highlights.append(f.summary_he)
        if f.recommendation:
            recommendations.append(
                {
                    "title": f.recommendation.get("action_he", f.title_he),
                    "why": f.recommendation.get("why_he", ""),
                    "priority": f.recommendation.get("priority", "medium"),
                    "finding_id": str(f.id),
                }
            )

    for f in findings:
        if f.severity in ("critical", "high") and f.recommendation and len(focus_now) < 3:
            focus_now.append(f.recommendation.get("action_he", f.title_he))
    if not focus_now:
        focus_now.append("הכל תחת שליטה — אפשר להתמקד בצמיחה ובגיוס לידים חדשים.")

    return {
        "headline": headline,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "highlights": highlights[:4],
        "risks": risks[:4],
        "recommendations": recommendations[:5],
        "focus_now": focus_now[:3],
        "findings": [compact_finding(f) for f in findings],
        "source": "rules",
    }


# ------------------------------ LLM upgrade ------------------------------- #

_SYSTEM = (
    "אתה סוכן ה-CEO של Easy Life. קיבלת ממצאים מנתחים דטרמיניסטיים (המספרים בהם מדויקים). "
    "נסח תדריך מנהלים קצר וחד בעברית, לבעל עסק קטן. חוקים קשיחים: אל תמציא אף מספר, "
    "אל תמיר יחידות (דקות↔שעות) ואל תחשב מספרים חדשים — העתק מספרים אך ורק כפי שהם "
    "מופיעים בממצאים, מילה במילה; עד 3 פריטי מיקוד; כל המלצה עם סיבה. "
    'החזר JSON בלבד: {"headline": str, "highlights": [str], "risks": [str], '
    '"recommendations": [{"title": str, "why": str, "priority": "high|medium|low", "finding_id": str}], '
    '"focus_now": [str]}'
)


def _llm_ready() -> bool:
    if not settings.ANTHROPIC_API_KEY:
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def _digits_ok(output: str, source_json: str) -> bool:
    """Every multi-digit number in the LLM output must appear in the source."""
    out_nums = set(re.findall(r"\d[\d,.]*\d|\d{2,}", output.replace(",", "")))
    src = source_json.replace(",", "")
    return all(n in src for n in out_nums)


async def compose(
    session: AsyncSession, tenant_id: uuid.UUID, ctx: CeoContext, findings: list[Finding]
) -> dict:
    base = rule_compose(ctx, findings)
    if not _llm_ready() or not findings:
        return base

    source_payload = json.dumps(
        {"context": ctx.to_dict(), "findings": base["findings"]}, ensure_ascii=False
    )
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=1100,
            system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": source_payload + "\n\nכתוב את התדריך. JSON בלבד."}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
        session.add(
            UsageEvent(
                tenant_id=tenant_id,
                kind="llm",
                model="claude-sonnet-5",
                tokens_in=msg.usage.input_tokens,
                tokens_out=msg.usage.output_tokens,
                # sonnet pricing approx $3/M in, $15/M out → micros
                cost_usd_micros=int(msg.usage.input_tokens * 3 + msg.usage.output_tokens * 15),
            )
        )
        data = json.loads(text[text.find("{") : text.rfind("}") + 1])
        if not _digits_ok(json.dumps(data, ensure_ascii=False), source_payload):
            out_nums = set(
                re.findall(r"\d[\d,.]*\d|\d{2,}", json.dumps(data, ensure_ascii=False).replace(",", ""))
            )
            missing = [n for n in out_nums if n not in source_payload.replace(",", "")]
            logger.warning("digit guard rejected LLM brief; foreign numbers: %s", missing[:8])
            return base  # hallucinated/derived a number → deterministic fallback
        base.update(
            {
                "headline": data.get("headline", base["headline"]),
                "highlights": data.get("highlights", base["highlights"])[:4],
                "risks": data.get("risks", base["risks"])[:4],
                "recommendations": data.get("recommendations", base["recommendations"])[:5],
                "focus_now": data.get("focus_now", base["focus_now"])[:3],
                "source": "llm",
            }
        )
        return base
    except Exception:
        logger.exception("LLM synthesis failed; falling back to rule-rendered brief")
        return base
