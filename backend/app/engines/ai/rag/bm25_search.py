"""Layer 1: BM25 Keyword Search — Section L1 of architecture document.

PostgreSQL full-text search optimized for medical terminology.
Uses ts_vector with built-in 'english' dictionary.

Why BM25 for medical content (from architecture doc):
- Drug names need exact matching (Metformin, not "diabetes medication")
- Dosage queries ("500mg BD") are not semantic
- ICD codes, NMC competency codes require precise matching
- Medical abbreviations (MI, CHF, COPD) must match exactly
"""

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import MedicalContent
from app.engines.ai.rag.models import RetrievalResult

logger = logging.getLogger(__name__)


class BM25MedicalSearch:
    """PostgreSQL full-text search using the search_vector tsvector column.

    Queries MedicalContent.search_vector (generated tsvector) with
    plainto_tsquery and ts_rank_cd for BM25-style ranking.
    """

    async def search(
        self,
        db: AsyncSession,
        query: str,
        college_id: UUID | None = None,
        filters: dict[str, Any] | None = None,
        top_k: int = 10,
    ) -> list[RetrievalResult]:
        """Execute BM25 keyword search against MedicalContent.

        Includes both college-specific AND platform-wide content
        (WHERE college_id = $1 OR college_id IS NULL).
        """
        stmt = (
            select(
                MedicalContent.id,
                MedicalContent.title,
                MedicalContent.content,
                MedicalContent.source_type,
                MedicalContent.source_reference,
                MedicalContent.metadata_,
                MedicalContent.medical_entity_type,
                func.ts_rank_cd(
                    text("search_vector"),
                    func.plainto_tsquery("english", query),
                ).label("bm25_rank"),
            )
            .where(
                text("search_vector @@ plainto_tsquery('english', :query)"),
                MedicalContent.is_active.is_(True),
            )
            .params(query=query)
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

        stmt = stmt.order_by(text("bm25_rank DESC")).limit(top_k)

        result = await db.execute(stmt)
        rows = result.all()

        results: list[RetrievalResult] = []
        for row in rows:
            metadata = row.metadata_ or {}
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
                    score=float(row.bm25_rank) if row.bm25_rank else 0.0,
                    layer_source="bm25",
                )
            )

        return results
