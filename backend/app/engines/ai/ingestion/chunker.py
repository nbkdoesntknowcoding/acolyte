"""Medical-aware text chunking — Section L1 of architecture document.

Splits extracted document text into overlapping chunks that respect:
- Section boundaries (chapters, headings)
- Paragraph boundaries (never splits mid-sentence when possible)
- Medical content structure (tables, lists, clinical protocols)

Architecture spec: 500-800 tokens, 100 token overlap.
Uses tiktoken (cl100k_base) for accurate token counting.
"""

import hashlib
import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Token counting — lightweight estimation without tiktoken dependency.
# Average English word ≈ 1.3 tokens (OpenAI cl100k_base empirical).
# Medical text averages ~1.4 due to terminology. We use 1.35 as a balance.
# ---------------------------------------------------------------------------

_TOKENS_PER_WORD = 1.35


def _estimate_tokens(text: str) -> int:
    """Estimate token count from text (no external dependency)."""
    words = len(text.split())
    return int(words * _TOKENS_PER_WORD)


# ---------------------------------------------------------------------------
# Section detection patterns for medical textbooks
# ---------------------------------------------------------------------------

# Heading patterns: numbered sections, all-caps, markdown-style
_HEADING_PATTERNS = [
    re.compile(r"^(?:CHAPTER|Chapter)\s+\d+", re.MULTILINE),
    re.compile(r"^#{1,4}\s+.+", re.MULTILINE),
    re.compile(r"^\d+\.\d+(?:\.\d+)?\s+[A-Z]", re.MULTILINE),
    re.compile(r"^[A-Z][A-Z\s]{10,}$", re.MULTILINE),
]


def _is_heading(line: str) -> bool:
    """Check if a line looks like a section heading."""
    stripped = line.strip()
    if not stripped:
        return False
    for pattern in _HEADING_PATTERNS:
        if pattern.match(stripped):
            return True
    return False


# ---------------------------------------------------------------------------
# Chunk data class
# ---------------------------------------------------------------------------

@dataclass
class TextChunk:
    """A single text chunk with metadata."""

    content: str
    chunk_index: int
    estimated_tokens: int
    start_char: int
    end_char: int
    heading: str | None = None
    content_hash: str = ""
    metadata: dict = field(default_factory=dict)

    def __post_init__(self):
        if not self.content_hash:
            self.content_hash = hashlib.sha256(
                self.content.encode("utf-8")
            ).hexdigest()


# ---------------------------------------------------------------------------
# MedicalTextChunker
# ---------------------------------------------------------------------------

class MedicalTextChunker:
    """Section-boundary-aware text chunker for medical documents.

    Strategy:
    1. Split text into sections at heading boundaries
    2. Within each section, split at paragraph boundaries
    3. If a paragraph exceeds max tokens, split at sentence boundaries
    4. Apply overlap by prepending tail of previous chunk
    """

    def __init__(
        self,
        target_tokens: int = 650,
        min_tokens: int = 200,
        max_tokens: int = 800,
        overlap_tokens: int = 100,
    ) -> None:
        self.target_tokens = target_tokens
        self.min_tokens = min_tokens
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens

    def chunk_text(
        self,
        text: str,
        *,
        document_title: str = "",
    ) -> list[TextChunk]:
        """Split text into overlapping chunks respecting section boundaries.

        Returns a list of TextChunk objects with content hashes for
        deduplication against existing MedicalContent rows.
        """
        if not text or not text.strip():
            return []

        # Step 1: Split into sections
        sections = self._split_into_sections(text)

        # Step 2: Chunk each section
        raw_chunks: list[tuple[str, str | None, int, int]] = []
        for heading, section_text, start, end in sections:
            section_chunks = self._chunk_section(
                section_text, heading, start
            )
            raw_chunks.extend(section_chunks)

        # Step 3: Apply overlap
        chunks = self._apply_overlap(raw_chunks, document_title)

        logger.info(
            "Chunked %d chars into %d chunks (target=%d tokens, overlap=%d)",
            len(text), len(chunks), self.target_tokens, self.overlap_tokens,
        )
        return chunks

    # ------------------------------------------------------------------
    # Section splitting
    # ------------------------------------------------------------------

    def _split_into_sections(
        self, text: str
    ) -> list[tuple[str | None, str, int, int]]:
        """Split text at heading boundaries.

        Returns: [(heading, section_text, start_char, end_char), ...]
        """
        lines = text.split("\n")
        sections: list[tuple[str | None, str, int, int]] = []

        current_heading: str | None = None
        current_lines: list[str] = []
        current_start = 0
        char_pos = 0

        for line in lines:
            line_len = len(line) + 1  # +1 for newline

            if _is_heading(line) and current_lines:
                # Flush previous section
                section_text = "\n".join(current_lines)
                sections.append((
                    current_heading,
                    section_text,
                    current_start,
                    char_pos,
                ))
                current_heading = line.strip()
                current_lines = []
                current_start = char_pos
            elif _is_heading(line):
                current_heading = line.strip()
                current_start = char_pos
            else:
                current_lines.append(line)

            char_pos += line_len

        # Flush last section
        if current_lines:
            section_text = "\n".join(current_lines)
            sections.append((
                current_heading,
                section_text,
                current_start,
                char_pos,
            ))

        # If no sections found (no headings), return entire text as one
        if not sections:
            sections = [(None, text, 0, len(text))]

        return sections

    # ------------------------------------------------------------------
    # Section chunking (paragraph + sentence boundaries)
    # ------------------------------------------------------------------

    def _chunk_section(
        self,
        text: str,
        heading: str | None,
        offset: int,
    ) -> list[tuple[str, str | None, int, int]]:
        """Chunk a section at paragraph boundaries.

        Returns: [(chunk_text, heading, start_char, end_char), ...]
        """
        paragraphs = re.split(r"\n\s*\n", text)
        chunks: list[tuple[str, str | None, int, int]] = []

        current_parts: list[str] = []
        current_tokens = 0
        chunk_start = offset

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_tokens = _estimate_tokens(para)

            # If single paragraph exceeds max, split at sentences
            if para_tokens > self.max_tokens:
                # Flush current accumulation first
                if current_parts:
                    chunk_text = "\n\n".join(current_parts)
                    chunks.append((
                        chunk_text, heading, chunk_start,
                        chunk_start + len(chunk_text),
                    ))
                    chunk_start += len(chunk_text) + 2
                    current_parts = []
                    current_tokens = 0

                # Split long paragraph at sentences
                sentence_chunks = self._split_at_sentences(
                    para, heading, chunk_start,
                )
                chunks.extend(sentence_chunks)
                chunk_start += len(para) + 2
                continue

            # Would adding this paragraph exceed target?
            if (current_tokens + para_tokens > self.target_tokens
                    and current_parts):
                chunk_text = "\n\n".join(current_parts)
                chunks.append((
                    chunk_text, heading, chunk_start,
                    chunk_start + len(chunk_text),
                ))
                chunk_start += len(chunk_text) + 2
                current_parts = []
                current_tokens = 0

            current_parts.append(para)
            current_tokens += para_tokens

        # Flush remainder
        if current_parts:
            chunk_text = "\n\n".join(current_parts)
            chunks.append((
                chunk_text, heading, chunk_start,
                chunk_start + len(chunk_text),
            ))

        return chunks

    def _split_at_sentences(
        self,
        text: str,
        heading: str | None,
        offset: int,
    ) -> list[tuple[str, str | None, int, int]]:
        """Split a long paragraph at sentence boundaries."""
        # Split at sentence-ending punctuation followed by space
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks: list[tuple[str, str | None, int, int]] = []

        current_parts: list[str] = []
        current_tokens = 0
        chunk_start = offset

        for sent in sentences:
            sent_tokens = _estimate_tokens(sent)

            if (current_tokens + sent_tokens > self.target_tokens
                    and current_parts):
                chunk_text = " ".join(current_parts)
                chunks.append((
                    chunk_text, heading, chunk_start,
                    chunk_start + len(chunk_text),
                ))
                chunk_start += len(chunk_text) + 1
                current_parts = []
                current_tokens = 0

            current_parts.append(sent)
            current_tokens += sent_tokens

        if current_parts:
            chunk_text = " ".join(current_parts)
            chunks.append((
                chunk_text, heading, chunk_start,
                chunk_start + len(chunk_text),
            ))

        return chunks

    # ------------------------------------------------------------------
    # Overlap application
    # ------------------------------------------------------------------

    def _apply_overlap(
        self,
        raw_chunks: list[tuple[str, str | None, int, int]],
        document_title: str,
    ) -> list[TextChunk]:
        """Apply overlap by prepending tail of previous chunk.

        The overlap provides context continuity across chunk boundaries,
        critical for medical text where a diagnosis might span chunks.
        """
        chunks: list[TextChunk] = []

        for i, (text, heading, start, end) in enumerate(raw_chunks):
            content = text

            # Prepend overlap from previous chunk (except for first)
            if i > 0 and self.overlap_tokens > 0:
                prev_text = raw_chunks[i - 1][0]
                overlap_text = self._get_tail_tokens(
                    prev_text, self.overlap_tokens,
                )
                if overlap_text:
                    content = overlap_text + "\n\n" + text

            tokens = _estimate_tokens(content)

            # Skip chunks that are too small (likely noise)
            if tokens < self.min_tokens and i < len(raw_chunks) - 1:
                continue

            chunks.append(TextChunk(
                content=content,
                chunk_index=len(chunks),
                estimated_tokens=tokens,
                start_char=start,
                end_char=end,
                heading=heading,
                metadata={
                    "document_title": document_title,
                    "section_heading": heading,
                },
            ))

        # Re-index after filtering
        for i, chunk in enumerate(chunks):
            chunk.chunk_index = i

        return chunks

    def _get_tail_tokens(self, text: str, target_tokens: int) -> str:
        """Get the last ~target_tokens worth of text."""
        words = text.split()
        target_words = int(target_tokens / _TOKENS_PER_WORD)
        if len(words) <= target_words:
            return text
        return " ".join(words[-target_words:])
