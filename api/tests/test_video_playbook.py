"""The generation playbook + Higgsfield adapter: the agent's command->cinematic
translation intelligence."""

import pytest

from app.video.generation_playbook import (
    CAMERA_MOVES,
    MODEL_ROUTING,
    SCENE_ROLE_TEMPLATES,
    build_scene_prompt,
    default_plan,
)
from app.video.providers.base import GenerationRequest
from app.video.providers.higgsfield import HiggsfieldProvider


class TestPlaybook:
    def test_default_plan_is_three_fixed_scenes(self):
        plan = default_plan("מארז יוקרה למסיבה")
        assert [s["role"] for s in plan] == ["hook", "product", "cta"]
        for s in plan:
            assert s["model"] == "seedance_2_0"
            assert s["camera"][0] in CAMERA_MOVES
            assert s["keyframe_prompt"] and s["video_prompt"]
            assert 2 <= s["duration"] <= 15

    def test_prompts_never_ask_the_video_model_for_text(self):
        # Video models garble text — the guardrail must be present in every prompt.
        for s in default_plan("מוצר"):
            assert "no on-screen text" in s["video_prompt"].lower()
            assert "no on-screen text" in s["keyframe_prompt"].lower()

    def test_cta_carries_overlay_text_slot(self):
        cta = build_scene_prompt("cta", "עוגה")
        assert "overlay_text" in cta  # CTA copy is overlaid, not generated in-video

    def test_hook_uses_high_energy_camera(self):
        hook = build_scene_prompt("hook", "עוגה")
        assert hook["camera"][0] in ("whip_reveal", "slow_push_in")

    def test_routing_points_cinematic_to_seedance(self):
        assert MODEL_ROUTING["cinematic_scene"] == "seedance_2_0"
        assert MODEL_ROUTING["product_keyframe"] == "gpt_image_2"

    def test_product_name_grounds_the_prompt(self):
        s = build_scene_prompt("product", "מארז צלחות זהב")
        assert "מארז צלחות זהב" in s["keyframe_prompt"]


class TestHiggsfieldAdapter:
    def test_keyframe_argv_passes_product_photo_as_image(self):
        p = HiggsfieldProvider()
        argv = p.build_argv(GenerationRequest(
            kind="keyframe", model="gpt_image_2",
            prompt="cinematic cake", reference_ids=["product-photo-123"],
        ))
        assert argv[:5] == ["higgsfield", "generate", "create", "--model", "gpt_image_2"]
        assert "--image" in argv and "product-photo-123" in argv
        assert "--start-image" not in argv
        assert argv[-2:] == ["--wait", "--json"]

    def test_video_argv_uses_approved_keyframe_as_start_image(self):
        p = HiggsfieldProvider()
        argv = p.build_argv(GenerationRequest(
            kind="video", model="seedance_2_0", prompt="slow push-in",
            reference_ids=["keyframe-job-9"], params={"duration": 5},
        ))
        assert "--start-image" in argv
        i = argv.index("--start-image")
        assert argv[i + 1] == "keyframe-job-9"
        assert "--duration" in argv and "5" in argv

    def test_unknown_kind_rejected(self):
        p = HiggsfieldProvider()
        with pytest.raises(ValueError):
            p.build_argv(GenerationRequest(kind="audio", model="x", prompt="y"))

    async def test_submit_parses_mcp_style_envelope(self):
        async def fake_runner(argv):
            return (
                '{"results":[{"id":"job-1","status":"completed",'
                '"results":{"rawUrl":"https://cdn/clip.mp4"}}]}'
            )
        p = HiggsfieldProvider(runner=fake_runner)
        res = await p.submit(GenerationRequest(
            kind="video", model="seedance_2_0", prompt="orbit",
            reference_ids=["kf-1"], params={"duration": 5},
        ))
        assert res.request_id == "job-1"
        assert res.status == "completed"
        assert res.output_url == "https://cdn/clip.mp4"

    async def test_submit_without_runner_is_a_clear_error(self):
        p = HiggsfieldProvider()
        with pytest.raises(RuntimeError, match="no runner"):
            await p.submit(GenerationRequest(kind="keyframe", model="gpt_image_2", prompt="x"))
