"""MedicalContentIngester — Section L1 of architecture document.

Main entry point for the content ingestion pipeline. Processes uploaded
medical PDFs into searchable, embedded chunks in the MedicalContent table.

Pipeline:
    PDF bytes → PyMuPDF text extraction → MedicalTextChunker (500-800 tokens,
    100 overlap) → MetadataExtractor (Haiku classification) →
    OpenAI text-embedding-3-large (1536 dims) → MedicalContent INSERT
    (with content_hash deduplication).

Without this pipeline, the RAG engine has no content to search.
"""

import hashlib
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from openai import AsyncOpenAI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.gateway import AIGateway
from app.engines.ai.ingestion.chunker import MedicalTextChunker
from app.engines.ai.ingestion.metadata_extractor import MetadataExtractor
from app.engines.ai.models import MedicalContent
from app.engines.ai.rag.semantic_search import (
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result data classes
# ---------------------------------------------------------------------------

@dataclass
class IngestionResult:
    """Result from processing a single document."""

    document_id: UUID
    filename: str
    total_chunks: int
    chunks_stored: int
    chunks_skipped_duplicate: int
    pages_extracted: int
    source_type: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "document_id": str(self.document_id),
            "filename": self.filename,
            "total_chunks": self.total_chunks,
            "chunks_stored": self.chunks_stored,
            "chunks_skipped_duplicate": self.chunks_skipped_duplicate,
            "pages_extracted": self.pages_extracted,
            "source_type": self.source_type,
        }


@dataclass
class ContentStats:
    """Content statistics for a college."""

    total_documents: int
    total_chunks: int
    active_chunks: int
    chunks_with_embeddings: int
    source_type_breakdown: dict[str, int]
    subject_breakdown: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_documents": self.total_documents,
            "total_chunks": self.total_chunks,
            "active_chunks": self.active_chunks,
            "chunks_with_embeddings": self.chunks_with_embeddings,
            "source_type_breakdown": self.source_type_breakdown,
            "subject_breakdown": self.subject_breakdown,
        }


# ---------------------------------------------------------------------------
# MedicalContentIngester
# ---------------------------------------------------------------------------

class MedicalContentIngester:
    """Main content ingestion pipeline.

    Coordinates PDF extraction, chunking, metadata classification,
    embedding generation, and storage.
    """

    def __init__(
        self,
        openai_api_key: str,
        gateway: AIGateway,
    ) -> None:
        self._openai = AsyncOpenAI(api_key=openai_api_key)
        self._gateway = gateway
        self._chunker = MedicalTextChunker()
        self._extractor = MetadataExtractor(gateway)

    # ------------------------------------------------------------------
    # Main pipeline
    # ------------------------------------------------------------------

    async def ingest_pdf(
        self,
        db: AsyncSession,
        file_bytes: bytes,
        filename: str,
        college_id: UUID | None = None,
        source_type: str = "textbook",
    ) -> IngestionResult:
        """Process a PDF file through the full ingestion pipeline.

        Args:
            db: Database session (must be committed by the caller).
            file_bytes: Raw PDF bytes.
            filename: Original filename for reference.
            college_id: None for platform-wide, UUID for college-specific.
            source_type: Content type (textbook, lecture_notes, guidelines, etc.)

        Returns:
            IngestionResult with chunk counts and document ID.
        """
        document_id = uuid4()

        # Step 1: Extract text from PDF
        logger.info("Ingesting PDF: %s (%d bytes)", filename, len(file_bytes))
        pages = self._extract_pdf_text(file_bytes)
        full_text = "\n\n".join(pages)

        if not full_text.strip():
            logger.warning("No text extracted from PDF: %s", filename)
            return IngestionResult(
                document_id=document_id,
                filename=filename,
                total_chunks=0,
                chunks_stored=0,
                chunks_skipped_duplicate=0,
                pages_extracted=0,
                source_type=source_type,
            )

        logger.info(
            "Extracted %d pages, %d chars from %s",
            len(pages), len(full_text), filename,
        )

        # Step 2: Chunk the text
        chunks = self._chunker.chunk_text(
            full_text, document_title=filename,
        )
        total_chunks = len(chunks)
        logger.info("Created %d chunks from %s", total_chunks, filename)

        # Step 3: Check for duplicates (by content_hash)
        existing_hashes = await self._get_existing_hashes(
            db, [c.content_hash for c in chunks],
        )

        # Step 4: Process non-duplicate chunks
        new_chunks = [
            c for c in chunks if c.content_hash not in existing_hashes
        ]
        skipped = total_chunks - len(new_chunks)

        if not new_chunks:
            logger.info("All %d chunks already exist, skipping", total_chunks)
            return IngestionResult(
                document_id=document_id,
                filename=filename,
                total_chunks=total_chunks,
                chunks_stored=0,
                chunks_skipped_duplicate=skipped,
                pages_extracted=len(pages),
                source_type=source_type,
            )

        # Step 5: Classify metadata via Haiku
        # Use the actual college_id for budget tracking; fall back to a
        # zero UUID for platform-wide content.
        classify_college = college_id or UUID(int=0)
        metadata_list = await self._extractor.classify_chunks_batch(
            db,
            [(c.content, filename) for c in new_chunks],
            classify_college,
        )

        # Step 6: Generate embeddings
        embeddings = await self._embed_chunks(
            [c.content for c in new_chunks],
        )

        # Step 7: Store in MedicalContent table
        stored = 0
        for chunk, metadata, embedding in zip(
            new_chunks, metadata_list, embeddings, strict=True,
        ):
            record = MedicalContent(
                id=uuid4(),
                college_id=college_id,
                source_type=source_type,
                title=self._build_chunk_title(filename, chunk),
                content=chunk.content,
                content_hash=chunk.content_hash,
                embedding=embedding,
                chunk_index=chunk.chunk_index,
                total_chunks=total_chunks,
                parent_document_id=document_id,
                metadata_={
                    "book": filename,
                    "chapter": chunk.heading or "",
                    "subject": metadata.subject,
                    "topic": metadata.topic,
                    "blooms_level": metadata.blooms_level,
                    "organ_system": metadata.organ_system or "",
                    "content_type": metadata.content_type,
                    "key_terms": metadata.key_terms or [],
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                    "estimated_tokens": chunk.estimated_tokens,
                },
                source_reference=filename,
                medical_entity_type=metadata.medical_entity_type,
                is_active=True,
            )
            db.add(record)
            stored += 1

        await db.flush()
        logger.info(
            "Stored %d chunks for %s (skipped %d duplicates)",
            stored, filename, skipped,
        )

        return IngestionResult(
            document_id=document_id,
            filename=filename,
            total_chunks=total_chunks,
            chunks_stored=stored,
            chunks_skipped_duplicate=skipped,
            pages_extracted=len(pages),
            source_type=source_type,
        )

    # ------------------------------------------------------------------
    # PDF text extraction
    # ------------------------------------------------------------------

    def _extract_pdf_text(self, file_bytes: bytes) -> list[str]:
        """Extract text from PDF using PyMuPDF.

        Returns a list of strings, one per page.
        PyMuPDF (fitz) is the fastest Python PDF library — 10x faster
        than PyPDF2, supports OCR fallback via Tesseract if needed.
        """
        import fitz  # PyMuPDF

        pages: list[str] = []

        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                text = page.get_text("text")
                # Clean up common PDF artifacts
                text = self._clean_pdf_text(text)
                if text.strip():
                    pages.append(text)

        return pages

    @staticmethod
    def _clean_pdf_text(text: str) -> str:
        """Clean common PDF extraction artifacts."""
        import re

        # Remove excessive whitespace but preserve paragraph breaks
        text = re.sub(r"[ \t]+", " ", text)
        # Normalize line breaks (PDF often has many single newlines)
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Remove page headers/footers (common patterns)
        text = re.sub(
            r"^\s*(?:Page\s+\d+|\d+\s*$)",
            "",
            text,
            flags=re.MULTILINE,
        )
        return text.strip()

    # ------------------------------------------------------------------
    # Embedding generation
    # ------------------------------------------------------------------

    async def _embed_chunks(
        self, texts: list[str]
    ) -> list[list[float]]:
        """Generate embeddings for multiple text chunks.

        Uses OpenAI batch embedding API — up to 2048 inputs per call.
        text-embedding-3-large with dimensions=1536 for Neon pgvector
        2000-dim index limit compatibility.
        """
        embeddings: list[list[float]] = []
        batch_size = 100  # OpenAI recommends ≤2048, we use 100 for safety

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            response = await self._openai.embeddings.create(
                model=EMBEDDING_MODEL,
                input=batch,
                dimensions=EMBEDDING_DIMENSIONS,
            )
            # Response data is ordered by index
            batch_embeddings = [
                item.embedding
                for item in sorted(response.data, key=lambda x: x.index)
            ]
            embeddings.extend(batch_embeddings)

        return embeddings

    # ------------------------------------------------------------------
    # Deduplication
    # ------------------------------------------------------------------

    @staticmethod
    async def _get_existing_hashes(
        db: AsyncSession, hashes: list[str],
    ) -> set[str]:
        """Check which content hashes already exist in the database."""
        if not hashes:
            return set()

        # Query in batches to avoid overly large IN clauses
        existing: set[str] = set()
        batch_size = 500

        for i in range(0, len(hashes), batch_size):
            batch = hashes[i : i + batch_size]
            result = await db.execute(
                select(MedicalContent.content_hash).where(
                    MedicalContent.content_hash.in_(batch)
                )
            )
            existing.update(row[0] for row in result.all())

        return existing

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_chunk_title(filename: str, chunk) -> str:
        """Build a descriptive title for a chunk."""
        base = filename.rsplit(".", 1)[0]  # Remove .pdf
        if chunk.heading:
            return f"{base} — {chunk.heading}"
        return f"{base} — Chunk {chunk.chunk_index + 1}"

    # ------------------------------------------------------------------
    # Content statistics
    # ------------------------------------------------------------------

    @staticmethod
    async def get_content_stats(
        db: AsyncSession,
        college_id: UUID | None = None,
    ) -> ContentStats:
        """Get content statistics for a college or platform-wide.

        Args:
            college_id: None returns platform-wide stats only,
                       UUID returns college + platform-wide combined.
        """
        # Base filter
        if college_id is not None:
            scope_filter = (
                (MedicalContent.college_id.is_(None))
                | (MedicalContent.college_id == college_id)
            )
        else:
            scope_filter = MedicalContent.college_id.is_(None)

        # Total and active chunks
        totals = await db.execute(
            select(
                func.count().label("total"),
                func.count().filter(
                    MedicalContent.is_active.is_(True)
                ).label("active"),
                func.count().filter(
                    MedicalContent.embedding.isnot(None)
                ).label("with_embeddings"),
            ).where(scope_filter)
        )
        row = totals.one()

        # Distinct documents (by parent_document_id)
        doc_count = await db.execute(
            select(
                func.count(
                    func.distinct(MedicalContent.parent_document_id)
                )
            ).where(scope_filter, MedicalContent.parent_document_id.isnot(None))
        )
        total_documents = doc_count.scalar() or 0

        # Source type breakdown
        source_result = await db.execute(
            select(
                MedicalContent.source_type,
                func.count().label("count"),
            )
            .where(scope_filter, MedicalContent.is_active.is_(True))
            .group_by(MedicalContent.source_type)
        )
        source_breakdown = {
            r.source_type: r.count for r in source_result.all()
        }

        # Subject breakdown from metadata JSONB
        subject_result = await db.execute(
            select(
                func.jsonb_extract_path_text(
                    MedicalContent.metadata_, "subject"
                ).label("subject"),
                func.count().label("count"),
            )
            .where(scope_filter, MedicalContent.is_active.is_(True))
            .group_by("subject")
            .having(
                func.jsonb_extract_path_text(
                    MedicalContent.metadata_, "subject"
                ).isnot(None)
            )
        )
        subject_breakdown = {
            r.subject: r.count for r in subject_result.all()
        }

        return ContentStats(
            total_documents=total_documents,
            total_chunks=row.total,
            active_chunks=row.active,
            chunks_with_embeddings=row.with_embeddings,
            source_type_breakdown=source_breakdown,
            subject_breakdown=subject_breakdown,
        )
