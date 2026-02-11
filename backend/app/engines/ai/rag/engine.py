"""Medical RAG Engine — Section L1 of architecture document.

The orchestrator. Receives a query, routes it through the agentic router,
executes retrieval across selected layers, fuses results via Reciprocal
Rank Fusion, reranks, and returns structured context ready for LLM
consumption.

For MVP: Layers 1 (BM25) + 2 (pgvector) + Layer 4 (Agentic Router).
Layer 3 (full Neo4j knowledge graph traversal) deferred to Phase 5 —
basic graph queries are handled by MedicalKnowledgeServer tools.

Usage:
    from app.engines.ai.rag import get_rag_engine

    engine = get_rag_engine()
    result = await engine.retrieve(db, "What is the dose of Metformin?", college_id)
    # result.formatted_context → XML-tagged context for the LLM
    # result.passages → list of RetrievalResult
"""

import logging
from functools import lru_cache
from typing import Any
from uuid import UUID
from xml.sax.saxutils import escape, quoteattr

from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.rag.bm25_search import BM25MedicalSearch
from app.engines.ai.rag.fusion import RetrievalFusion
from app.engines.ai.rag.models import (
    QueryClassification,
    RAGResult,
    RetrievalPlan,
    RetrievalResult,
)
from app.engines.ai.rag.router import AgenticRetrievalRouter
from app.engines.ai.rag.semantic_search import SemanticMedicalSearch

logger = logging.getLogger(__name__)


class MedicalRAGEngine:
    """Orchestrates the 4-layer hybrid retrieval stack.

    Pipeline: route → retrieve → fuse (RRF) → rerank → format
    """

    def __init__(self, gateway: Any, openai_api_key: str) -> None:
        self._gateway = gateway
        self._bm25 = BM25MedicalSearch()
        self._semantic = SemanticMedicalSearch(openai_api_key)
        self._fusion = RetrievalFusion()
        self._router = AgenticRetrievalRouter(gateway)

    async def retrieve(
        self,
        db: AsyncSession,
        query: str,
        college_id: UUID | None = None,
        filters: dict[str, Any] | None = None,
        top_k: int = 5,
    ) -> RAGResult:
        """Full RAG pipeline: route → retrieve → fuse → rerank → format.

        Steps:
        1. Route: classify query via Haiku, get retrieval plan
        2. Execute: run selected retrieval layers (sequentially — same db
           session cannot support concurrent asyncpg queries)
        3. Fuse: combine with Reciprocal Rank Fusion (k=60)
        4. Rerank: score top candidates with Haiku
        5. Format: assemble into XML-tagged context for the LLM
        """
        # 1. Route — classify query and get retrieval plan.
        plan = await self._router.route(
            query, db=db, college_id=college_id, filters=filters,
        )

        # 2. Execute — run active layers.
        # NOTE: Layers run sequentially because they share the same
        # AsyncSession, and asyncpg does not support concurrent queries
        # on a single connection. The OpenAI embedding call (HTTP) in
        # semantic search is the main latency; the DB queries are fast.
        layer_results = await self._execute_layers(
            plan, db, query, college_id, filters, top_k,
        )

        # 3. Fuse — combine with RRF.
        fused = self._fusion.reciprocal_rank_fusion(layer_results)
        total_results = len(fused)

        # Retrieval failure handling: if < 3 results and not all layers
        # were active, broaden to all layers.
        if len(fused) < 3 and len(plan.active_layers) < len({"bm25", "semantic"}):
            logger.info(
                "Few results (%d) — broadening to all layers", len(fused),
            )
            all_results = await self._execute_all_layers(
                db, query, college_id, filters, top_k,
            )
            fused = self._fusion.reciprocal_rank_fusion(all_results)
            total_results = len(fused)

        # 4. Rerank — score top candidates.
        if plan.reranking_enabled and college_id is not None and len(fused) > top_k:
            reranked = await self._fusion.rerank(
                query, fused, self._gateway, db, college_id, top_k,
            )
        else:
            reranked = fused[:top_k]

        # 5. Format — assemble structured context.
        classification = QueryClassification(
            category=plan.primary_layer.upper(),
            active_layers=plan.active_layers,
            primary_layer=plan.primary_layer,
        )
        formatted = self._format_context(reranked)

        return RAGResult(
            passages=reranked,
            formatted_context=formatted,
            query_classification=classification,
            total_results=total_results,
        )

    # ------------------------------------------------------------------
    # Layer execution
    # ------------------------------------------------------------------

    async def _execute_layers(
        self,
        plan: RetrievalPlan,
        db: AsyncSession,
        query: str,
        college_id: UUID | None,
        filters: dict[str, Any] | None,
        top_k: int,
    ) -> list[list[RetrievalResult]]:
        """Run retrieval layers specified in the plan sequentially."""
        layer_results: list[list[RetrievalResult]] = []

        for layer_name in plan.active_layers:
            try:
                if layer_name == "bm25":
                    results = await self._bm25.search(
                        db, query, college_id, filters, top_k,
                    )
                elif layer_name == "semantic":
                    results = await self._semantic.search(
                        db, query, college_id, filters, top_k,
                    )
                else:
                    continue
                layer_results.append(results)
            except Exception:
                logger.warning(
                    "Layer %s failed", layer_name, exc_info=True,
                )

        return layer_results

    async def _execute_all_layers(
        self,
        db: AsyncSession,
        query: str,
        college_id: UUID | None,
        filters: dict[str, Any] | None,
        top_k: int,
    ) -> list[list[RetrievalResult]]:
        """Run ALL available layers — used for broadened search fallback."""
        layer_results: list[list[RetrievalResult]] = []

        for layer_name, search_fn in [
            ("bm25", self._bm25.search),
            ("semantic", self._semantic.search),
        ]:
            try:
                results = await search_fn(
                    db, query, college_id, filters, top_k,
                )
                layer_results.append(results)
            except Exception:
                logger.warning(
                    "Broadened search — layer %s failed",
                    layer_name,
                    exc_info=True,
                )

        return layer_results

    # ------------------------------------------------------------------
    # Context assembly
    # ------------------------------------------------------------------

    @staticmethod
    def _format_context(results: list[RetrievalResult]) -> str:
        """Format retrieved passages into XML-tagged context for the LLM.

        Output format (from architecture doc):
        <source book="Harrison's" chapter="12" page="347" relevance="0.94">
            Passage text here...
        </source>
        """
        if not results:
            return ""

        parts: list[str] = []
        for result in results:
            meta = result.source_metadata
            attrs: list[str] = []

            if meta.get("book"):
                attrs.append(f"book={quoteattr(meta['book'])}")
            elif meta.get("source_reference"):
                attrs.append(f"source={quoteattr(meta['source_reference'])}")

            if meta.get("title"):
                attrs.append(f"title={quoteattr(meta['title'])}")
            if meta.get("chapter"):
                attrs.append(f"chapter={quoteattr(str(meta['chapter']))}")
            if meta.get("page"):
                attrs.append(f"page={quoteattr(str(meta['page']))}")

            attrs.append(f"relevance={quoteattr(f'{result.score:.2f}')}")

            attrs_str = " ".join(attrs)
            content = escape(result.content)
            parts.append(f"<source {attrs_str}>\n{content}\n</source>")

        return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Singleton factory
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _create_rag_engine() -> MedicalRAGEngine:
    """Create singleton MedicalRAGEngine instance.

    Uses lru_cache to ensure only one instance per process.
    The OpenAI AsyncOpenAI client and AI Gateway are safe to share.
    """
    from app.config import get_settings
    from app.engines.ai.gateway_deps import get_ai_gateway

    settings = get_settings()
    gateway = get_ai_gateway()
    return MedicalRAGEngine(
        gateway=gateway,
        openai_api_key=settings.OPENAI_API_KEY,
    )


def get_rag_engine() -> MedicalRAGEngine:
    """Get the singleton MedicalRAGEngine instance."""
    return _create_rag_engine()
