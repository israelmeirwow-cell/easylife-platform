"""Video job/scene state-machine tests (transition tables + guards).

Mirrors the validated prototype (api/prototypes/video_agent_machine.py),
extended with the keyframe-first gate (blueprint §4).
"""

import pytest

from app.models import Tenant, VideoJob, VideoScene
from app.video.machine import (
    IllegalTransition,
    all_keyframes_approved,
    all_scenes_approved,
    assert_job_transition,
    assert_scene_transition,
    job_is_cancellable,
)


def _scene(status: str, index: int = 0) -> VideoScene:
    return VideoScene(index=index, role="hook", status=status)


class TestSceneTransitions:
    def test_happy_path(self):
        path = [
            ("pending", "keyframe_generating"),
            ("keyframe_generating", "keyframe_ready"),
            ("keyframe_ready", "keyframe_approved"),
            ("keyframe_approved", "generating"),
            ("generating", "ready"),
            ("ready", "approved"),
        ]
        for src, dst in path:
            assert_scene_transition(src, dst)  # no raise

    def test_rejected_keyframe_loops_back_to_generation(self):
        assert_scene_transition("keyframe_ready", "keyframe_rejected")
        assert_scene_transition("keyframe_rejected", "keyframe_generating")

    def test_rejected_video_regenerates_video_only(self):
        assert_scene_transition("ready", "rejected")
        assert_scene_transition("rejected", "generating")
        # A video rejection must NOT fall back to the keyframe stage.
        with pytest.raises(IllegalTransition):
            assert_scene_transition("rejected", "keyframe_generating")

    def test_cannot_skip_keyframe_gate(self):
        with pytest.raises(IllegalTransition):
            assert_scene_transition("keyframe_ready", "generating")
        with pytest.raises(IllegalTransition):
            assert_scene_transition("pending", "generating")

    def test_approved_is_terminal(self):
        with pytest.raises(IllegalTransition):
            assert_scene_transition("approved", "rejected")


class TestJobTransitions:
    def test_happy_path(self):
        path = [
            ("draft", "planning"),
            ("planning", "keyframes"),
            ("keyframes", "reviewing_keyframes"),
            ("reviewing_keyframes", "generating"),
            ("generating", "reviewing_scenes"),
            ("reviewing_scenes", "stitching"),
            ("stitching", "done"),
        ]
        for src, dst in path:
            assert_job_transition(src, dst)

    def test_blocked_no_credits_resumes_after_topup(self):
        assert_job_transition("keyframes", "blocked_no_credits")
        assert_job_transition("blocked_no_credits", "keyframes")
        assert_job_transition("generating", "blocked_no_credits")
        assert_job_transition("blocked_no_credits", "generating")

    def test_done_is_terminal(self):
        with pytest.raises(IllegalTransition):
            assert_job_transition("done", "generating")

    def test_stitching_not_cancellable_but_reviewing_is(self):
        assert job_is_cancellable("reviewing_scenes")
        assert not job_is_cancellable("stitching")
        assert not job_is_cancellable("done")


class TestGates:
    def test_keyframe_gate_requires_all_three(self):
        scenes = [_scene("keyframe_approved", i) for i in range(3)]
        assert all_keyframes_approved(scenes)
        scenes[1].status = "keyframe_rejected"
        assert not all_keyframes_approved(scenes)
        assert not all_keyframes_approved([])

    def test_stitch_gate_requires_all_approved(self):
        scenes = [_scene("approved", i) for i in range(3)]
        assert all_scenes_approved(scenes)
        scenes[2].status = "ready"
        assert not all_scenes_approved(scenes)


async def test_video_rows_are_tenant_scoped(session):
    """Sacred isolation: scenes join to jobs but both carry their own tenant_id."""
    t1 = Tenant(name="A", plan="starter")
    t2 = Tenant(name="B", plan="starter")
    session.add_all([t1, t2])
    await session.flush()
    job = VideoJob(tenant_id=t1.id, brief="ריל למוצר", product_ref={"name": "תבנית"})
    session.add(job)
    await session.flush()
    scene = VideoScene(tenant_id=t1.id, job_id=job.id, index=0, role="hook")
    session.add(scene)
    await session.commit()
    assert scene.tenant_id == t1.id != t2.id
    assert scene.status == "pending" and job.status == "draft"
