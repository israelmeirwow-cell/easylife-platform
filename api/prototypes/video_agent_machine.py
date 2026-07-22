"""PROTOTYPE — throwaway. Video-agent state machine (pure, no I/O).

QUESTION THIS ANSWERS
=====================
Does the video-agent flow feel right when pushed through the hard cases?
Specifically: client asks for a video -> agent generates 3 scenes -> client
approves/rejects EACH scene independently -> rejected scenes get regenerated ->
when all 3 approved the scenes are stitched into the final video.

The risky, hard-to-reason-on-paper parts we want to FEEL:
  1. Per-scene approval: approve #1, reject #2, tweak #3 — what state are we in?
  2. Credits: every generation attempt (incl. each regenerate) costs credits.
     When does the job get BLOCKED for no credits, mid-flow?
  3. A scene generation FAILS (Higgsfield error). Do we charge for it? Retry?
  4. Stitch is only legal when all 3 scenes are approved.

This module is PURE: it owns state and exposes legal transitions. The TUI shell
(video_agent_tui.py) is throwaway; this machine is the bit that lifts into the
real code once the model feels right.

DELIBERATE OPEN DECISIONS surfaced here (change the constants / rules and re-feel):
  - COST_PER_SCENE: credits debited per generation attempt.
  - CHARGE_ON_FAILURE: do failed generations still burn credits?  (default: NO)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

# ---- open decisions — tweak and re-feel -----------------------------------
COST_PER_SCENE = 10          # credits per generation attempt
CHARGE_ON_FAILURE = False    # do we burn credits when Higgsfield errors out?
NUM_SCENES = 3


class SceneStatus(str, Enum):
    PENDING = "pending"        # not yet generated
    GENERATING = "generating"  # in flight
    READY = "ready"            # generated, awaiting client review
    APPROVED = "approved"      # client said yes
    REJECTED = "rejected"      # client said no -> awaits regenerate
    FAILED = "failed"          # generation errored


class JobStatus(str, Enum):
    DRAFT = "draft"              # created, nothing generated yet
    REVIEWING = "reviewing"     # at least one scene generated, awaiting approvals
    BLOCKED_NO_CREDITS = "blocked_no_credits"
    DONE = "done"               # stitched


ROLES = ["hook", "product-in-action", "call-to-action"]


@dataclass
class Scene:
    index: int
    role: str
    status: SceneStatus = SceneStatus.PENDING
    attempts: int = 0


@dataclass
class Job:
    brief: str
    credits: int
    scenes: list[Scene] = field(default_factory=list)
    status: JobStatus = JobStatus.DRAFT
    spent: int = 0
    log: list[str] = field(default_factory=list)

    # ---- derived ----------------------------------------------------------
    @property
    def all_approved(self) -> bool:
        return len(self.scenes) == NUM_SCENES and all(
            s.status == SceneStatus.APPROVED for s in self.scenes
        )

    def can_afford(self) -> bool:
        return self.credits >= COST_PER_SCENE


def new_job(brief: str, credits: int) -> Job:
    scenes = [Scene(index=i, role=ROLES[i]) for i in range(NUM_SCENES)]
    j = Job(brief=brief, credits=credits, scenes=scenes)
    j.log.append(f"job created — brief={brief!r}, credits={credits}")
    return j


def _debit(job: Job, note: str) -> bool:
    """Try to burn COST_PER_SCENE. Returns False + blocks job if unaffordable."""
    if not job.can_afford():
        job.status = JobStatus.BLOCKED_NO_CREDITS
        job.log.append(f"BLOCKED — need {COST_PER_SCENE}, have {job.credits} ({note})")
        return False
    job.credits -= COST_PER_SCENE
    job.spent += COST_PER_SCENE
    job.log.append(f"-{COST_PER_SCENE} credits ({note}) -> balance {job.credits}")
    return True


def generate(job: Job, i: int) -> Job:
    """Generate (or regenerate) scene i. Costs credits up front."""
    s = job.scenes[i]
    if s.status == SceneStatus.APPROVED:
        job.log.append(f"scene {i} already approved — ignored")
        return job
    if job.status == JobStatus.BLOCKED_NO_CREDITS and not job.can_afford():
        job.log.append(f"cannot generate scene {i} — job blocked, no credits")
        return job
    if not _debit(job, f"generate scene {i} ({s.role})"):
        return job
    s.status = SceneStatus.READY   # simulate success; use fail() for the error path
    s.attempts += 1
    job.status = JobStatus.REVIEWING
    job.log.append(f"scene {i} generated (attempt {s.attempts}) -> READY")
    return job


def fail(job: Job, i: int) -> Job:
    """Simulate Higgsfield erroring on scene i."""
    s = job.scenes[i]
    # decision: charge for the attempt or not?
    if CHARGE_ON_FAILURE:
        _debit(job, f"FAILED gen scene {i}")
    else:
        job.log.append(f"scene {i} FAILED — not charged (CHARGE_ON_FAILURE=False)")
    s.status = SceneStatus.FAILED
    s.attempts += 1
    if job.status == JobStatus.DRAFT:
        job.status = JobStatus.REVIEWING
    return job


def approve(job: Job, i: int) -> Job:
    s = job.scenes[i]
    if s.status not in (SceneStatus.READY, SceneStatus.REJECTED):
        job.log.append(f"cannot approve scene {i} — status {s.status.value}")
        return job
    s.status = SceneStatus.APPROVED
    job.log.append(f"scene {i} APPROVED")
    return job


def reject(job: Job, i: int) -> Job:
    s = job.scenes[i]
    if s.status not in (SceneStatus.READY, SceneStatus.APPROVED):
        job.log.append(f"cannot reject scene {i} — status {s.status.value}")
        return job
    s.status = SceneStatus.REJECTED
    job.log.append(f"scene {i} REJECTED — needs regenerate")
    return job


def stitch(job: Job) -> Job:
    if not job.all_approved:
        missing = [s.index for s in job.scenes if s.status != SceneStatus.APPROVED]
        job.log.append(f"cannot stitch — scenes not approved: {missing}")
        return job
    job.status = JobStatus.DONE
    job.log.append("STITCHED — final video ready ✅")
    return job


def topup(job: Job, amount: int) -> Job:
    job.credits += amount
    job.log.append(f"+{amount} credits (top-up) -> balance {job.credits}")
    if job.status == JobStatus.BLOCKED_NO_CREDITS and job.can_afford():
        job.status = JobStatus.REVIEWING
        job.log.append("unblocked — credits available again")
    return job
