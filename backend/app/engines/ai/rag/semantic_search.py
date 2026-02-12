"""Layer 2: pgvector Semantic Search — Section L1 of architecture document.

Dense vector search using pgvector with IVFFlat indexes.
Embedding model: text-embedding-3-large (1536 dimensions via API dimensions
parameter — Neon pgvector has 2000-dim index limit).

IVFFlat chosen over HNSW (from architecture doc):
- Better recall at lower memory for bounded medical corpus
- Batch update patterns (new content uploaded periodically)
- IVFFlat handles batch updates better than HNSW's real-time indexing
"""

import logging
from typing import Any
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import MedicalContent
from app.engines.ai.rag.models import RetrievalResult

logger = logging.getLogger(__name__)

# Embedding config — Neon pgvector has 2000-dim limit for indexes.
# text-embedding-3-large supports dimensionality reduction via the API
# dimensions parameter. We use 1536 for optimal recall within the limit.
EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIMENSIONS = 1536


class SemanticMedicalSearch:
    """Dense vector search using pgvector cosine distance."""

    def __init__(self, openai_api_key: str) -> None:
        self._client = AsyncOpenAI(api_key=openai_api_key)

    async def embed_query(self, query: str) -> list[float]:
        """Generate embedding vector for a search query.

        Uses text-embedding-3-large with dimensions=1536 for Neon compat.
        Cost: $0.13/M tokens — negligible per query.
        """
        response = await self._client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=query,
            dimensions=EMBEDDING_DIMENSIONS,
        )
        return response.data[0].embedding

    async def search(
        self,
        db: AsyncSession,
        query: str,
        college_id: UUID | None = None,
        filters: dict[str, Any] | None = None,
        top_k: int = 10,
        similarity_threshold: float = 0.5,
    ) -> list[RetrievalResult]:
        """Execute semantic search against MedicalContent embeddings.

        Steps:
        1. Generate query embedding via OpenAI
        2. SET ivfflat.probes = 10 for recall/speed balance
        3. Query pgvector with <=> cosine distance
        4. Filter by similarity threshold (1 - distance > threshold)
        """
        query_embedding = await self.embed_query(query)

        # Set IVFFlat probes for recall/speed balance.
        await db.execute(text("SET ivfflat.probes = 10"))

        # pgvector <=> returns cosine distance (0 = identical, 2 = opposite).
        # similarity = 1 - distance. Filter: distance < (1 - threshold).
        cosine_dist = MedicalContent.embedding.cosine_distance(query_embedding)
        max_distance = 1.0 - similarity_threshold

        stmt = (
            select(
                MedicalContent.id,
                MedicalContent.title,
                MedicalContent.content,
                MedicalContent.source_type,
                MedicalContent.source_reference,
                MedicalContent.metadata_,
                MedicalContent.medical_entity_type,
                cosine_dist.label("distance"),
            )
            .where(
                MedicalContent.is_active.is_(True),
                MedicalContent.embedding.isnot(None),
                cosine_dist < max_distance,
            )
        )

        # College scoping: platform-wide (NULL) + college-specific.
        if college_id is not None:
            stmt = stmt.where(
                (MedicalContent.college_id.is_(None))
                | (MedicalContent.college_id == college_id)
            )
        else:
            stmt = stmt.where(MedicalContent.college_id.is_(None))

        # Metadata filters.
        if filters:
            if filters.get("content_type") and filters["content_type"] != "all":
                stmt = stmt.where(
                    MedicalContent.source_type == filters["content_type"]
                )
            if filters.get("subject"):
                stmt = stmt.where(
                    MedicalContent.medical_entity_type == filters["subject"]
                )

        stmt = stmt.order_by(cosine_dist).limit(top_k)

        result = await db.execute(stmt)
        rows = result.all()

        results: list[RetrievalResult] = []
        for row in rows:
            metadata = row.metadata_ or {}
            similarity = 1.0 - float(row.distance)
            results.append(
                RetrievalResult(
                    content_id=row.id,
                    content=row.content,
                    source_metadata={
                        "title": row.title,
                        "source_type": row.source_type,
                        "source_reference": row.source_reference,
                        "book": metadata.get("book", ""),
                        "chapter": metadata.get("chapter", ""),
                        "page": metadata.get("page", ""),
                        "subject": metadata.get("subject", ""),
                        "topic": metadata.get("topic", ""),
                    },
                    score=similarity,
                    layer_source="semantic",
                )
            )

        return results
