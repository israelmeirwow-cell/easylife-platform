"""Higgsfield adapter — the cinematic engine.

Translates a scene_plan step into a Higgsfield `higgsfield` CLI invocation
(the production integration path; the CLI holds the authenticated session, so a
platform-owned Higgsfield Studio account fronts all tenants — blueprint "AI
dropshipping" model). This adapter is the SINGLE place that knows Higgsfield's
command shape; the rest of the agent speaks only the playbook + GenerationRequest.

Command shapes (from the higgsfield-generate / product-photoshoot skills):

  keyframe (product still from the customer's real photo):
    higgsfield generate create --model gpt_image_2 \
        --prompt "<keyframe_prompt>" --image <product_photo> \
        --aspect_ratio 9:16 --wait --json

  video (cinematic image-to-video from the approved keyframe):
    higgsfield generate create --model seedance_2_0 \
        --start-image <keyframe_job_id> --prompt "<video_prompt>" \
        --aspect_ratio 9:16 --duration <n> --wait --json

Execution is injected (`runner`) so unit tests build and assert the command
without any network/auth. In production the runner shells out to the CLI and
parses the `--json` envelope for the job id + result URL.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable

from app.video.providers.base import GenerationRequest, GenerationResult

# A runner takes an argv list and returns the CLI's stdout (JSON). Injected so
# the network/auth boundary is testable and swappable (CLI now, REST later).
Runner = Callable[[list[str]], Awaitable[str]]


class HiggsfieldProvider:
    slug = "higgsfield"

    def __init__(self, runner: Runner | None = None, aspect_ratio: str = "9:16"):
        self._runner = runner
        self._aspect = aspect_ratio

    def build_argv(self, req: GenerationRequest) -> list[str]:
        """Pure: GenerationRequest -> `higgsfield` argv. The heart of the adapter."""
        argv = ["higgsfield", "generate", "create", "--model", req.model,
                "--prompt", req.prompt, "--aspect_ratio", self._aspect]
        if req.kind == "keyframe":
            # the customer's real product photo anchors the still
            for ref in req.reference_ids:
                argv += ["--image", ref]
        elif req.kind == "video":
            # the approved keyframe is the first frame; prompt describes motion
            if req.reference_ids:
                argv += ["--start-image", req.reference_ids[0]]
            duration = req.params.get("duration")
            if duration:
                argv += ["--duration", str(duration)]
        else:  # pragma: no cover - guarded by the planner
            raise ValueError(f"unknown generation kind {req.kind!r}")
        argv += ["--wait", "--json"]
        return argv

    async def submit(self, req: GenerationRequest) -> GenerationResult:
        argv = self.build_argv(req)
        if self._runner is None:
            raise RuntimeError(
                "HiggsfieldProvider has no runner — inject one (prod: CLI subprocess). "
                f"Would run: {' '.join(argv)}"
            )
        raw = await self._runner(argv)
        return self._parse(raw)

    async def poll(self, request_id: str) -> GenerationResult:
        if self._runner is None:
            raise RuntimeError("HiggsfieldProvider has no runner")
        raw = await self._runner(["higgsfield", "generate", "get", request_id, "--json"])
        return self._parse(raw)

    @staticmethod
    def _parse(raw: str) -> GenerationResult:
        """Map the CLI --json envelope to a GenerationResult.

        Tolerant to the two shapes the CLI/MCP use: a top-level job object or a
        {"results": [job]} wrapper (as the MCP returns).
        """
        data = json.loads(raw)
        job = data.get("results", [data])[0] if isinstance(data, dict) else data
        status_map = {"pending": "in_progress", "in_progress": "in_progress",
                      "completed": "completed", "failed": "failed"}
        results = job.get("results") or {}
        url = None
        if isinstance(results, dict):
            url = results.get("rawUrl") or results.get("url")
        elif isinstance(results, list) and results:
            first = results[0]
            url = first.get("url") if isinstance(first, dict) else None
        return GenerationResult(
            request_id=str(job.get("id")),
            status=status_map.get(job.get("status", ""), "in_progress"),
            output_url=url,
            error=job.get("error"),
        )
