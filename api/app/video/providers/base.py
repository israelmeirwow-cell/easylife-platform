"""Provider interface — one adapter per generation backend.

A provider turns ONE plan step into ONE upstream job and reports its status.
Everything above (state machine, credits, approvals) is provider-agnostic, so
Higgsfield can be swapped for another engine without touching the pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class GenerationRequest:
    """One unit of work handed to a provider.

    `kind` selects the sub-pipeline: "keyframe" (still) or "video" (clip).
    `reference_ids` are upstream media/job ids (the product photo for a keyframe,
    the approved keyframe for a video). `params` carries model-specific extras
    (duration, aspect_ratio, mode).
    """

    kind: str                      # "keyframe" | "video"
    model: str                     # provider model id from the playbook
    prompt: str
    reference_ids: list[str] = field(default_factory=list)
    params: dict = field(default_factory=dict)


@dataclass
class GenerationResult:
    """Provider response. `request_id` is the correlation key persisted on the
    scene row at submit time (VideoScene.provider_request_id)."""

    request_id: str
    status: str                    # "submitted" | "in_progress" | "completed" | "failed"
    output_url: str | None = None
    error: str | None = None
    cost_usd_micros: int | None = None


class VideoProvider(Protocol):
    slug: str

    async def submit(self, req: GenerationRequest) -> GenerationResult:
        """Start a job. MUST return a request_id even while status != completed,
        so a crash between submit and the first poll cannot orphan the job."""
        ...

    async def poll(self, request_id: str) -> GenerationResult:
        """Report current status; reconcile lost webhooks on read."""
        ...
