"""Layer 4: Agentic Retrieval Router — Section L1 of architecture document.

Lightweight classifier that determines retrieval strategy per query.
Uses Haiku (fast, cheap) to classify query intent.

Classification taxonomy (from architecture doc):
- FACTUAL: drug names, dosages, codes → BM25 primary
- CONCEPTUAL: explanations, pathophysiology → Vector primary
- RELATIONAL: differentials, interactions → Graph primary (future)
- CLINICAL_VIGNETTE: patient scenarios → Vector + Graph
- PROCEDURAL: step-by-step processes → Vector + BM25
- COMPARATIVE: X vs Y → All layers

Retrieval failure handling:
- If initial retrieval returns < 3 results → broaden query terms
- If confidence scores are all < 0.5 → try alternative strategy
- If graph traversal returns empty → fall back to vector search
"""

import logging
from typing import Any

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.rag.models import QueryClassification, RetrievalPlan

logger = logging.getLogger(__name__)

# Available layer names for MVP (no graph layer yet).
_AVAILABLE_LAYERS = {"bm25", "semantic"}

# Classification prompt — engineered for Haiku speed + accuracy.
CLASSIFICATION_PROMPT = """\
You are a medical query classifier for a medical education RAG system.

Classify the following query into exactly one category and determine the
optimal retrieval strategy.

Categories:
- FACTUAL: Specific facts, dosages, lab values, ICD codes, definitions, \
drug names, NMC competency codes. These need exact keyword matching.
- CONCEPTUAL: Explanations of mechanisms, pathophysiology, disease \
processes, pharmacological mechanisms. These need semantic understanding.
- RELATIONAL: Differential diagnoses, drug interactions, disease \
connections, symptom-disease mapping. These need relationship traversal.
- CLINICAL_VIGNETTE: Patient scenarios with symptoms requiring \
multi-entity reasoning to reach a diagnosis.
- PROCEDURAL: Step-by-step surgical/clinical processes, protocols, \
techniques, examination methods.
- COMPARATIVE: Comparing two or more entities (drugs, diseases, \
procedures, treatments, investigations).

Based on the category, determine which retrieval layers to activate:
- bm25: Keyword-based search (best for exact terms, codes, drug names)
- semantic: Dense vector search (best for conceptual understanding)

Routing rules:
- FACTUAL → primary: bm25, also activate: semantic
- CONCEPTUAL → primary: semantic, also activate: bm25
- RELATIONAL → primary: semantic, also activate: bm25
- CLINICAL_VIGNETTE → primary: semantic, also activate: bm25
- PROCEDURAL → primary: semantic, also activate: bm25
- COMPARATIVE → primary: bm25, also activate: semantic

Set exact_match_weight between 0.0 and 1.0:
- 1.0 for FACTUAL queries (keyword precision matters most)
- 0.3 for CONCEPTUAL queries (semantic understanding matters most)
- 0.5 for everything else (balanced)"""


class _QueryClassificationSchema(BaseModel):
    """Structured output schema for query classification."""

    category: str
    primary_layer: str
    active_layers: list[str]
    exact_match_weight: float


# Default fallback when the LLM classifier is unavailable.
_FALLBACK_CLASSIFICATION = QueryClassification(
    category="CONCEPTUAL",
    active_layers=["bm25", "semantic"],
    primary_layer="semantic",
    exact_match_weight=0.5,
)


class AgenticRetrievalRouter:
    """Classifies queries and produces retrieval plans using Haiku."""

    def __init__(self, gateway: Any) -> None:
        self._gateway = gateway

    async def route(
        self,
        query: str,
        db: AsyncSession,
        college_id: Any,
        filters: dict[str, Any] | None = None,
    ) -> RetrievalPlan:
        """Classify query and return a RetrievalPlan.

        Uses Haiku (fast, cheap) for classification via constrained
        decoding. Falls back to heuristic routing if the LLM call fails.
        """
        classification = await self._classify(query, db, college_id)

        # Filter to available layers only (graph not yet available).
        active = [
            layer for layer in classification.active_layers
            if layer in _AVAILABLE_LAYERS
        ]
        if not active:
            active = list(_AVAILABLE_LAYERS)

        primary = (
            classification.primary_layer
            if classification.primary_layer in _AVAILABLE_LAYERS
            else active[0]
        )

        return RetrievalPlan(
            active_layers=active,
            primary_layer=primary,
            metadata_filters=filters or {},
            bm25_boost=classification.exact_match_weight,
            reranking_enabled=True,
        )

    async def _classify(
        self,
        query: str,
        db: AsyncSession,
        college_id: Any,
    ) -> QueryClassification:
        """Run LLM classification, fall back to default on failure."""
        try:
            result = await self._gateway.complete_structured(
                db,
                system_prompt=CLASSIFICATION_PROMPT,
                user_message=query,
                output_schema=_QueryClassificationSchema,
                model="claude-haiku-4-5-20251001",
                college_id=college_id,
                agent_id="retrieval_router",
                task_type="retrieval_routing",
                cache_system_prompt=True,
                max_tokens=256,
                temperature=0.0,
            )
            return QueryClassification(
                category=result.category,
                active_layers=result.active_layers,
                primary_layer=result.primary_layer,
                exact_match_weight=result.exact_match_weight,
            )
        except Exception:
            logger.warning(
                "Retrieval router classification failed — using fallback",
                exc_info=True,
            )
            return _FALLBACK_CLASSIFICATION
