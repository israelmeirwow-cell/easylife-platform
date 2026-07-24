"""Video planner — turns a brief + product into an executable 3-scene scene_plan.

This is the video agent's cinematic BRAIN. It feeds the customer's brief (usually
Hebrew) + the approved cinematic vocabulary from `generation_playbook.py` to Claude
(claude-sonnet-5) and gets back a structured `scene_plan`: 3 scenes (hook / product
/ cta), each with a keyframe prompt, a motion/video prompt, camera moves and a
duration. It runs TODAY with only ANTHROPIC_API_KEY set — keyframe/video RENDERING
(Higgsfield i2v + HyperFrames overlay) is a later provider stage.

Mirrors the CEO agent (app/ceo/brief.py): if no key / the SDK is missing / the JSON
fails to parse, it falls back to the deterministic `default_plan()` so the pipeline
always returns a usable plan.
"""

from __future__ import annotations

import asyncio
import json

from app.config import settings
from app.video.generation_playbook import (
    CAMERA_MOVES,
    LIGHTING,
    LOOK,
    PLANNER_SYSTEM_PROMPT,
    SCENE_ROLE_TEMPLATES,
    default_plan,
)

_ROLES = ("hook", "product", "cta")


def _llm_ready() -> bool:
    if not settings.ANTHROPIC_API_KEY:
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def _call_llm(system: str, prompt: str, max_tokens: int = 1600) -> str | None:
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


def _normalize_scene(raw: dict, role: str) -> dict:
    """Coerce one LLM scene object into the scene_plan shape used downstream."""
    tpl = SCENE_ROLE_TEMPLATES[role]
    camera = raw.get("camera")
    if isinstance(camera, str):
        camera = [camera]
    elif not isinstance(camera, list):
        camera = list(tpl["camera"][:1])
    duration = raw.get("duration")
    try:
        duration = int(duration)
    except (TypeError, ValueError):
        duration = tpl["duration_s"]
    scene = {
        "role": role,
        "model": raw.get("model") or tpl["video_model"],
        "camera": [str(c) for c in camera][:3] or list(tpl["camera"][:1]),
        "keyframe_prompt": (raw.get("keyframe_prompt") or "").strip(),
        "video_prompt": (raw.get("video_prompt") or "").strip(),
        "duration": duration,
    }
    if role == "cta":
        scene["overlay_text"] = (raw.get("overlay_text") or "").strip() or None
    return scene


def _parse_plan(raw: str | None) -> list[dict] | None:
    """Extract a valid 3-scene plan (hook, product, cta) from the LLM text."""
    if not raw:
        return None
    try:
        start, end = raw.find("["), raw.rfind("]")
        if start == -1 or end == -1:
            return None
        data = json.loads(raw[start : end + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, list) or not data:
        return None
    # index by role so we always emit hook/product/cta in the fixed order
    by_role: dict[str, dict] = {}
    for item in data:
        if isinstance(item, dict) and item.get("role") in _ROLES:
            by_role.setdefault(item["role"], item)
    scenes = []
    for role in _ROLES:
        src = by_role.get(role)
        if not src or not (src.get("keyframe_prompt") and src.get("video_prompt")):
            return None  # incomplete → let the caller fall back
        scenes.append(_normalize_scene(src, role))
    return scenes


async def plan_reel(
    brief: str, product_name: str = "", product_ref: dict | None = None
) -> tuple[list[dict], str]:
    """Plan a 3-scene cinematic reel.

    Returns (scene_plan, source) where source is "llm" (Claude wrote it) or
    "rules" (deterministic fallback).
    """
    product_name = (product_name or "").strip() or "המוצר"
    if _llm_ready():
        vocab = (
            "Approved camera moves: " + ", ".join(CAMERA_MOVES.keys()) + "\n"
            "Approved lighting: " + "; ".join(LIGHTING) + "\n"
            "Approved look: " + "; ".join(LOOK)
        )
        prompt = (
            f"Product name: {product_name}\n"
            f"Product data (may be empty for now): {json.dumps(product_ref or {}, ensure_ascii=False)}\n\n"
            f"{vocab}\n\n"
            f"Customer brief:\n{brief}\n\n"
            "Return ONLY the scene_plan as a JSON array of exactly 3 objects "
            "(role hook, then product, then cta). Each object: role, model, camera "
            "(array of the camera-move keys you used), keyframe_prompt, video_prompt, "
            "duration (seconds). Put the CTA copy on the cta scene as overlay_text."
        )
        raw = await asyncio.to_thread(_call_llm, PLANNER_SYSTEM_PROMPT, prompt)
        scenes = _parse_plan(raw)
        if scenes:
            return scenes, "llm"
    return default_plan(product_name), "rules"
