"""flashcard_enhancements

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-11 22:00:00.000000

Adds columns to existing flashcards and flashcard_reviews tables for
the S5 Flashcard Generator agent:

flashcards:
  + card_type (basic/cloze/image_occlusion)
  + organ_system
  + difficulty (1-5)
  + source_citation
  + source_pdf_id
  + clinical_pearl
  + is_ai_generated
  + is_active
  + composite index on (college_id, student_id, subject, topic)

flashcard_reviews:
  + response_time_ms
  + repetition_count
  + composite index on (college_id, student_id, next_review_date)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Add columns to flashcards
    # ------------------------------------------------------------------
    op.add_column('flashcards', sa.Column(
        'card_type', sa.String(length=30), server_default='basic', nullable=False,
    ))
    op.add_column('flashcards', sa.Column(
        'organ_system', sa.String(length=100), nullable=True,
    ))
    op.add_column('flashcards', sa.Column(
        'difficulty', sa.Integer(), server_default='3', nullable=False,
    ))
    op.add_column('flashcards', sa.Column(
        'source_citation', sa.String(length=500), nullable=True,
    ))
    op.add_column('flashcards', sa.Column(
        'source_pdf_id', sa.String(length=500), nullable=True,
    ))
    op.add_column('flashcards', sa.Column(
        'clinical_pearl', sa.Text(), nullable=True,
    ))
    op.add_column('flashcards', sa.Column(
        'is_ai_generated', sa.Boolean(), server_default='true', nullable=False,
    ))
    op.add_column('flashcards', sa.Column(
        'is_active', sa.Boolean(), server_default='true', nullable=False,
    ))

    # Composite index for efficient queries by student + subject + topic
    op.create_index(
        'ix_flashcards_student_subject_topic',
        'flashcards',
        ['college_id', 'student_id', 'subject', 'topic'],
        unique=False,
    )

    # Index for active cards filtering
    op.create_index(
        'ix_flashcards_student_active',
        'flashcards',
        ['college_id', 'student_id', 'is_active'],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 2. Add columns to flashcard_reviews
    # ------------------------------------------------------------------
    op.add_column('flashcard_reviews', sa.Column(
        'response_time_ms', sa.Integer(), nullable=True,
    ))
    op.add_column('flashcard_reviews', sa.Column(
        'repetition_count', sa.Integer(), server_default='0', nullable=False,
    ))

    # Composite index for review session queries (due cards)
    op.create_index(
        'ix_flashcard_reviews_student_next_review',
        'flashcard_reviews',
        ['college_id', 'student_id', 'next_review_date'],
        unique=False,
    )


def downgrade() -> None:
    # ------------------------------------------------------------------
    # Drop indexes
    # ------------------------------------------------------------------
    op.drop_index('ix_flashcard_reviews_student_next_review', table_name='flashcard_reviews')
    op.drop_index('ix_flashcards_student_active', table_name='flashcards')
    op.drop_index('ix_flashcards_student_subject_topic', table_name='flashcards')

    # ------------------------------------------------------------------
    # Drop columns from flashcard_reviews
    # ------------------------------------------------------------------
    op.drop_column('flashcard_reviews', 'repetition_count')
    op.drop_column('flashcard_reviews', 'response_time_ms')

    # ------------------------------------------------------------------
    # Drop columns from flashcards
    # ------------------------------------------------------------------
    op.drop_column('flashcards', 'is_active')
    op.drop_column('flashcards', 'is_ai_generated')
    op.drop_column('flashcards', 'clinical_pearl')
    op.drop_column('flashcards', 'source_pdf_id')
    op.drop_column('flashcards', 'source_citation')
    op.drop_column('flashcards', 'difficulty')
    op.drop_column('flashcards', 'organ_system')
    op.drop_column('flashcards', 'card_type')
