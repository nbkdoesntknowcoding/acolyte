"""Content Ingestion Pipeline — Section L1 of architecture document.

Processes uploaded medical PDFs (and future formats) into searchable,
embedded chunks in the MedicalContent table. Without this pipeline,
the RAG engine has no content to search.

Pipeline:  PDF → Extract text → Chunk → Classify metadata → Embed → Store

Usage:
    from app.engines.ai.ingestion import (
        MedicalContentIngester,
        MedicalTextChunker,
        MetadataExtractor,
    )

    ingester = MedicalContentIngester(openai_api_key, gateway)
    result = await ingester.ingest_pdf(db, file_bytes, filename, college_id)
"""

from app.engines.ai.ingestion.chunker import MedicalTextChunker  # noqa: F401
from app.engines.ai.ingestion.metadata_extractor import MetadataExtractor  # noqa: F401
from app.engines.ai.ingestion.pdf_processor import MedicalContentIngester  # noqa: F401
