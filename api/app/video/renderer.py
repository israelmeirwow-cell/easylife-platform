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

# Headless containers have no GPU. HyperFrames' default capture path drives the
# compositor's BeginFrame, which silently yields ZERO frames there — ffmpeg then
# fails with "frame= 0". Forcing software GL + the screenshot capture path fixes
# it (slower, but it actually produces a video). On a dev machine with a GPU the
# fast path is kept.
RENDER_SOFTWARE = os.environ.get("VIDEO_RENDER_SOFTWARE", "").lower() in ("1", "true", "yes")

_HYPERFRAMES_JSON = """{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
  "media": {"autoProxy": true}
}
"""


def _render_argv() -> list[str] | None:
    """How to invoke the renderer here.

    Prefer the globally installed CLI (baked into the production image, so no
    network at request time); fall back to npx for dev machines that only have
    Node. Returns None when this host cannot render at all.
    """
    if shutil.which("hyperframes"):
        return ["hyperframes", "render"]
    if shutil.which("npx") and shutil.which("node"):
        return ["npx", "--yes", HYPERFRAMES_PKG, "render"]
    return None


def available() -> bool:
    """True when this host can actually render (CLI or npx, plus ffmpeg)."""
    if os.environ.get("VIDEO_RENDER_ENABLED", "").lower() in ("0", "false", "no"):
        return False
    return bool(_render_argv() and shutil.which("ffmpeg"))


class RenderError(RuntimeError):
    pass


class RenderBusy(RenderError):
    """A render is already in flight — the caller should retry, not queue."""


async def render_mp4(composition_html: str, out_dir: str | os.PathLike) -> Path:
    """Render a composition to MP4 and return the path of the produced file.

    Runs in an isolated temp project so concurrent renders can't collide.
    """
    argv = _render_argv()
    if not available() or argv is None:
        raise RenderError(
            "rendering is not available on this host (needs the hyperframes CLI "
            "or node>=22 + npx, plus ffmpeg)"
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
            flags = ["--workers", str(RENDER_WORKERS), "--quiet"]
            env = None
            if RENDER_SOFTWARE:
                flags.append("--no-browser-gpu")
                env = {**os.environ, "PRODUCER_FORCE_SCREENSHOT": "1"}

            proc = await asyncio.create_subprocess_exec(
                *argv, *flags,
                cwd=str(project),
                env=env,
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
