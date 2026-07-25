"""Video agent — the reel planner wired into the site (blueprint §4 step 1).

    POST /api/video/jobs   {brief, product_name?, product_ref?}  → plan a 3-scene reel
    GET  /api/video/jobs                                         → recent jobs
    GET  /api/video/jobs/{id}                                    → one job + its scenes

The planner (Claude) runs today and writes the cinematic scene_plan. Keyframe /
video RENDERING is a later provider stage (Higgsfield i2v + HyperFrames overlay);
until a provider is connected, scenes are created in status "planned" carrying the
prompts the agent wrote. Every step emits an event onto the shared brain.
"""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import VIDEO_SCENE_ROLES, Tenant, VideoJob, VideoScene
from app.video import composer, renderer
from app.video.planner import plan_reel

router = APIRouter(prefix="/api/video", tags=["video"])


def _renders_dir() -> Path:
    """Where rendered MP4s live. Override with VIDEO_RENDER_DIR (a mounted volume
    in production); defaults to a local folder so dev works out of the box."""
    return Path(os.environ.get("VIDEO_RENDER_DIR", "var/renders"))


class CreateJobBody(BaseModel):
    brief: str = Field(min_length=1, max_length=2000)
    product_name: str | None = Field(default=None, max_length=200)
    product_ref: dict | None = None


def _scene_out(scene: VideoScene, plan: dict) -> dict:
    """Merge a persisted scene row with its plan entry (prompts live in the plan)."""
    return {
        "id": str(scene.id),
        "index": scene.index,
        "role": scene.role,
        "status": scene.status,
        "keyframe_url": scene.keyframe_url,
        "video_url": scene.video_url,
        "keyframe_prompt": plan.get("keyframe_prompt", ""),
        "video_prompt": plan.get("video_prompt", ""),
        "camera": plan.get("camera", []),
        "duration": plan.get("duration"),
        "overlay_text": plan.get("overlay_text"),
    }


def _job_out(job: VideoJob, scenes: list[VideoScene]) -> dict:
    plan = (job.scene_plan or {}).get("scenes", []) if job.scene_plan else []
    by_index = {p_i: p for p_i, p in enumerate(plan)}
    sp = job.scene_plan or {}
    return {
        "id": str(job.id),
        "brief": job.brief,
        "status": job.status,
        "source": sp.get("source"),
        "product_ref": job.product_ref or {},
        "final_video_url": job.final_video_url,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        # the HyperFrames layer: has a composition been written, and can this
        # deployment turn it into an MP4?
        "has_composition": bool(sp.get("composition")),
        "composition_source": sp.get("composition_source"),
        "can_render": renderer.available(),
        "scenes": [_scene_out(s, by_index.get(s.index, {})) for s in scenes],
    }


async def _load_job(session: AsyncSession, tenant_id: uuid.UUID, job_id: uuid.UUID) -> VideoJob:
    job = (
        await session.execute(
            select(VideoJob).where(VideoJob.tenant_id == tenant_id, VideoJob.id == job_id)
        )
    ).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="video job not found")
    return job


async def _business_name(session: AsyncSession, tenant_id: uuid.UUID) -> str:
    tenant = (
        await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    ).scalar_one_or_none()
    return (tenant.name if tenant else "") or ""


@router.post("/jobs")
async def create_job(
    body: CreateJobBody,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    actor_id: str = Depends(get_actor_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    brief = body.brief.strip()
    if not brief:
        raise HTTPException(status_code=400, detail="brief is required")

    product_ref = body.product_ref or ({"name": body.product_name} if body.product_name else {})
    job = VideoJob(tenant_id=tenant_id, brief=brief, product_ref=product_ref, status="planning")
    session.add(job)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="human",
        actor_id=actor_id,
        verb="video.job_created",
        entity_type="video_job",
        entity_id=job.id,
        payload={"brief": brief[:140]},
    )

    # The agent plans the reel (Claude, or the deterministic fallback).
    product_name = body.product_name or product_ref.get("name", "")
    scenes_plan, source = await plan_reel(brief, product_name, product_ref)

    job.scene_plan = {"scenes": scenes_plan, "source": source}
    job.status = "planned"
    scene_rows: list[VideoScene] = []
    for i, sp in enumerate(scenes_plan):
        role = sp.get("role") or (VIDEO_SCENE_ROLES[i] if i < len(VIDEO_SCENE_ROLES) else "product")
        row = VideoScene(
            tenant_id=tenant_id,
            job_id=job.id,
            index=i,
            role=role,
            status="planned",
            provider="hyperframes",
        )
        session.add(row)
        scene_rows.append(row)
    await session.flush()
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="agent",
        actor_id="video-agent",
        verb="video.plan_ready",
        entity_type="video_job",
        entity_id=job.id,
        payload={"scenes": len(scenes_plan), "source": source, "brief": brief[:140]},
    )
    await session.commit()
    return _job_out(job, scene_rows)


@router.get("/jobs")
async def list_jobs(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    rows = (
        await session.execute(
            select(VideoJob)
            .where(VideoJob.tenant_id == tenant_id)
            .order_by(VideoJob.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    return [
        {
            "id": str(j.id),
            "brief": j.brief,
            "status": j.status,
            "source": (j.scene_plan or {}).get("source") if j.scene_plan else None,
            "scene_count": len((j.scene_plan or {}).get("scenes", [])) if j.scene_plan else 0,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in rows
    ]


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    job = await _load_job(session, tenant_id, job_id)
    scenes = (
        await session.execute(
            select(VideoScene)
            .where(VideoScene.job_id == job.id)
            .order_by(VideoScene.index.asc())
        )
    ).scalars().all()
    return _job_out(job, list(scenes))


# ------------------------------------------------------------------ HyperFrames
@router.post("/jobs/{job_id}/compose")
async def compose_job(
    job_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Write the HyperFrames composition for this reel (the actual video)."""
    job = await _load_job(session, tenant_id, job_id)
    plan = (job.scene_plan or {}).get("scenes") or []
    if not plan:
        raise HTTPException(status_code=400, detail="job has no scene plan yet")

    business = await _business_name(session, tenant_id)
    product = (job.product_ref or {}).get("name") or ""
    doc, source = await composer.compose(plan, product, business, job.brief)

    sp = dict(job.scene_plan or {})
    sp["composition"] = doc
    sp["composition_source"] = source
    # A new composition invalidates any previously rendered MP4 — otherwise the
    # download button would hand back the old video while the preview shows the new one.
    sp.pop("render_file", None)
    job.scene_plan = sp
    job.final_video_url = None
    job.status = "composed"
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="agent",
        actor_id="video-agent",
        verb="video.composition_ready",
        entity_type="video_job",
        entity_id=job.id,
        payload={"source": source, "provider": "hyperframes"},
    )
    await session.commit()
    return {"id": str(job.id), "composition_source": source, "can_render": renderer.available()}


@router.get("/jobs/{job_id}/preview", response_class=HTMLResponse)
async def preview_job(
    job_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> HTMLResponse:
    """The composition as a self-playing page — the site embeds this in an iframe."""
    job = await _load_job(session, tenant_id, job_id)
    doc = (job.scene_plan or {}).get("composition")
    if not doc:
        raise HTTPException(status_code=404, detail="no composition yet — compose first")
    return HTMLResponse(composer.playable(doc))


@router.post("/jobs/{job_id}/render")
async def render_job(
    job_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Render the composition to a real MP4 via the HyperFrames CLI (free, local)."""
    job = await _load_job(session, tenant_id, job_id)
    doc = (job.scene_plan or {}).get("composition")
    if not doc:
        raise HTTPException(status_code=400, detail="no composition yet — compose first")
    if not renderer.available():
        raise HTTPException(
            status_code=503,
            detail="MP4 rendering is not enabled on this server (needs node>=22 + ffmpeg)",
        )

    # Rendering takes tens of seconds. Give the pooled DB connection back FIRST —
    # holding it across the render would let a handful of concurrent exports drain
    # the pool and take every other request (and the site) down with them.
    await session.commit()
    await session.close()

    try:
        path = await renderer.render_mp4(doc, _renders_dir() / str(tenant_id))
    except renderer.RenderBusy as exc:
        raise HTTPException(
            status_code=429,
            detail="השרת מרנדר סרטון אחר כרגע — נסו שוב בעוד רגע.",
            headers={"Retry-After": "30"},
        ) from exc
    except renderer.RenderError as exc:
        job = await _load_job(session, tenant_id, job_id)
        job.last_error = str(exc)[:500]
        await session.commit()
        raise HTTPException(status_code=502, detail=f"render failed: {exc}") from exc

    # Re-read the row on a fresh transaction; it may have changed during the render.
    job = await _load_job(session, tenant_id, job_id)
    job.final_video_url = f"/api/video/jobs/{job.id}/mp4"
    job.status = "done"
    job.last_error = None
    sp = dict(job.scene_plan or {})
    sp["render_file"] = path.name
    job.scene_plan = sp
    await emit_event(
        session,
        tenant_id=tenant_id,
        actor_type="agent",
        actor_id="video-agent",
        verb="video.render_ready",
        entity_type="video_job",
        entity_id=job.id,
        payload={"provider": "hyperframes", "file": path.name},
    )
    await session.commit()
    return {"id": str(job.id), "final_video_url": job.final_video_url}


@router.get("/jobs/{job_id}/mp4")
async def get_job_mp4(
    job_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    job = await _load_job(session, tenant_id, job_id)
    name = (job.scene_plan or {}).get("render_file")
    if not name:
        raise HTTPException(status_code=404, detail="no rendered video for this job")
    # name comes from the renderer (never user input), but keep it a bare filename
    path = _renders_dir() / str(tenant_id) / os.path.basename(name)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="rendered file is gone")
    return FileResponse(path, media_type="video/mp4", filename=f"easylife-reel-{job.id}.mp4")
