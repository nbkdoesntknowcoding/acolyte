"""Flashcard Generator — Section S5 of architecture document.

AI-powered flashcard creation from PDFs and topics, integrated with
the SM-2 spaced repetition algorithm from the Metacognitive Analytics
Engine (S8).

Principle: ONE concept per flashcard.

Card types:
- basic: question/answer
- cloze: fill-in-the-blank with {{blank}} markers
- image_occlusion: label-based (future)

Public interface:
    from app.engines.ai.agents.flashcard_generator import (
        FlashcardGenerator,
        generate_flashcards_from_pdf,
        generate_flashcards_from_topic,
        get_review_session,
        process_flashcard_review,
        get_flashcard_stats,
    )
"""

import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.agents.flashcard_schemas import (
    FlashcardBatch,
    FlashcardResponse,
    FlashcardStats,
    GeneratedFlashcardBatch,
    ReviewCard,
    ReviewSession,
    SpacedRepetitionUpdate,
)
from app.engines.ai.gateway import AIGateway
from app.engines.ai.models import (
    AgentExecution,
    ExecutionStatus,
    ExecutionType,
    StudentMetacognitiveProfile,
    TaskType,
)
from app.engines.ai.prompt_registry import PromptRegistry
from app.engines.ai.rag import get_rag_engine
from app.engines.student.models import Flashcard, FlashcardReview

logger = logging.getLogger(__name__)

AGENT_ID = "flashcard_generator"

# SM-2 defaults
DEFAULT_EASE_FACTOR = 2.5
MIN_EASE_FACTOR = 1.3


class FlashcardGenerator:
    """AI-powered flashcard generator with SM-2 spaced repetition.

    Methods:
        generate_from_pdf   — Create flashcards from a PDF document
        generate_from_topic — Create flashcards from a medical topic
        get_review_session  — Get cards due for review today
        process_review      — Process a card review and update SM-2 state
        get_stats           — Get the student's flashcard statistics
    """

    def __init__(
        self,
        db: AsyncSession,
        gateway: AIGateway,
        prompt_registry: PromptRegistry,
    ) -> None:
        self._db = db
        self._gw = gateway
        self._pr = prompt_registry

    # ------------------------------------------------------------------
    # generate_from_pdf
    # ------------------------------------------------------------------

    async def generate_from_pdf(
        self,
        *,
        student_id: UUID,
        college_id: UUID,
        pdf_id: str,
        page_range: list[int] | None = None,
        subject: str | None = None,
        topic: str | None = None,
        count: int = 20,
        card_types: list[str] | None = None,
    ) -> FlashcardBatch:
        """Generate flashcards from a PDF via RAG retrieval + Sonnet."""
        card_types = card_types or ["basic", "cloze"]
        rag = get_rag_engine()

        # Build RAG query
        query = f"Key medical concepts from PDF {pdf_id}"
        if subject:
            query += f" subject: {subject}"
        if topic:
            query += f" topic: {topic}"

        filters: dict[str, Any] = {"source_pdf_id": pdf_id}
        if page_range and len(page_range) == 2:
            filters["page_range"] = page_range

        rag_result = await rag.retrieve(
            self._db, query, college_id=college_id,
            filters=filters, top_k=10,
        )

        # Create audit execution
        execution = AgentExecution(
            college_id=college_id,
            user_id=student_id,
            agent_id=AGENT_ID,
            task_type=TaskType.FLASHCARD_GEN.value,
            execution_type=ExecutionType.SINGLE_CALL.value,
            status=ExecutionStatus.RUNNING.value,
            input_data={
                "pdf_id": pdf_id,
                "page_range": page_range,
                "subject": subject,
                "topic": topic,
                "count": count,
                "card_types": card_types,
            },
        )
        self._db.add(execution)
        await self._db.flush()

        # Build prompt
        system_prompt = self._pr.get(
            "flashcard_generator",
            fallback=(
                "You are a medical flashcard generator. Create high-quality "
                "flashcards from the provided content. Follow these rules:\n"
                "1. ONE concept per flashcard — never combine topics\n"
                "2. Use clear, concise language\n"
                "3. For cloze cards, use {{blank}} to mark deletions\n"
                "4. Include clinical pearls where relevant\n"
                "5. Tag with subject, topic, organ system, difficulty (1-5)\n"
                "6. Add source citations from the original content\n"
                "7. Difficulty 1=recall, 2=basic understanding, "
                "3=application, 4=analysis, 5=synthesis"
            ),
        )

        card_type_str = ", ".join(card_types)
        user_msg = (
            f"Generate exactly {count} flashcards from this medical content.\n"
            f"Card types to use: {card_type_str}\n"
            f"Subject: {subject or 'infer from content'}\n"
            f"Topic: {topic or 'infer from content'}\n\n"
            f"Source content:\n{rag_result.formatted_context}"
        )

        # Constrained decoding → guaranteed valid JSON
        batch: GeneratedFlashcardBatch = await self._gw.complete_structured(
            self._db,
            system_prompt=system_prompt,
            user_message=user_msg,
            output_schema=GeneratedFlashcardBatch,
            college_id=college_id,
            user_id=student_id,
            agent_id=AGENT_ID,
            task_type=TaskType.FLASHCARD_GEN.value,
            max_tokens=8192,
        )

        # Store flashcards in DB
        cards = await self._store_flashcards(
            batch, student_id, college_id, pdf_id,
        )

        # Update execution
        execution.status = ExecutionStatus.COMPLETED.value
        execution.output_data = {"flashcard_count": len(cards)}
        await self._db.flush()

        return FlashcardBatch(
            flashcards=cards,
            total_generated=len(cards),
            source_type="pdf",
            generation_metadata={
                "pdf_id": pdf_id,
                "page_range": page_range,
                "execution_id": str(execution.id),
            },
        )

    # ------------------------------------------------------------------
    # generate_from_topic
    # ------------------------------------------------------------------

    async def generate_from_topic(
        self,
        *,
        student_id: UUID,
        college_id: UUID,
        subject: str,
        topic: str,
        count: int = 20,
        focus: str = "comprehensive",
    ) -> FlashcardBatch:
        """Generate flashcards from a medical topic.

        Focus modes:
        - comprehensive: balanced coverage
        - high_yield: exam-relevant concepts
        - weak_areas: targets student's weak topics from metacognitive profile
        """
        rag = get_rag_engine()

        # Build query based on focus mode
        query = f"{subject}: {topic}"
        if focus == "high_yield":
            query += " high-yield exam-relevant concepts"
        elif focus == "weak_areas":
            profile = await self._get_student_profile(student_id, college_id)
            if profile and profile.weak_topics:
                weak = [
                    t["topic"] for t in profile.weak_topics[:5]
                    if t.get("subject", "").lower() == subject.lower()
                ]
                if weak:
                    query += f" focusing on weak areas: {', '.join(weak)}"

        rag_result = await rag.retrieve(
            self._db, query, college_id=college_id, top_k=8,
        )

        # Create audit execution
        execution = AgentExecution(
            college_id=college_id,
            user_id=student_id,
            agent_id=AGENT_ID,
            task_type=TaskType.FLASHCARD_GEN.value,
            execution_type=ExecutionType.SINGLE_CALL.value,
            status=ExecutionStatus.RUNNING.value,
            input_data={
                "subject": subject,
                "topic": topic,
                "count": count,
                "focus": focus,
            },
        )
        self._db.add(execution)
        await self._db.flush()

        system_prompt = self._pr.get(
            "flashcard_generator",
            fallback=(
                "You are a medical flashcard generator. Create high-quality "
                "flashcards from the provided content. Follow these rules:\n"
                "1. ONE concept per flashcard — never combine topics\n"
                "2. Use clear, concise language\n"
                "3. For cloze cards, use {{blank}} to mark deletions\n"
                "4. Include clinical pearls where relevant\n"
                "5. Tag with subject, topic, organ system, difficulty (1-5)\n"
                "6. Add source citations from the original content\n"
                "7. Difficulty 1=recall, 2=basic understanding, "
                "3=application, 4=analysis, 5=synthesis"
            ),
        )

        focus_instruction = {
            "comprehensive": "Cover the topic comprehensively — include definitions, mechanisms, clinical features, management, and complications.",
            "high_yield": "Focus on HIGH-YIELD exam-relevant concepts — most frequently tested facts, classic presentations, pathognomonic findings.",
            "weak_areas": "Focus on commonly confused concepts and areas where students typically struggle.",
        }.get(focus, "Cover the topic comprehensively.")

        user_msg = (
            f"Generate exactly {count} flashcards on: {subject} — {topic}\n"
            f"Focus: {focus_instruction}\n"
            f"Mix of basic and cloze card types.\n\n"
            f"Reference content:\n{rag_result.formatted_context}"
        )

        batch: GeneratedFlashcardBatch = await self._gw.complete_structured(
            self._db,
            system_prompt=system_prompt,
            user_message=user_msg,
            output_schema=GeneratedFlashcardBatch,
            college_id=college_id,
            user_id=student_id,
            agent_id=AGENT_ID,
            task_type=TaskType.FLASHCARD_GEN.value,
            max_tokens=8192,
        )

        cards = await self._store_flashcards(
            batch, student_id, college_id, source_pdf_id=None,
        )

        execution.status = ExecutionStatus.COMPLETED.value
        execution.output_data = {"flashcard_count": len(cards)}
        await self._db.flush()

        return FlashcardBatch(
            flashcards=cards,
            total_generated=len(cards),
            source_type="topic",
            generation_metadata={
                "subject": subject,
                "topic": topic,
                "focus": focus,
                "execution_id": str(execution.id),
            },
        )

    # ------------------------------------------------------------------
    # get_review_session
    # ------------------------------------------------------------------

    async def get_review_session(
        self,
        *,
        student_id: UUID,
        college_id: UUID,
        max_cards: int = 20,
        subject: str | None = None,
    ) -> ReviewSession:
        """Get cards due for review using SM-2 scheduling.

        Priority order:
        1. Overdue cards (past next_review_date)
        2. Cards due today
        3. New cards (never reviewed)
        """
        today = date.today()

        # Subquery: latest review per flashcard
        latest_review = (
            select(
                FlashcardReview.flashcard_id,
                func.max(FlashcardReview.reviewed_at).label("latest_at"),
            )
            .where(
                FlashcardReview.student_id == student_id,
                FlashcardReview.college_id == college_id,
            )
            .group_by(FlashcardReview.flashcard_id)
            .subquery()
        )

        # Join cards with their latest review
        due_query = (
            select(Flashcard, FlashcardReview)
            .outerjoin(
                latest_review,
                Flashcard.id == latest_review.c.flashcard_id,
            )
            .outerjoin(
                FlashcardReview,
                (FlashcardReview.flashcard_id == Flashcard.id)
                & (FlashcardReview.reviewed_at == latest_review.c.latest_at),
            )
            .where(
                Flashcard.student_id == student_id,
                Flashcard.college_id == college_id,
                Flashcard.is_active == True,  # noqa: E712
            )
        )

        if subject:
            due_query = due_query.where(Flashcard.subject == subject)

        result = await self._db.execute(due_query)
        rows = result.all()

        overdue_cards: list[ReviewCard] = []
        due_today_cards: list[ReviewCard] = []
        new_cards: list[ReviewCard] = []

        for card, review in rows:
            if review is None or review.next_review_date is None:
                new_cards.append(self._to_review_card(card, review, today))
            elif review.next_review_date <= today:
                days_overdue = (today - review.next_review_date).days
                rc = self._to_review_card(card, review, today)
                if days_overdue > 0:
                    overdue_cards.append(rc)
                else:
                    due_today_cards.append(rc)

        # Sort: overdue by most overdue first
        overdue_cards.sort(key=lambda c: c.days_overdue, reverse=True)

        all_due = overdue_cards + due_today_cards + new_cards
        total_due = len(all_due)
        session_cards = all_due[:max_cards]

        return ReviewSession(
            cards=session_cards,
            total_due=total_due,
            new_cards=len(new_cards),
            overdue_cards=len(overdue_cards),
            subject_filter=subject,
        )

    # ------------------------------------------------------------------
    # process_review
    # ------------------------------------------------------------------

    async def process_review(
        self,
        *,
        student_id: UUID,
        college_id: UUID,
        card_id: UUID,
        quality: int,
        response_time_ms: int,
    ) -> SpacedRepetitionUpdate:
        """Process a flashcard review using the SM-2 algorithm.

        Quality scale (SM-2):
        0 = complete blackout
        1 = wrong but recognized
        2 = wrong but easy to recall
        3 = correct with difficulty
        4 = correct with some hesitation
        5 = perfect recall
        """
        # Get the latest review for this card
        result = await self._db.execute(
            select(FlashcardReview)
            .where(
                FlashcardReview.flashcard_id == card_id,
                FlashcardReview.student_id == student_id,
                FlashcardReview.college_id == college_id,
            )
            .order_by(FlashcardReview.reviewed_at.desc())
            .limit(1)
        )
        prev = result.scalars().first()

        # Previous state
        prev_ef = prev.ease_factor if prev else DEFAULT_EASE_FACTOR
        prev_interval = prev.interval_days if prev else 0.0
        prev_reps = prev.repetition_count if prev else 0

        # SM-2 calculation
        new_ef, new_interval, new_reps = self._sm2_calculate(
            quality, prev_ef, prev_interval, prev_reps,
        )

        next_review = date.today() + timedelta(days=int(math.ceil(new_interval)))

        # Store new review record
        review = FlashcardReview(
            college_id=college_id,
            flashcard_id=card_id,
            student_id=student_id,
            quality=quality,
            response_time_ms=response_time_ms,
            interval_days=new_interval,
            ease_factor=new_ef,
            repetition_count=new_reps,
            next_review_date=next_review,
            reviewed_at=datetime.now(timezone.utc),
        )
        self._db.add(review)
        await self._db.flush()

        # Fire metacognitive event for analytics
        await self._fire_metacognitive_event(
            student_id, college_id, card_id, quality, response_time_ms,
        )

        return SpacedRepetitionUpdate(
            card_id=str(card_id),
            ease_factor=round(new_ef, 2),
            interval_days=round(new_interval, 1),
            repetition_count=new_reps,
            next_review_date=next_review,
            quality=quality,
        )

    # ------------------------------------------------------------------
    # get_stats
    # ------------------------------------------------------------------

    async def get_stats(
        self,
        *,
        student_id: UUID,
        college_id: UUID,
    ) -> FlashcardStats:
        """Get the student's flashcard statistics."""
        today = date.today()

        # Total and active cards
        total_result = await self._db.execute(
            select(func.count()).select_from(Flashcard).where(
                Flashcard.student_id == student_id,
                Flashcard.college_id == college_id,
            )
        )
        total_cards = total_result.scalar() or 0

        active_result = await self._db.execute(
            select(func.count()).select_from(Flashcard).where(
                Flashcard.student_id == student_id,
                Flashcard.college_id == college_id,
                Flashcard.is_active == True,  # noqa: E712
            )
        )
        active_cards = active_result.scalar() or 0

        # Latest review per card
        latest_review_sq = (
            select(
                FlashcardReview.flashcard_id,
                func.max(FlashcardReview.reviewed_at).label("latest_at"),
            )
            .where(
                FlashcardReview.student_id == student_id,
                FlashcardReview.college_id == college_id,
            )
            .group_by(FlashcardReview.flashcard_id)
            .subquery()
        )

        review_data = await self._db.execute(
            select(FlashcardReview)
            .join(
                latest_review_sq,
                (FlashcardReview.flashcard_id == latest_review_sq.c.flashcard_id)
                & (FlashcardReview.reviewed_at == latest_review_sq.c.latest_at),
            )
            .where(
                FlashcardReview.student_id == student_id,
                FlashcardReview.college_id == college_id,
            )
        )
        latest_reviews = review_data.scalars().all()

        reviewed_card_ids = {r.flashcard_id for r in latest_reviews}
        due_today = 0
        overdue = 0
        mastered = 0
        learning = 0
        ease_factors: list[float] = []

        for r in latest_reviews:
            ef = r.ease_factor or DEFAULT_EASE_FACTOR
            interval = r.interval_days or 0
            ease_factors.append(ef)

            if r.next_review_date and r.next_review_date <= today:
                if r.next_review_date == today:
                    due_today += 1
                else:
                    overdue += 1

            if ef >= 2.5 and interval >= 21:
                mastered += 1
            else:
                learning += 1

        new_cards = active_cards - len(reviewed_card_ids)
        if new_cards < 0:
            new_cards = 0

        # Total reviews
        total_reviews_result = await self._db.execute(
            select(func.count()).select_from(FlashcardReview).where(
                FlashcardReview.student_id == student_id,
                FlashcardReview.college_id == college_id,
            )
        )
        total_reviews = total_reviews_result.scalar() or 0

        # Streak: consecutive days with at least one review
        streak = await self._calculate_streak(student_id, college_id)

        # By subject
        by_subject = await self._get_stats_by_subject(
            student_id, college_id, today, latest_reviews,
        )

        avg_ef = (
            sum(ease_factors) / len(ease_factors)
            if ease_factors
            else DEFAULT_EASE_FACTOR
        )

        return FlashcardStats(
            total_cards=total_cards,
            active_cards=active_cards,
            due_today=due_today + overdue,
            overdue=overdue,
            mastered=mastered,
            learning=learning,
            new_cards=new_cards,
            by_subject=by_subject,
            avg_ease_factor=round(avg_ef, 2),
            total_reviews=total_reviews,
            streak_days=streak,
        )

    # ==================================================================
    # Private helpers
    # ==================================================================

    @staticmethod
    def _sm2_calculate(
        quality: int,
        ease_factor: float,
        interval: float,
        repetitions: int,
    ) -> tuple[float, float, int]:
        """SM-2 algorithm core computation.

        Returns (new_ease_factor, new_interval, new_repetitions).
        """
        # Adjust ease factor
        new_ef = ease_factor + (
            0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        )
        new_ef = max(new_ef, MIN_EASE_FACTOR)

        if quality < 3:
            # Failed — reset to learning phase
            return new_ef, 1.0, 0

        # Passed — advance
        new_reps = repetitions + 1
        if new_reps == 1:
            new_interval = 1.0
        elif new_reps == 2:
            new_interval = 6.0
        else:
            new_interval = interval * new_ef

        return new_ef, new_interval, new_reps

    async def _store_flashcards(
        self,
        batch: GeneratedFlashcardBatch,
        student_id: UUID,
        college_id: UUID,
        source_pdf_id: str | None,
    ) -> list[FlashcardResponse]:
        """Persist generated flashcards and return response models."""
        cards: list[FlashcardResponse] = []

        for gen in batch.flashcards:
            card = Flashcard(
                college_id=college_id,
                student_id=student_id,
                front=gen.front,
                back=gen.back,
                card_type=gen.card_type,
                subject=gen.subject,
                topic=gen.topic,
                organ_system=gen.organ_system,
                difficulty=gen.difficulty,
                tags=gen.tags,
                source_citation=gen.source_citation,
                source_pdf_id=source_pdf_id,
                clinical_pearl=gen.clinical_pearl,
                competency_code=gen.competency_code,
                source="ai_generated",
                is_ai_generated=True,
                is_active=True,
            )
            self._db.add(card)
            await self._db.flush()
            await self._db.refresh(card)

            cards.append(FlashcardResponse(
                id=str(card.id),
                front=card.front,
                back=card.back,
                card_type=card.card_type,
                subject=card.subject,
                topic=card.topic or "",
                organ_system=card.organ_system,
                difficulty=card.difficulty,
                tags=card.tags or [],
                source_citation=card.source_citation,
                source_pdf_id=source_pdf_id,
                clinical_pearl=card.clinical_pearl,
                competency_code=card.competency_code,
                is_ai_generated=True,
                is_active=True,
                created_at=card.created_at,
            ))

        return cards

    def _to_review_card(
        self,
        card: Flashcard,
        review: FlashcardReview | None,
        today: date,
    ) -> ReviewCard:
        """Convert a Flashcard + optional review to a ReviewCard."""
        if review and review.next_review_date:
            days_overdue = (today - review.next_review_date).days
        else:
            days_overdue = -1  # new card

        return ReviewCard(
            id=str(card.id),
            front=card.front,
            back=card.back,
            card_type=card.card_type or "basic",
            subject=card.subject,
            topic=card.topic or "",
            difficulty=card.difficulty or 3,
            clinical_pearl=card.clinical_pearl,
            ease_factor=review.ease_factor if review else DEFAULT_EASE_FACTOR,
            interval_days=review.interval_days if review else 0.0,
            repetition_count=review.repetition_count if review else 0,
            days_overdue=days_overdue,
        )

    async def _get_student_profile(
        self, student_id: UUID, college_id: UUID,
    ) -> StudentMetacognitiveProfile | None:
        """Fetch student's metacognitive profile for weak-area targeting."""
        result = await self._db.execute(
            select(StudentMetacognitiveProfile).where(
                StudentMetacognitiveProfile.student_id == student_id,
                StudentMetacognitiveProfile.college_id == college_id,
            )
        )
        return result.scalars().first()

    async def _fire_metacognitive_event(
        self,
        student_id: UUID,
        college_id: UUID,
        card_id: UUID,
        quality: int,
        response_time_ms: int,
    ) -> None:
        """Fire a flashcard_reviewed event to the metacognitive analytics engine."""
        try:
            from app.engines.ai.analytics.metacognitive import get_analytics_engine
            from app.engines.ai.analytics.schemas import MetacognitiveEventInput

            engine = get_analytics_engine()
            event = MetacognitiveEventInput(
                student_id=student_id,
                college_id=college_id,
                event_type="flashcard_reviewed",
                event_data={
                    "card_id": str(card_id),
                    "quality": quality,
                    "response_time_ms": response_time_ms,
                },
            )
            await engine.capture_event(self._db, event)
        except Exception:
            logger.warning("Failed to fire metacognitive event", exc_info=True)

    async def _calculate_streak(
        self, student_id: UUID, college_id: UUID,
    ) -> int:
        """Calculate consecutive review days (streak)."""
        result = await self._db.execute(
            select(func.date(FlashcardReview.reviewed_at))
            .where(
                FlashcardReview.student_id == student_id,
                FlashcardReview.college_id == college_id,
            )
            .distinct()
            .order_by(func.date(FlashcardReview.reviewed_at).desc())
        )
        review_dates = [row[0] for row in result.all()]

        if not review_dates:
            return 0

        today = date.today()
        streak = 0

        # Start from today or yesterday
        if review_dates[0] == today:
            streak = 1
            check_date = today - timedelta(days=1)
        elif review_dates[0] == today - timedelta(days=1):
            streak = 1
            check_date = today - timedelta(days=2)
        else:
            return 0

        date_set = set(review_dates)
        while check_date in date_set:
            streak += 1
            check_date -= timedelta(days=1)

        return streak

    async def _get_stats_by_subject(
        self,
        student_id: UUID,
        college_id: UUID,
        today: date,
        latest_reviews: list[FlashcardReview],
    ) -> list[dict[str, Any]]:
        """Get per-subject statistics."""
        # Count cards per subject
        subject_result = await self._db.execute(
            select(Flashcard.subject, func.count())
            .where(
                Flashcard.student_id == student_id,
                Flashcard.college_id == college_id,
                Flashcard.is_active == True,  # noqa: E712
            )
            .group_by(Flashcard.subject)
        )
        subject_counts: dict[str, int] = {}
        for subj, cnt in subject_result.all():
            subject_counts[subj] = cnt

        # Build review lookup by flashcard_id
        review_by_card: dict[UUID, FlashcardReview] = {
            r.flashcard_id: r for r in latest_reviews
        }

        # Get flashcard subjects for reviewed cards
        if review_by_card:
            card_ids = list(review_by_card.keys())
            card_result = await self._db.execute(
                select(Flashcard.id, Flashcard.subject)
                .where(Flashcard.id.in_(card_ids))
            )
            card_subjects: dict[UUID, str] = {
                cid: subj for cid, subj in card_result.all()
            }
        else:
            card_subjects = {}

        # Aggregate per subject
        subject_stats: dict[str, dict[str, int]] = {}
        for cid, review in review_by_card.items():
            subj = card_subjects.get(cid, "Unknown")
            if subj not in subject_stats:
                subject_stats[subj] = {"due_today": 0, "mastered": 0}

            if review.next_review_date and review.next_review_date <= today:
                subject_stats[subj]["due_today"] += 1

            ef = review.ease_factor or DEFAULT_EASE_FACTOR
            interval = review.interval_days or 0
            if ef >= 2.5 and interval >= 21:
                subject_stats[subj]["mastered"] += 1

        by_subject: list[dict[str, Any]] = []
        for subj in sorted(subject_counts.keys()):
            stats = subject_stats.get(subj, {"due_today": 0, "mastered": 0})
            by_subject.append({
                "subject": subj,
                "total": subject_counts[subj],
                "due_today": stats["due_today"],
                "mastered": stats["mastered"],
            })

        return by_subject


# ======================================================================
# Module-level convenience functions
# ======================================================================


async def generate_flashcards_from_pdf(
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    *,
    student_id: UUID,
    college_id: UUID,
    pdf_id: str,
    page_range: list[int] | None = None,
    subject: str | None = None,
    topic: str | None = None,
    count: int = 20,
    card_types: list[str] | None = None,
) -> FlashcardBatch:
    """Generate flashcards from a PDF document."""
    gen = FlashcardGenerator(db, gateway, prompt_registry)
    return await gen.generate_from_pdf(
        student_id=student_id,
        college_id=college_id,
        pdf_id=pdf_id,
        page_range=page_range,
        subject=subject,
        topic=topic,
        count=count,
        card_types=card_types,
    )


async def generate_flashcards_from_topic(
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    *,
    student_id: UUID,
    college_id: UUID,
    subject: str,
    topic: str,
    count: int = 20,
    focus: str = "comprehensive",
) -> FlashcardBatch:
    """Generate flashcards from a medical topic."""
    gen = FlashcardGenerator(db, gateway, prompt_registry)
    return await gen.generate_from_topic(
        student_id=student_id,
        college_id=college_id,
        subject=subject,
        topic=topic,
        count=count,
        focus=focus,
    )


async def get_review_session(
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    *,
    student_id: UUID,
    college_id: UUID,
    max_cards: int = 20,
    subject: str | None = None,
) -> ReviewSession:
    """Get cards due for review."""
    gen = FlashcardGenerator(db, gateway, prompt_registry)
    return await gen.get_review_session(
        student_id=student_id,
        college_id=college_id,
        max_cards=max_cards,
        subject=subject,
    )


async def process_flashcard_review(
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    *,
    student_id: UUID,
    college_id: UUID,
    card_id: UUID,
    quality: int,
    response_time_ms: int,
) -> SpacedRepetitionUpdate:
    """Process a flashcard review."""
    gen = FlashcardGenerator(db, gateway, prompt_registry)
    return await gen.process_review(
        student_id=student_id,
        college_id=college_id,
        card_id=card_id,
        quality=quality,
        response_time_ms=response_time_ms,
    )


async def get_flashcard_stats(
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    *,
    student_id: UUID,
    college_id: UUID,
) -> FlashcardStats:
    """Get student flashcard statistics."""
    gen = FlashcardGenerator(db, gateway, prompt_registry)
    return await gen.get_stats(
        student_id=student_id,
        college_id=college_id,
    )
