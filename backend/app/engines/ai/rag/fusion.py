"""Reciprocal Rank Fusion + Reranking — Section L1 of architecture document.

Combines results from multiple retrieval layers using RRF, then reranks
with an LLM (Haiku for MVP) for final relevance scoring.

RRF formula: score(d) = Σ 1/(k + rank_i(d)) where k=60

Reranking (MVP): Haiku via AI Gateway scores (query, passage) pairs.
Future: cross-encoder/ms-marco-MiniLM-L-12-v2 or Cohere Rerank v3.
"""

import logging
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.rag.models import RetrievalResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Structured output schema for LLM-based reranking
# ---------------------------------------------------------------------------

class _RerankOutput(BaseModel):
    """Structured output: passage indices in relevance order."""

    ranked_indices: list[int]


_RERANK_PROMPT = """\
You are a medical content relevance judge for a medical education platform.

Given a medical query and a list of retrieved passages, rank the passages
by relevance to the query. Return the passage indices (0-indexed) in order
of most relevant first. Only include passages that are actually relevant.

Medical-specific reranking signals to consider:
- Source authority (Harrison's > lecture notes > unverified content)
- Recency (latest guidelines > outdated editions)
- Specificity match (exact topic > general overview)
- Clinical accuracy and completeness of information"""


# ---------------------------------------------------------------------------
# RetrievalFusion
# ---------------------------------------------------------------------------

class RetrievalFusion:
    """Combines multi-layer results via RRF and reranks with LLM."""

    def reciprocal_rank_fusion(
        self,
        result_lists: list[list[RetrievalResult]],
        k: int = 60,
    ) -> list[RetrievalResult]:
        """Standard Reciprocal Rank Fusion.

        score(d) = Σ 1/(k + rank_i(d)) where k=60

        Deduplicates by content_id across result lists.
        Returns results sorted by fused score descending.
        """
        scores: dict[UUID, tuple[float, RetrievalResult]] = {}

        for result_list in result_lists:
            for rank, result in enumerate(result_list, start=1):
                rrf_score = 1.0 / (k + rank)
                key = result.content_id
                if key in scores:
                    prev_score, prev_result = scores[key]
                    scores[key] = (prev_score + rrf_score, prev_result)
                else:
                    scores[key] = (rrf_score, result)

        sorted_items = sorted(
            scores.values(), key=lambda x: x[0], reverse=True
        )

        return [
            RetrievalResult(
                content_id=result.content_id,
                content=result.content,
                source_metadata=result.source_metadata,
                score=fused_score,
                layer_source=result.layer_source,
            )
            for fused_score, result in sorted_items
        ]

    async def rerank(
        self,
        query: str,
        results: list[RetrievalResult],
        gateway: Any,
        db: AsyncSession,
        college_id: Any,
        top_k: int = 5,
    ) -> list[RetrievalResult]:
        """Rerank results using Haiku via AI Gateway.

        Sends up to 20 (query, passage) pairs to Haiku with structured
        output for relevance ranking. Falls back to RRF order on failure.

        Future: replace with cross-encoder/ms-marco-MiniLM-L-12-v2
        or Cohere Rerank v3 (medical domain fine-tuned).
        """
        if len(results) <= 1:
            return results[:top_k]

        # Cap candidates at 20 for cost efficiency.
        candidates = results[:20]

        passages_text = "\n\n".join(
            f"[{i}] {r.content[:500]}"
            for i, r in enumerate(candidates)
        )
        user_message = (
            f"Query: {query}\n\n"
            f"Passages:\n{passages_text}\n\n"
            f"Return the indices of the top {top_k} most relevant passages."
        )

        try:
            rerank_result = await gateway.complete_structured(
                db,
                system_prompt=_RERANK_PROMPT,
                user_message=user_message,
                output_schema=_RerankOutput,
                model="claude-haiku-4-5-20251001",
                college_id=college_id,
                agent_id="retrieval_reranker",
                task_type="retrieval_routing",
                cache_system_prompt=True,
                max_tokens=256,
                temperature=0.0,
            )

            # Reorder candidates by LLM-produced ranking.
            reranked: list[RetrievalResult] = []
            seen: set[int] = set()
            for idx in rerank_result.ranked_indices:
                if 0 <= idx < len(candidates) and idx not in seen:
                    reranked.append(candidates[idx])
                    seen.add(idx)

            # Append any candidates the LLM missed (safety net).
            for i, candidate in enumerate(candidates):
                if i not in seen:
                    reranked.append(candidate)

            return reranked[:top_k]

        except Exception:
            logger.warning(
                "Reranking failed — returning RRF-ordered results",
                exc_info=True,
            )
            return results[:top_k]
