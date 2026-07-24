"""Send a WhatsApp from OUR backend to prove the Cloud API connector works.

Run from the api/ directory (so .env is picked up):
    .venv/bin/python scripts/wa_send_test.py 972535956758
Sends the pre-approved `hello_world` template to the given number. Pass a
different template name as a 2nd arg if hello_world isn't on the WABA.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.connectors import whatsapp  # noqa: E402


async def main() -> None:
    if len(sys.argv) < 2:
        print("usage: python scripts/wa_send_test.py <recipient e.g. 972535956758> [template]")
        raise SystemExit(1)
    to = sys.argv[1].lstrip("+")
    template = sys.argv[2] if len(sys.argv) > 2 else "hello_world"
    print(f"→ sending '{template}' template to {to} ...")
    try:
        res = await whatsapp.send_template(to, name=template)
        msg_id = (res.get("messages") or [{}])[0].get("id", "?")
        print(f"✅ accepted by Meta — message id: {msg_id}")
        print("   full response:", res)
    except whatsapp.WhatsAppError as e:
        print("❌ error:", e)
        raise SystemExit(2)


if __name__ == "__main__":
    asyncio.run(main())
