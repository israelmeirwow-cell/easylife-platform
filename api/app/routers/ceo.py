"""CEO agent endpoints — the central brain's executive layer.

GET  /api/ceo/brief  → executive brief for the tenant (rules, or LLM if a key is set)
POST /api/ceo/ask    → answer a free-text business question from the brain context
"""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.ceo.brief import answer_question, generate_brief
from app.db import get_session
from app.deps import get_tenant_id

router = APIRouter(prefix="/api/ceo", tags=["ceo"])


class AskBody(BaseModel):
    question: str


@router.get("/brief")
async def ceo_brief(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    return await generate_brief(session, tenant_id)


@router.post("/ask")
async def ceo_ask(
    body: AskBody,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    question = (body.question or "").strip()
    if not question:
        return {"answer": "שאל אותי משהו על העסק — לידים, עסקאות, משימות או מה חשוב היום.", "source": "rules"}
    return await answer_question(session, tenant_id, question)
