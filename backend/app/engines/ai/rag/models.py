"""RAG Engine data models — Section L1 of architecture document.

Data classes for the 4-layer hybrid retrieval stack:
- RetrievalResult: single passage from any retrieval layer
- QueryClassification: agentic router output
- RetrievalPlan: which layers to activate for a query
- RAGResult: final assembled context ready for LLM consumption
"""

from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class RetrievalResult:
    """A single retrieved passage from any retrieval layer."""

    content_id: UUID
    content: str
    source_metadata: dict  # book, chapter, page, subject, topic, etc.
    score: float
    layer_source: str  # "bm25", "semantic", "knowledge_graph"


@dataclass
class QueryClassification:
    """Output from the agentic retrieval router.

    Categories (from architecture doc):
    - FACTUAL: drug names, dosages, codes, definitions → BM25 primary
    - CONCEPTUAL: explanations, pathophysiology → Vector primary
    - RELATIONAL: differentials, interactions → Graph primary (future)
    - CLINICAL_VIGNETTE: patient scenarios → Graph + Vector
    - PROCEDURAL: step-by-step processes → Vector + BM25
    - COMPARATIVE: X vs Y → All layers
    """

    category: str
    active_layers: list[str]
    primary_layer: str
    exact_match_weight: float = 1.0
    max_hops: int = 2


@dataclass
class RetrievalPlan:
    """Retrieval strategy produced by the agentic router."""

    active_layers: list[str]
    primary_layer: str
    metadata_filters: dict = field(default_factory=dict)
    bm25_boost: float = 1.0
    graph_hops: int = 2
    reranking_enabled: bool = True


@dataclass
class RAGResult:
    """Final assembled result from the RAG engine.

    passages: ranked retrieval results after reranking
    formatted_context: XML-tagged context string for LLM consumption
    query_classification: how the query was classified by the router
    total_results: total passages found before top-k cutoff
    """

    passages: list[RetrievalResult]
    formatted_context: str
    query_classification: QueryClassification
    total_results: int
