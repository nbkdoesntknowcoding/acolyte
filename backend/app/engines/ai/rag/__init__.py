"""Medical RAG Engine — Section L1 of architecture document.

4-layer hybrid retrieval stack for medical content:
- Layer 1: BM25 keyword search (drug names, codes, exact terms)
- Layer 2: pgvector semantic search (conceptual understanding)
- Layer 3: Knowledge graph traversal (deferred to Phase 5)
- Layer 4: Agentic retrieval router (query classification)

Usage:
    from app.engines.ai.rag import get_rag_engine, RAGResult

    engine = get_rag_engine()
    result = await engine.retrieve(db, "What is the dose of Metformin?", college_id)
    # result.formatted_context -> XML-tagged context for the LLM
    # result.passages -> ranked RetrievalResult list
"""

from app.engines.ai.rag.engine import (  # noqa: F401
    MedicalRAGEngine,
    get_rag_engine,
)
from app.engines.ai.rag.models import (  # noqa: F401
    QueryClassification,
    RAGResult,
    RetrievalPlan,
    RetrievalResult,
)
