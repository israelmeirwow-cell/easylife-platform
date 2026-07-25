"""HyperFrames composer — turns a scene_plan into a renderable video composition.

HyperFrames (HeyGen) renders an HTML document into an MP4 locally: no cloud API,
no key, no per-video cost. A composition is a plain HTML file where the root
carries `data-composition-id/start/duration/width/height`, each timed element carries
`class="clip"` + `data-start/duration/track-index`, and a PAUSED GSAP timeline is
registered on `window.__timelines[compositionId]`.

That contract means the SAME html is two things at once:
  1. the source HyperFrames renders to MP4 (`hyperframes render`), and
  2. a self-contained page the customer's browser can PLAY live — so the site can
     preview the reel with zero infra (see `playable()`).

The agent writes the composition with Claude (branded, Hebrew/RTL, on-message) and
falls back to a deterministic template that is known-good if the LLM is absent or
returns something unusable.
"""

from __future__ import annotations

import asyncio
import html
import json

from app.config import settings

GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"
WIDTH, HEIGHT, FPS = 1080, 1920, 30

# Easy Life brand (matches web/src/index.css)
BRAND = {
    "bg": "#07090E",
    "accent": "#22b8cf",
    "accent_deep": "#0e8ba0",
    "ink": "#ffffff",
    "muted": "#cbd5e1",
    "faint": "#64748b",
}

# The agent writes the COPY, not the layout.
#
# Free-form LLM-authored HTML was tried first and rejected: the model produced
# overlapping text, CSS-drawn "products" that looked amateur, and documents that
# ran past the token budget mid-tag. Constraining it to structured Hebrew copy
# that a proven, collision-free template renders is dramatically more reliable —
# and plays to what the model is actually good at (marketing Hebrew).
_COPY_SYSTEM = """\
You are the copywriter of Easy Life's video agent. You get a cinematic 3-scene
plan for a vertical ad reel of an Israeli small business, and you write the
on-screen HEBREW copy for each scene.

Return ONLY a JSON array, one object per scene, in the given order:
  kicker    short label, ~2-4 words (business name, category or teaser). May be "".
  headline  the punchy line, 2-6 words. This is the star — make it sell.
  sub       one supporting line, up to ~8 words. May be "".
  cta       ONLY on the last (cta) scene: the button text, 2-4 words. Else "".

Rules:
- Hebrew only, natural marketing Hebrew for THIS business — never translate or
  transliterate the English visual prompts; use them only as inspiration.
- Short. Text is rendered huge on a phone; long lines break the design.
- No emoji, no quotes around the text, no markdown, no explanations.
- Vary the scenes: hook grabs attention, middle sells the product, last drives action.
"""


def _fallback_copy(scenes: list[dict], product_name: str, business: str) -> list[dict]:
    out = []
    for s in scenes:
        role = s.get("role")
        if role == "hook":
            out.append({"kicker": business, "headline": product_name, "sub": "", "cta": ""})
        elif role == "cta":
            out.append({
                "kicker": "", "headline": "בואו לטעום",
                "sub": "", "cta": (s.get("overlay_text") or "").strip() or "הזמינו עכשיו",
            })
        else:
            out.append({
                "kicker": "", "headline": product_name,
                "sub": "איכות שמדברת בעד עצמה", "cta": "",
            })
    return out


async def write_copy(
    scenes: list[dict], product_name: str, business: str, brief: str
) -> tuple[list[dict], str]:
    """Hebrew on-screen copy per scene. Returns (copy, source)."""
    if not _llm_ready():
        return _fallback_copy(scenes, product_name, business), "rules"

    plan_lines = []
    for i, s in enumerate(scenes):
        plan_lines.append(
            f"scene {i} (role={s.get('role')}, {s.get('duration')}s): "
            f"{s.get('keyframe_prompt', '')[:220]}"
        )
    prompt = (
        f"Business: {business}\nProduct: {product_name}\n"
        f"Customer brief (Hebrew): {brief}\n\n"
        + "\n".join(plan_lines)
        + "\n\nWrite the on-screen Hebrew copy. JSON array only."
    )
    raw = await asyncio.to_thread(_call_llm, _COPY_SYSTEM, prompt, 1200)
    copy = _parse_copy(raw, len(scenes))
    if copy:
        # the CTA button must never be empty on the closing scene
        if not copy[-1].get("cta"):
            copy[-1]["cta"] = (scenes[-1].get("overlay_text") or "").strip() or "הזמינו עכשיו"
        return copy, "llm"
    return _fallback_copy(scenes, product_name, business), "rules"


def _parse_copy(raw: str | None, n: int) -> list[dict] | None:
    if not raw:
        return None
    try:
        start, end = raw.find("["), raw.rfind("]")
        if start == -1 or end == -1:
            return None
        data = json.loads(raw[start : end + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, list) or len(data) < n:
        return None
    out = []
    for item in data[:n]:
        if not isinstance(item, dict):
            return None
        out.append({
            "kicker": str(item.get("kicker") or "")[:40],
            "headline": str(item.get("headline") or "")[:60],
            "sub": str(item.get("sub") or "")[:80],
            "cta": str(item.get("cta") or "")[:30],
        })
    if not any(c["headline"] for c in out):
        return None
    return out


# camera-move key (generation_playbook) -> how the scene's glow/backdrop behaves.
_CAMERA_MOTION = {
    "slow_push_in": "{scale:1.28, duration:%(d)g, ease:'sine.inOut'}",
    "dolly_in": "{scale:1.3, duration:%(d)g, ease:'sine.inOut'}",
    "orbit": "{scale:1.2, rotate:14, duration:%(d)g, ease:'sine.inOut'}",
    "macro_detail": "{scale:1.35, duration:%(d)g, ease:'sine.inOut'}",
    "crane_up": "{scale:1.18, y:-70, duration:%(d)g, ease:'sine.inOut'}",
    "pull_back_reveal": "{scale:0.86, duration:%(d)g, ease:'sine.inOut'}",
    "whip_reveal": "{scale:1.22, duration:%(d)g, ease:'power2.out'}",
    "top_down_descend": "{scale:1.15, y:60, duration:%(d)g, ease:'sine.inOut'}",
}


def build_composition(scenes: list[dict], copy: list[dict], business: str) -> str:
    """Deterministic, render-verified composition: proven layout + the agent's copy.

    Layout/motion are fixed here (no LLM) so scenes can never collide or overflow;
    the agent supplies only the Hebrew text and the plan supplies the camera intent.
    """
    total = sum(int(s.get("duration") or 4) for s in scenes) or 12
    blocks: list[str] = []
    tl_lines: list[str] = []
    t = 0.0
    for i, s in enumerate(scenes):
        dur = float(s.get("duration") or 4)
        c = copy[i] if i < len(copy) else {}
        sid = f"s{i}"

        parts = []
        if c.get("kicker"):
            parts.append(f'<div class="kicker">{html.escape(c["kicker"])}</div>')
        if c.get("headline"):
            parts.append(f'<div class="headline">{html.escape(c["headline"])}</div>')
        if c.get("sub"):
            parts.append(f'<div class="sub">{html.escape(c["sub"])}</div>')
        if c.get("cta"):
            parts.append(f'<div class="cta">{html.escape(c["cta"])}</div>')
        if (s.get("role") or "") == "cta" and business:
            parts.append(f'<div class="brand">{html.escape(business)}</div>')

        blocks.append(
            f'<div id="{sid}" class="scene clip" data-start="{t:g}" '
            f'data-duration="{dur:g}" data-track-index="0">'
            f'<div class="glow" id="g{i}"></div>{"".join(parts)}</div>'
        )

        cams = s.get("camera") or []
        motion_tpl = _CAMERA_MOTION.get(cams[0] if cams else "", _CAMERA_MOTION["slow_push_in"])
        glow_tween = motion_tpl % {"d": dur}

        line = [f'tl.to("#g{i}", {glow_tween}, {t:g})']
        if c.get("kicker"):
            line.append(f'.from("#{sid} .kicker", {{opacity:0, y:30, duration:.6}}, {t + 0.1:g})')
        if c.get("headline"):
            line.append(
                f'.from("#{sid} .headline", {{opacity:0, scale:.86, duration:.9, ease:"power2.out"}}, {t + 0.25:g})'
            )
        if c.get("sub"):
            line.append(f'.from("#{sid} .sub", {{opacity:0, y:26, duration:.7}}, {t + 0.6:g})')
        if c.get("cta"):
            line.append(f'.from("#{sid} .cta", {{opacity:0, y:40, duration:.7, ease:"back.out(1.6)"}}, {t + 0.9:g})')
        if (s.get("role") or "") == "cta" and business:
            line.append(f'.from("#{sid} .brand", {{opacity:0, duration:.6}}, {t + 1.3:g})')
        # fade this scene out so the next never overlaps it
        if i < len(scenes) - 1:
            line.append(f'.to("#{sid}", {{opacity:0, duration:.4}}, {t + dur - 0.4:g})')
        tl_lines.append("".join(line) + ";")
        t += dur

    return f"""<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width={WIDTH}, height={HEIGHT}" />
<script src="{GSAP_CDN}"></script>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{WIDTH}px;height:{HEIGHT}px;overflow:hidden;background:{BRAND['bg']};
font-family:"Arial Hebrew","Heebo","Noto Sans Hebrew","Noto Sans",
"DejaVu Sans",Arial,sans-serif}}
.scene{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
justify-content:center;text-align:center;padding:90px}}
.kicker{{font-size:34px;letter-spacing:.3em;color:{BRAND['accent']};margin-bottom:28px;font-weight:700}}
.headline{{font-size:96px;font-weight:800;color:{BRAND['ink']};line-height:1.15}}
.sub{{font-size:44px;color:{BRAND['muted']};margin-top:32px}}
.cta{{margin-top:54px;padding:30px 64px;border-radius:999px;
background:linear-gradient(135deg,{BRAND['accent_deep']},{BRAND['accent']});
color:#fff;font-size:52px;font-weight:800}}
.brand{{position:absolute;bottom:90px;font-size:34px;color:{BRAND['faint']};letter-spacing:.2em}}
.glow{{position:absolute;width:900px;height:900px;border-radius:50%;
background:radial-gradient(circle,rgba(34,184,207,.28),transparent 70%)}}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total:g}"
     data-width="{WIDTH}" data-height="{HEIGHT}">
{chr(10).join(blocks)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(tl_lines)}
window.__timelines["main"] = tl;
</script>
</body>
</html>
"""


def _llm_ready() -> bool:
    if not settings.ANTHROPIC_API_KEY:
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def _call_llm(system: str, prompt: str, max_tokens: int = 20000) -> str | None:
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


async def compose(
    scenes: list[dict], product_name: str, business_name: str, brief: str = ""
) -> tuple[str, str]:
    """scene_plan -> (composition_html, source).

    `source` reports where the on-screen COPY came from ("llm" = the agent wrote
    it, "rules" = deterministic). The layout and motion are always the validated
    template, so the reel is never broken by a bad generation.
    """
    product_name = (product_name or "").strip() or "המוצר שלנו"
    business_name = (business_name or "").strip() or "העסק שלי"
    copy, source = await write_copy(scenes, product_name, business_name, brief)
    return build_composition(scenes, copy, business_name), source


# Injected only for in-browser preview: HyperFrames drives the paused timeline
# itself when rendering, so autoplay must NOT live in the stored composition.
_PLAY_SCRIPT = """
<script>
(function () {
  function start() {
    var tl = (window.__timelines || {})["main"];
    if (!tl) return;
    var root = document.getElementById("root");
    var total = parseFloat((root && root.dataset.duration) || "0") || tl.duration();
    function run() { tl.time(0); tl.play(); setTimeout(run, (total + 0.6) * 1000); }
    run();
  }
  if (document.readyState === "complete") setTimeout(start, 60);
  else window.addEventListener("load", function () { setTimeout(start, 60); });
})();
</script>
"""


def playable(composition_html: str) -> str:
    """Composition + an autoplay/loop shim, for previewing inside an iframe."""
    if "</body>" in composition_html:
        return composition_html.replace("</body>", _PLAY_SCRIPT + "</body>", 1)
    return composition_html + _PLAY_SCRIPT
