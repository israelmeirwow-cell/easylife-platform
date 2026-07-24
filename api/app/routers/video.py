"""Video agent — the reel planner wired into the site (blueprint §4 step 1).

    POST /api/video/jobs   {brief, product_name?, product_ref?}  → plan a 3-scene reel
    GET  /api/video/jobs                                         → recent jobs
    GET  /api/video/jobs/{id}                                    → one job + its scenes

The planner (Claude) runs today and writes the cinematic scene_plan. Keyframe /
video RENDERING is a later provider stage (Higgsfield i2v + HyperFrames overlay);
until a provider is connected, scenes are created in status "planned" carrying the
prompts the agent wrote. Every step emits an event onto the shared brain.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import get_actor_id, get_tenant_id
from app.events import emit_event
from app.models import VIDEO_SCENE_ROLES, VideoJob, VideoScene
from app.video.planner import plan_reel

router = APIRouter(prefix="/api/video", tags=["video"])


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
    return {
        "id": str(job.id),
        "brief": job.brief,
        "status": job.status,
        "source": (job.scene_plan or {}).get("source") if job.scene_plan else None,
        "product_ref": job.product_ref or {},
        "final_video_url": job.final_video_url,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "scenes": [_scene_out(s, by_index.get(s.index, {})) for s in scenes],
    }


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
    job = (
        await session.execute(
            select(VideoJob).where(VideoJob.tenant_id == tenant_id, VideoJob.id == job_id)
        )
    ).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="video job not found")
    scenes = (
        await session.execute(
            select(VideoScene)
            .where(VideoScene.job_id == job.id)
            .order_by(VideoScene.index.asc())
        )
    ).scalars().all()
    return _job_out(job, list(scenes))
