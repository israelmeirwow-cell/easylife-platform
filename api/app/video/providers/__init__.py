"""Video generation providers. Higgsfield = cinematic engine; HyperFrames =
overlay/branding/stitch layer. All sit behind the ChannelConnector-style
`VideoProvider` interface so the engine is swappable (blueprint §5)."""

from app.video.providers.base import (
    GenerationRequest,
    GenerationResult,
    VideoProvider,
)

__all__ = ["GenerationRequest", "GenerationResult", "VideoProvider"]
