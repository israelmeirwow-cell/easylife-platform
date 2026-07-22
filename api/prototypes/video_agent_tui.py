"""PROTOTYPE — throwaway TUI shell for the video-agent state machine.

Run:  python api/prototypes/video_agent_tui.py
      (from the "Easy Life" project root)

Drive the flow by hand and watch state change. The interesting moments are the
"wait, that shouldn't be possible" ones — those are bugs in the IDEA.
"""

from __future__ import annotations

import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])

import video_agent_machine as m  # noqa: E402

B, D, R = "\x1b[1m", "\x1b[2m", "\x1b[0m"
G, Y, RD, C = "\x1b[32m", "\x1b[33m", "\x1b[31m", "\x1b[36m"

STATUS_COLOR = {
    m.SceneStatus.PENDING: D,
    m.SceneStatus.GENERATING: C,
    m.SceneStatus.READY: Y,
    m.SceneStatus.APPROVED: G,
    m.SceneStatus.REJECTED: RD,
    m.SceneStatus.FAILED: RD,
}


def render(job: m.Job) -> None:
    print("\x1b[2J\x1b[H", end="")
    print(f"{B}🎬 VIDEO-AGENT PROTOTYPE{R}  {D}(throwaway — feels out the flow){R}")
    print(f"{D}COST_PER_SCENE={m.COST_PER_SCENE}  CHARGE_ON_FAILURE={m.CHARGE_ON_FAILURE}{R}\n")

    sc = {m.JobStatus.DONE: G, m.JobStatus.BLOCKED_NO_CREDITS: RD}.get(job.status, Y)
    print(f"{B}brief{R}     {job.brief}")
    print(f"{B}status{R}    {sc}{job.status.value}{R}")
    print(f"{B}credits{R}   {job.credits}   {D}(spent {job.spent}){R}")
    print(f"{B}all approved?{R} {'yes ✅' if job.all_approved else 'no'}\n")

    print(f"{B}scenes{R}")
    for s in job.scenes:
        col = STATUS_COLOR[s.status]
        print(f"  [{s.index}] {s.role:<18} {col}{s.status.value:<11}{R} "
              f"{D}attempts={s.attempts}{R}")

    print(f"\n{B}log{R}")
    for line in job.log[-6:]:
        print(f"  {D}{line}{R}")

    print(f"\n{B}actions{R}  "
          f"{B}g<i>{R}{D} generate{R}  {B}f<i>{R}{D} fail-gen{R}  "
          f"{B}a<i>{R}{D} approve{R}  {B}r<i>{R}{D} reject{R}")
    print(f"         {B}s{R}{D} stitch{R}  {B}t{R}{D} top-up +50{R}  "
          f"{B}n{R}{D} new job{R}  {B}q{R}{D} quit{R}")
    print(f"{D}e.g. 'g0' generate scene 0, 'a1' approve scene 1{R}")


def main() -> None:
    job = m.new_job("Reels for a party disposable-tableware set", credits=50)
    while True:
        render(job)
        try:
            cmd = input("\n> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            break
        if not cmd:
            continue
        if cmd == "q":
            break
        if cmd == "n":
            job = m.new_job("Reels for home-baked cookies", credits=50)
            continue
        if cmd == "s":
            m.stitch(job)
            continue
        if cmd == "t":
            m.topup(job, 50)
            continue
        action, _, rest = cmd[0], cmd, cmd[1:]
        if action in "gfar" and rest.isdigit():
            i = int(rest)
            if 0 <= i < m.NUM_SCENES:
                {"g": m.generate, "f": m.fail, "a": m.approve, "r": m.reject}[action](job, i)


if __name__ == "__main__":
    main()
