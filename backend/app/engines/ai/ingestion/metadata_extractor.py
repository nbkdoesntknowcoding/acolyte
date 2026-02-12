"""Metadata extraction via Haiku — Section L1 of architecture document.

Uses Claude Haiku to classify each chunk with structured medical metadata:
- subject (Pharmacology, Pathology, Anatomy, etc.)
- topic (Antihypertensives, Glomerulonephritis, etc.)
- medical_entity_type (disease, drug, procedure, anatomy, physiology, etc.)
- blooms_level (remember, understand, apply, analyze, evaluate)
- organ_system (cardiovascular, respiratory, etc.)
- content_type (theory, clinical_case, table, protocol, etc.)

Cost: ~$0.80/M input tokens with Haiku — negligible for batch ingestion.
All calls go through AIGateway to respect budget limits.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.gateway import AIGateway

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Classification result
# ---------------------------------------------------------------------------

@dataclass
class ChunkMetadata:
    """Structured metadata extracted from a text chunk."""

    subject: str
    topic: str
    medical_entity_type: str | None = None
    blooms_level: str = "understand"
    organ_system: str | None = None
    content_type: str = "theory"
    key_terms: list[str] | None = None


# ---------------------------------------------------------------------------
# Classification prompt
# ---------------------------------------------------------------------------

_CLASSIFY_SYSTEM_PROMPT = """\
You are a medical education content classifier. Given a text chunk from a \
medical textbook, extract structured metadata.

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "subject": "<medical subject: Pharmacology, Pathology, Anatomy, Physiology, Biochemistry, Microbiology, Forensic Medicine, Community Medicine, Medicine, Surgery, OBG, Pediatrics, Ophthalmology, ENT, Orthopedics, Dermatology, Psychiatry, Radiology, Anesthesiology, or Other>",
  "topic": "<specific topic within the subject>",
  "medical_entity_type": "<disease|drug|procedure|anatomy|physiology|biochemical_pathway|microorganism|investigation|null>",
  "blooms_level": "<remember|understand|apply|analyze|evaluate>",
  "organ_system": "<cardiovascular|respiratory|gastrointestinal|nervous|musculoskeletal|endocrine|renal|reproductive|hematological|integumentary|immune|multisystem|null>",
  "content_type": "<theory|clinical_case|table|protocol|differential_diagnosis|drug_dosage|surgical_technique|investigation_guide|null>",
  "key_terms": ["<up to 5 key medical terms in this chunk>"]
}"""


def _build_classify_message(chunk_text: str, document_title: str) -> str:
    """Build the user message for classification."""
    return (
        f"Document: {document_title}\n\n"
        f"Text chunk:\n{chunk_text[:3000]}"
    )


# ---------------------------------------------------------------------------
# MetadataExtractor
# ---------------------------------------------------------------------------

class MetadataExtractor:
    """Haiku-based medical content classifier.

    Classifies text chunks with structured metadata via the AIGateway.
    Batches chunks to minimize API calls where possible.
    """

    def __init__(self, gateway: AIGateway) -> None:
        self._gateway = gateway

    async def classify_chunk(
        self,
        db: AsyncSession,
        chunk_text: str,
        document_title: str,
        college_id: UUID,
    ) -> ChunkMetadata:
        """Classify a single chunk with medical metadata via Haiku.

        Falls back to basic defaults if classification fails.
        """
        try:
            response = await self._gateway.complete(
                db,
                system_prompt=_CLASSIFY_SYSTEM_PROMPT,
                user_message=_build_classify_message(
                    chunk_text, document_title,
                ),
                model="claude-haiku-4-5-20251001",
                college_id=college_id,
                agent_id="content_classifier",
                task_type="metadata_extraction",
                max_tokens=512,
                temperature=0.0,
            )

            return self._parse_response(response.content)

        except Exception as e:
            logger.warning(
                "Metadata classification failed, using defaults: %s", e,
            )
            return ChunkMetadata(subject="Other", topic="Unclassified")

    async def classify_chunks_batch(
        self,
        db: AsyncSession,
        chunks: list[tuple[str, str]],
        college_id: UUID,
    ) -> list[ChunkMetadata]:
        """Classify multiple chunks sequentially.

        Args:
            chunks: List of (chunk_text, document_title) tuples.

        For very large batches (100+ chunks), consider using the Batch API
        through AIGateway for 50% cost savings. This method uses sequential
        calls which are simpler and sufficient for typical uploads (10-50 chunks).
        """
        results: list[ChunkMetadata] = []
        for chunk_text, doc_title in chunks:
            metadata = await self.classify_chunk(
                db, chunk_text, doc_title, college_id,
            )
            results.append(metadata)
        return results

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------

    def _parse_response(self, content: str) -> ChunkMetadata:
        """Parse Haiku JSON response into ChunkMetadata."""
        # Strip markdown fences if present
        text = content.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:])
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        data = json.loads(text)

        return ChunkMetadata(
            subject=data.get("subject", "Other"),
            topic=data.get("topic", "Unclassified"),
            medical_entity_type=data.get("medical_entity_type"),
            blooms_level=data.get("blooms_level", "understand"),
            organ_system=data.get("organ_system"),
            content_type=data.get("content_type", "theory"),
            key_terms=data.get("key_terms"),
        )
