"""HyperFrames renderer — composition HTML -> MP4, locally, at zero marginal cost.

Shells out to the `hyperframes` CLI (npm, Node >=22, needs ffmpeg + a Chromium
for puppeteer). Rendering is OPTIONAL: `available()` reports whether this
deployment can render, so the API can always serve the composition (which the
browser plays natively) and only offer MP4 export where the toolchain exists.

Verified locally: a 12s 1080x1920 reel renders in ~25s (360 frames @30fps).
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import shutil
import signal
import tempfile
from pathlib import Path

# Pin the version we validated so a surprise upstream release can't break prod.
HYPERFRAMES_PKG = os.environ.get("HYPERFRAMES_PKG", "hyperframes@0.7.71")
RENDER_TIMEOUT_S = int(os.environ.get("VIDEO_RENDER_TIMEOUT", "600"))

# Each render worker is a separate Chrome (~256 MB). This process serves the API
# and the website too, so cap both the workers and how many renders run at once —
# an unbounded render storm would OOM the container and take the site down.
RENDER_WORKERS = os.environ.get("VIDEO_RENDER_WORKERS", "2")
_render_slot = asyncio.Semaphore(int(os.environ.get("VIDEO_RENDER_CONCURRENCY", "1")))

_HYPERFRAMES_JSON = """{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
  "media": {"autoProxy": true}
}
"""


def available() -> bool:
    """True when this host can actually render (node + npx + ffmpeg present)."""
    if os.environ.get("VIDEO_RENDER_ENABLED", "").lower() in ("0", "false", "no"):
        return False
    return bool(shutil.which("npx") and shutil.which("node") and shutil.which("ffmpeg"))


class RenderError(RuntimeError):
    pass


class RenderBusy(RenderError):
    """A render is already in flight — the caller should retry, not queue."""


async def render_mp4(composition_html: str, out_dir: str | os.PathLike) -> Path:
    """Render a composition to MP4 and return the path of the produced file.

    Runs in an isolated temp project so concurrent renders can't collide.
    """
    if not available():
        raise RenderError(
            "rendering is not available on this host (needs node>=22, npx and ffmpeg)"
        )
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Never queue: a caller that has to wait is told to retry, so requests can't
    # pile up holding server resources while one long render runs.
    if _render_slot.locked():
        raise RenderBusy("another render is already running")

    async with _render_slot:
        with tempfile.TemporaryDirectory(prefix="hf-render-") as tmp:
            project = Path(tmp)
            (project / "index.html").write_text(composition_html, encoding="utf-8")
            (project / "hyperframes.json").write_text(_HYPERFRAMES_JSON, encoding="utf-8")

            # start_new_session puts npx -> node -> chromium in their own process
            # group, so a timeout/cancel can kill the WHOLE tree. Killing just the
            # npx pid would orphan the Chromium workers (~256 MB each) forever.
            proc = await asyncio.create_subprocess_exec(
                "npx", "--yes", HYPERFRAMES_PKG, "render",
                "--workers", str(RENDER_WORKERS), "--quiet",
                cwd=str(project),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                start_new_session=True,
            )
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=RENDER_TIMEOUT_S)
            except asyncio.TimeoutError:
                await _kill_tree(proc)
                raise RenderError(f"render timed out after {RENDER_TIMEOUT_S}s") from None
            except asyncio.CancelledError:
                # client disconnected / server shutting down — don't leak the tree
                await _kill_tree(proc)
                raise

            log = (stdout or b"").decode("utf-8", "replace")
            renders = project / "renders"
            produced = sorted(
                renders.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True
            ) if renders.is_dir() else []
            if proc.returncode != 0 or not produced:
                raise RenderError(f"hyperframes render failed (rc={proc.returncode}): {log[-800:]}")

            final = out_dir / produced[0].name
            shutil.copy2(produced[0], final)
            return final


async def _kill_tree(proc: asyncio.subprocess.Process) -> None:
    """SIGKILL the whole process group, then reap, so no Chromium survives."""
    if proc.returncode is not None:
        return
    with contextlib.suppress(ProcessLookupError, PermissionError, OSError):
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    with contextlib.suppress(ProcessLookupError, OSError):
        proc.kill()
    with contextlib.suppress(asyncio.TimeoutError, ProcessLookupError):
        await asyncio.wait_for(proc.wait(), timeout=10)
