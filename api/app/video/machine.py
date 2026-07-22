"""Video-agent state machine guards — pure, no I/O (lifts api/prototypes/).

The transition TABLES live in app.models (repo convention, next to
APPROVAL_TRANSITIONS); this module owns the guard/derive helpers the service
layer and worker call before mutating rows. Every actual transition must also
emit an `events` row in the same transaction (CLAUDE.md: if it's not in the
feed, it didn't happen).
"""

from app.models import (
    VIDEO_JOB_TRANSITIONS,
    VIDEO_SCENE_TRANSITIONS,
    VideoScene,
)

TERMINAL_JOB_STATUSES = frozenset({"done", "failed", "cancelled"})


class IllegalTransition(Exception):
    def __init__(self, kind: str, from_status: str, to_status: str):
        self.kind, self.from_status, self.to_status = kind, from_status, to_status
        super().__init__(f"illegal {kind} transition {from_status!r} -> {to_status!r}")


def assert_job_transition(from_status: str, to_status: str) -> None:
    if to_status not in VIDEO_JOB_TRANSITIONS.get(from_status, set()):
        raise IllegalTransition("video_job", from_status, to_status)


def assert_scene_transition(from_status: str, to_status: str) -> None:
    if to_status not in VIDEO_SCENE_TRANSITIONS.get(from_status, set()):
        raise IllegalTransition("video_scene", from_status, to_status)


def all_keyframes_approved(scenes: list[VideoScene]) -> bool:
    """Gate #1 -> video generation may start (blueprint §4 step 3->4)."""
    return bool(scenes) and all(s.status == "keyframe_approved" for s in scenes)


def all_scenes_approved(scenes: list[VideoScene]) -> bool:
    """Gate #2 -> stitch may start (blueprint §4 step 5->6)."""
    return bool(scenes) and all(s.status == "approved" for s in scenes)


def job_is_cancellable(status: str) -> bool:
    """Two-phase cancel applies to any non-terminal, non-stitching status.

    Stitching is deliberately NOT interruptible: it is local, fast, and free —
    letting it finish is simpler than cleaning up a half-written bundle.
    """
    return status not in TERMINAL_JOB_STATUSES and status != "stitching"
