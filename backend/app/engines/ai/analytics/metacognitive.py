"""Metacognitive Analytics Engine — Section S8 of architecture document.

Upgraded from B2C system. Absorbs all proven metrics (confidence calibration,
answer change patterns, work-break ratio, consistency score, SM-2 spaced
repetition) and adds multi-tenant B2B capabilities:

- OCEAN archetype system (Layer 1 questionnaire + Layer 2 behavioral)
- AI agent integration (feeds S1 Study Buddy, S6 Recommendations, F7 Faculty)
- Risk assessment with faculty alerts
- Learning velocity trend computation
- Composite mastery score formula
- Department-level aggregate analytics

This is a DATA PIPELINE, not an LLM agent. The ONLY LLM call is
generate_metacognitive_reveal() which uses Haiku for lightweight inference.
"""

import logging
import math
import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.analytics.schemas import (
    ARCHETYPE_NAMES,
    OCEAN_HIGH_THRESHOLD,
    OCEAN_LOW_THRESHOLD,
    OCEAN_TRAIT_QUESTIONS,
    ArchetypeAssessment,
    ArchetypeInfo,
    AtRiskStudent,
    BehavioralArchetype,
    DepartmentAnalytics,
    MetacognitiveEventInput,
    MetacognitiveReveal,
    OCEANScores,
    QuestionnaireResponse,
    SpacedRepetitionUpdate,
    StudentAIContext,
    StudentSummary,
    SubjectMastery,
    TopicMastery,
    WeeklyEngagement,
)
from app.engines.ai.models import (
    MetacognitiveEvent,
    MetacognitiveEventType,
    RiskLevel,
    StudentArchetypeProfile,
    StudentMetacognitiveProfile,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Metric computation constants
# ---------------------------------------------------------------------------

MASTERY_WEIGHT_ACCURACY = 0.4
MASTERY_WEIGHT_COMPLETION = 0.3
MASTERY_WEIGHT_TIME_EFFICIENCY = 0.3

RISK_HIGH_MASTERY_THRESHOLD = 0.3
RISK_HIGH_VELOCITY_THRESHOLD = -0.1
RISK_MEDIUM_MASTERY_THRESHOLD = 0.5
RISK_MEDIUM_VELOCITY_THRESHOLD = 0.0

# SM-2 spaced repetition constants
SM2_INITIAL_EASE_FACTOR = 2.5
SM2_MIN_EASE_FACTOR = 1.3
SM2_MAX_INTERVAL_DAYS = 365

# Target questions per topic for completion rate
TARGET_QUESTIONS_PER_TOPIC = 20

# Expected time per question in ms (for time efficiency calc)
EXPECTED_TIME_MS = 60_000

# Days of inactivity thresholds
INACTIVE_HIGH_DAYS = 14
INACTIVE_MEDIUM_DAYS = 7

# Minimum data for behavioral archetype
MIN_BEHAVIORAL_DATA_DAYS = 30


# ---------------------------------------------------------------------------
# MetacognitiveAnalyticsEngine
# ---------------------------------------------------------------------------

class MetacognitiveAnalyticsEngine:
    """Background data capture and processing — Section S8.

    This is a DATA PIPELINE, not an LLM agent. No LLM calls except
    generate_metacognitive_reveal() which uses Haiku.
    """

    # ==================================================================
    # EVENT CAPTURE
    # ==================================================================

    async def capture_event(
        self,
        db: AsyncSession,
        event: MetacognitiveEventInput,
    ) -> MetacognitiveEvent:
        """Capture a student interaction event.

        1. Save raw event to MetacognitiveEvent table
        2. Update real-time metrics (call update_profile)
        3. Handle spaced repetition for flashcard events

        Returns the created MetacognitiveEvent record.
        """
        now = event.occurred_at or datetime.now(timezone.utc)

        record = MetacognitiveEvent(
            college_id=event.college_id,
            student_id=event.student_id,
            event_type=event.event_type,
            event_data=event.event_data,
            subject=event.subject,
            topic=event.topic,
            competency_code=event.competency_code,
            occurred_at=now,
        )
        db.add(record)
        await db.flush()

        # Update profile if subject+topic are present
        if event.subject and event.topic:
            await self.update_profile(
                db,
                student_id=event.student_id,
                college_id=event.college_id,
                subject=event.subject,
                topic=event.topic,
            )

        # Handle spaced repetition for flashcard events
        if event.event_type == MetacognitiveEventType.FLASHCARD_REVIEWED.value:
            card_id = event.event_data.get("card_id")
            response_quality = event.event_data.get("response_quality")
            if card_id and response_quality is not None:
                await self.update_spaced_repetition(
                    db,
                    student_id=event.student_id,
                    college_id=event.college_id,
                    subject=event.subject or "",
                    topic=event.topic or "",
                    response_quality=int(response_quality),
                )
            elif card_id:
                # Backward compat: derive quality from response_correct
                correct = event.event_data.get("response_correct", False)
                q = 4 if correct else 1
                await self.update_spaced_repetition(
                    db,
                    student_id=event.student_id,
                    college_id=event.college_id,
                    subject=event.subject or "",
                    topic=event.topic or "",
                    response_quality=q,
                )

        return record

    # ==================================================================
    # PROFILE COMPUTATION
    # ==================================================================

    async def update_profile(
        self,
        db: AsyncSession,
        *,
        student_id: UUID,
        college_id: UUID,
        subject: str,
        topic: str,
    ) -> StudentMetacognitiveProfile:
        """Recompute StudentMetacognitiveProfile for student+subject+topic.

        Preserved metrics (from B2C, proven valuable):
        - mastery_score, confidence_calibration, answer_change_rate,
          avg_time_per_question_ms, learning_velocity

        New metrics (for B2B + AI integration):
        - work_break_ratio, consistency_score, beneficial/detrimental
          change rates, revisit_ratio, risk_level with reasons
        """
        now = datetime.now(timezone.utc)

        # --- Query question_answered events ---
        question_events = await db.execute(
            select(MetacognitiveEvent)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.subject == subject,
                MetacognitiveEvent.topic == topic,
                MetacognitiveEvent.event_type == MetacognitiveEventType.QUESTION_ANSWERED.value,
            )
            .order_by(MetacognitiveEvent.occurred_at.desc())
            .limit(500)
        )
        q_events = question_events.scalars().all()

        # --- Accuracy ---
        total_attempted = len(q_events)
        total_correct = sum(
            1 for e in q_events
            if e.event_data.get("selected_answer") == e.event_data.get("correct_answer")
        )
        accuracy = total_correct / total_attempted if total_attempted > 0 else 0.0

        # --- Time efficiency ---
        times = [
            e.event_data.get("time_taken_ms", 0)
            for e in q_events
            if e.event_data.get("time_taken_ms")
        ]
        avg_time_ms = int(sum(times) / len(times)) if times else None
        time_efficiency = 0.5
        if avg_time_ms and avg_time_ms > 0:
            time_efficiency = min(1.0, EXPECTED_TIME_MS / avg_time_ms)

        # --- Completion rate ---
        completion_rate = min(1.0, total_attempted / TARGET_QUESTIONS_PER_TOPIC)

        # --- Mastery score ---
        mastery_score = (
            accuracy * MASTERY_WEIGHT_ACCURACY
            + completion_rate * MASTERY_WEIGHT_COMPLETION
            + time_efficiency * MASTERY_WEIGHT_TIME_EFFICIENCY
        )

        # --- Confidence calibration ---
        confidence_calibration = self._compute_confidence_calibration(q_events)

        # --- Answer change rates (total + beneficial/detrimental) ---
        total_changes = 0
        beneficial_changes = 0
        detrimental_changes = 0
        for e in q_events:
            if e.event_data.get("answer_changed", False):
                total_changes += 1
                initial = e.event_data.get("initial_answer")
                final = e.event_data.get("final_answer")
                correct = e.event_data.get("correct_answer")
                if initial and final and correct:
                    initial_correct = initial == correct
                    final_correct = final == correct
                    if not initial_correct and final_correct:
                        beneficial_changes += 1
                    elif initial_correct and not final_correct:
                        detrimental_changes += 1

        answer_change_rate = total_changes / total_attempted if total_attempted > 0 else None
        beneficial_change_rate = beneficial_changes / total_changes if total_changes > 0 else None
        detrimental_change_rate = detrimental_changes / total_changes if total_changes > 0 else None

        # --- Revisit ratio (from navigation events) ---
        nav_result = await db.execute(
            select(MetacognitiveEvent)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.subject == subject,
                MetacognitiveEvent.topic == topic,
                MetacognitiveEvent.event_type == MetacognitiveEventType.NAVIGATION_EVENT.value,
            )
            .limit(500)
        )
        nav_events = nav_result.scalars().all()
        revisit_count = sum(
            1 for e in nav_events if e.event_data.get("action") == "revisit"
        )
        revisit_ratio = revisit_count / total_attempted if total_attempted > 0 else None

        # --- Work-break ratio (from study session events, student-wide) ---
        work_break_ratio = await self._compute_work_break_ratio(
            db, student_id, college_id
        )

        # --- Consistency score (student-wide) ---
        consistency_score = await self._compute_consistency_score(
            db, student_id, college_id
        )

        # --- Learning velocity ---
        old_profile = await db.execute(
            select(StudentMetacognitiveProfile).where(
                StudentMetacognitiveProfile.college_id == college_id,
                StudentMetacognitiveProfile.student_id == student_id,
                StudentMetacognitiveProfile.subject == subject,
                StudentMetacognitiveProfile.topic == topic,
            )
        )
        existing = old_profile.scalar_one_or_none()

        learning_velocity = None
        if existing and existing.mastery_score is not None:
            old_mastery = existing.mastery_score
            learning_velocity = (mastery_score - old_mastery) / 30.0

        # --- Risk level ---
        risk_level = self._compute_risk_level(mastery_score, learning_velocity)

        # --- Upsert ---
        values = {
            "mastery_score": round(mastery_score, 4),
            "confidence_calibration": confidence_calibration,
            "accuracy_rate": round(accuracy, 4),
            "avg_time_per_question_ms": avg_time_ms,
            "total_questions_attempted": total_attempted,
            "total_correct": total_correct,
            "answer_change_rate": _round_or_none(answer_change_rate, 4),
            "beneficial_change_rate": _round_or_none(beneficial_change_rate, 4),
            "detrimental_change_rate": _round_or_none(detrimental_change_rate, 4),
            "revisit_ratio": _round_or_none(revisit_ratio, 4),
            "work_break_ratio": _round_or_none(work_break_ratio, 2),
            "consistency_score": _round_or_none(consistency_score, 4),
            "learning_velocity": _round_or_none(learning_velocity, 6),
            "last_active_at": now,
            "risk_level": risk_level,
        }

        stmt = pg_insert(StudentMetacognitiveProfile).values(
            college_id=college_id,
            student_id=student_id,
            subject=subject,
            topic=topic,
            **values,
        ).on_conflict_do_update(
            constraint="uq_metacog_profile_student_topic",
            set_=values,
        )
        await db.execute(stmt)

        result = await db.execute(
            select(StudentMetacognitiveProfile).where(
                StudentMetacognitiveProfile.college_id == college_id,
                StudentMetacognitiveProfile.student_id == student_id,
                StudentMetacognitiveProfile.subject == subject,
                StudentMetacognitiveProfile.topic == topic,
            )
        )
        return result.scalar_one()

    # ==================================================================
    # STUDENT SUMMARY
    # ==================================================================

    async def get_student_summary(
        self,
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
    ) -> StudentSummary:
        """Return complete analytics summary including archetype info."""
        result = await db.execute(
            select(StudentMetacognitiveProfile)
            .where(
                StudentMetacognitiveProfile.college_id == college_id,
                StudentMetacognitiveProfile.student_id == student_id,
            )
            .order_by(
                StudentMetacognitiveProfile.subject,
                StudentMetacognitiveProfile.topic,
            )
        )
        profiles = result.scalars().all()

        mastery_scores = [p.mastery_score for p in profiles if p.mastery_score is not None]
        overall_mastery = sum(mastery_scores) / len(mastery_scores) if mastery_scores else 0.0

        total_q = sum(p.total_questions_attempted for p in profiles)
        total_c = sum(p.total_correct for p in profiles)

        topics_at_risk = sum(
            1 for p in profiles
            if p.risk_level in (RiskLevel.HIGH.value, RiskLevel.MEDIUM.value)
        )

        last_active = max(
            (p.last_active_at for p in profiles if p.last_active_at),
            default=None,
        )

        streak = await self._compute_study_streak(db, student_id, college_id)

        # Overall risk
        if any(p.risk_level == RiskLevel.HIGH.value for p in profiles):
            overall_risk = RiskLevel.HIGH.value
        elif topics_at_risk > 0:
            overall_risk = RiskLevel.MEDIUM.value
        else:
            overall_risk = RiskLevel.LOW.value

        # Work-break and consistency averages
        wbr_values = [p.work_break_ratio for p in profiles if p.work_break_ratio is not None]
        cs_values = [p.consistency_score for p in profiles if p.consistency_score is not None]

        mastery_list = [
            SubjectMastery(
                subject=p.subject,
                topic=p.topic,
                mastery_score=p.mastery_score or 0.0,
                accuracy_rate=p.accuracy_rate or 0.0,
                total_questions_attempted=p.total_questions_attempted or 0,
                total_correct=p.total_correct or 0,
                confidence_calibration=p.confidence_calibration,
                answer_change_rate=p.answer_change_rate,
                beneficial_change_rate=p.beneficial_change_rate,
                detrimental_change_rate=p.detrimental_change_rate,
                learning_velocity=p.learning_velocity,
                risk_level=p.risk_level or RiskLevel.LOW.value,
                last_active_at=p.last_active_at,
                avg_time_per_question_ms=p.avg_time_per_question_ms,
                work_break_ratio=p.work_break_ratio,
                consistency_score=p.consistency_score,
                revisit_ratio=p.revisit_ratio,
            )
            for p in profiles
        ]

        # Archetype info
        archetype_info = await self._get_archetype_info(db, student_id, college_id)

        return StudentSummary(
            student_id=student_id,
            college_id=college_id,
            overall_mastery=round(overall_mastery, 4),
            overall_risk_level=overall_risk,
            total_topics_studied=len(profiles),
            topics_at_risk=topics_at_risk,
            total_questions_attempted=total_q,
            total_correct=total_c,
            overall_accuracy=round(total_c / total_q, 4) if total_q > 0 else 0.0,
            study_streak_days=streak,
            last_active_at=last_active,
            mastery_by_subject=mastery_list,
            archetype_info=archetype_info,
            avg_work_break_ratio=(
                round(sum(wbr_values) / len(wbr_values), 2) if wbr_values else None
            ),
            avg_consistency_score=(
                round(sum(cs_values) / len(cs_values), 4) if cs_values else None
            ),
        )

    # ==================================================================
    # AT-RISK STUDENTS (FACULTY-FACING)
    # ==================================================================

    async def get_at_risk_students(
        self,
        db: AsyncSession,
        college_id: UUID,
        department: str | None = None,
        risk_level: str = "high",
    ) -> list[AtRiskStudent]:
        """Return students with risk_level >= threshold, with reasons."""
        now = datetime.now(timezone.utc)

        query = (
            select(
                StudentMetacognitiveProfile.student_id,
                func.avg(StudentMetacognitiveProfile.mastery_score).label("avg_mastery"),
                func.avg(StudentMetacognitiveProfile.learning_velocity).label("avg_velocity"),
                func.max(StudentMetacognitiveProfile.last_active_at).label("last_active"),
                func.count().label("risk_topic_count"),
            )
            .where(
                StudentMetacognitiveProfile.college_id == college_id,
                StudentMetacognitiveProfile.risk_level.in_(
                    self._risk_levels_at_or_above(risk_level)
                ),
            )
            .group_by(StudentMetacognitiveProfile.student_id)
            .order_by(func.avg(StudentMetacognitiveProfile.mastery_score))
        )

        if department:
            query = query.where(
                StudentMetacognitiveProfile.subject == department,
            )

        result = await db.execute(query)
        rows = result.all()

        at_risk_list = []
        for row in rows:
            sid = row.student_id
            last_active = row.last_active
            days_inactive = (now - last_active).days if last_active else 999

            # Get specific risk topics
            topics_result = await db.execute(
                select(
                    StudentMetacognitiveProfile.subject,
                    StudentMetacognitiveProfile.topic,
                    StudentMetacognitiveProfile.mastery_score,
                    StudentMetacognitiveProfile.risk_level,
                    StudentMetacognitiveProfile.learning_velocity,
                )
                .where(
                    StudentMetacognitiveProfile.college_id == college_id,
                    StudentMetacognitiveProfile.student_id == sid,
                    StudentMetacognitiveProfile.risk_level.in_(
                        self._risk_levels_at_or_above(risk_level)
                    ),
                )
            )
            risk_topics = [
                {
                    "subject": t.subject,
                    "topic": t.topic,
                    "mastery_score": t.mastery_score,
                    "risk_level": t.risk_level,
                }
                for t in topics_result.all()
            ]

            # Generate risk reasons
            risk_reasons = self._generate_risk_reasons(
                avg_mastery=row.avg_mastery,
                avg_velocity=row.avg_velocity,
                days_inactive=days_inactive,
                risk_topics=risk_topics,
            )

            # Generate recommended intervention
            intervention = self._generate_intervention(
                risk_reasons=risk_reasons,
                avg_mastery=row.avg_mastery or 0.0,
            )

            at_risk_list.append(AtRiskStudent(
                student_id=sid,
                risk_level=risk_level,
                risk_reasons=risk_reasons,
                risk_topics=risk_topics,
                overall_mastery=round(row.avg_mastery or 0.0, 4),
                learning_velocity=(
                    round(row.avg_velocity, 6) if row.avg_velocity else None
                ),
                last_active_at=last_active,
                days_inactive=days_inactive,
                recommended_intervention=intervention,
            ))

        return at_risk_list

    # ==================================================================
    # DEPARTMENT ANALYTICS (FACULTY-FACING)
    # ==================================================================

    async def get_department_analytics(
        self,
        db: AsyncSession,
        college_id: UUID,
        department: str | None = None,
    ) -> DepartmentAnalytics:
        """Aggregate analytics for a department — HOD and faculty view."""
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        # Base filter
        base_filter = [StudentMetacognitiveProfile.college_id == college_id]
        if department:
            base_filter.append(StudentMetacognitiveProfile.subject == department)

        # Total distinct students
        total_q = await db.execute(
            select(func.count(StudentMetacognitiveProfile.student_id.distinct()))
            .where(*base_filter)
        )
        total_students = total_q.scalar() or 0

        # Active students (last 30 days)
        active_q = await db.execute(
            select(func.count(StudentMetacognitiveProfile.student_id.distinct()))
            .where(
                *base_filter,
                StudentMetacognitiveProfile.last_active_at >= thirty_days_ago,
            )
        )
        active_students = active_q.scalar() or 0

        # Average mastery by topic
        topic_q = await db.execute(
            select(
                StudentMetacognitiveProfile.topic,
                func.avg(StudentMetacognitiveProfile.mastery_score).label("avg_mastery"),
                func.count(StudentMetacognitiveProfile.student_id.distinct()).label("student_count"),
                func.count().filter(
                    StudentMetacognitiveProfile.risk_level.in_(
                        [RiskLevel.HIGH.value, RiskLevel.MEDIUM.value]
                    )
                ).label("at_risk_count"),
            )
            .where(*base_filter)
            .group_by(StudentMetacognitiveProfile.topic)
            .order_by(func.avg(StudentMetacognitiveProfile.mastery_score).asc())
        )
        topic_rows = topic_q.all()
        avg_mastery_by_topic = [
            TopicMastery(
                topic=r.topic,
                avg_mastery=round(r.avg_mastery or 0.0, 4),
                student_count=r.student_count,
                at_risk_count=r.at_risk_count,
            )
            for r in topic_rows
        ]

        # Risk distribution
        risk_q = await db.execute(
            select(
                StudentMetacognitiveProfile.risk_level,
                func.count(StudentMetacognitiveProfile.student_id.distinct()).label("cnt"),
            )
            .where(*base_filter)
            .group_by(StudentMetacognitiveProfile.risk_level)
        )
        risk_distribution = {r.risk_level: r.cnt for r in risk_q.all()}

        # Common weak areas (topics with avg mastery < 0.4)
        common_weak = [
            t.topic for t in avg_mastery_by_topic
            if t.avg_mastery < 0.4
        ][:10]

        # Weekly engagement trend (last 8 weeks)
        engagement_trend = await self._compute_weekly_engagement(
            db, college_id, department, weeks=8,
        )

        return DepartmentAnalytics(
            college_id=college_id,
            department=department,
            total_students=total_students,
            active_students_30d=active_students,
            avg_mastery_by_topic=avg_mastery_by_topic,
            risk_distribution=risk_distribution,
            common_weak_areas=common_weak,
            engagement_trend=engagement_trend,
        )

    # ==================================================================
    # ARCHETYPE ENGINE — LAYER 1 (SELF-REPORTED)
    # ==================================================================

    async def assess_personality_layer1(
        self,
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
        questionnaire_responses: list[QuestionnaireResponse],
    ) -> ArchetypeAssessment:
        """Layer 1: Score OCEAN questionnaire and classify archetype.

        The 25-question OCEAN questionnaire maps to Big Five traits:
        Q1-5: Conscientiousness, Q6-10: Neuroticism,
        Q11-15: Openness, Q16-20: Extraversion, Q21-25: Agreeableness

        Classification uses the Archetype Assessment & Confirmation Matrix
        from the Student Archetype Framework document.
        """
        now = datetime.now(timezone.utc)

        # Build rating lookup: question_id → rating
        ratings = {r.question_id: r.rating for r in questionnaire_responses}

        # Compute trait scores
        trait_scores: dict[str, float] = {}
        for trait, question_ids in OCEAN_TRAIT_QUESTIONS.items():
            trait_ratings = [ratings.get(qid, 3) for qid in question_ids]
            trait_scores[trait] = sum(trait_ratings) / len(trait_ratings)

        ocean = OCEANScores(
            openness=round(trait_scores["openness"], 2),
            conscientiousness=round(trait_scores["conscientiousness"], 2),
            extraversion=round(trait_scores["extraversion"], 2),
            agreeableness=round(trait_scores["agreeableness"], 2),
            neuroticism=round(trait_scores["neuroticism"], 2),
        )

        # Classify archetype
        archetype, confidence, secondary = self._classify_archetype_from_ocean(ocean)

        # Upsert StudentArchetypeProfile
        values = {
            "ocean_scores": ocean.model_dump(),
            "questionnaire_responses": [r.model_dump() for r in questionnaire_responses],
            "self_reported_archetype": archetype,
            "self_reported_confidence": round(confidence, 4),
            "layer1_assessed_at": now,
        }

        stmt = pg_insert(StudentArchetypeProfile).values(
            college_id=college_id,
            student_id=student_id,
            **values,
        ).on_conflict_do_update(
            constraint="uq_archetype_profile_student",
            set_=values,
        )
        await db.execute(stmt)

        return ArchetypeAssessment(
            ocean_scores=ocean,
            primary_archetype=archetype,
            archetype_confidence=round(confidence, 4),
            secondary_archetype=secondary,
            assessed_at=now,
        )

    # ==================================================================
    # ARCHETYPE ENGINE — LAYER 2 (BEHAVIORAL)
    # ==================================================================

    async def compute_behavioral_archetype(
        self,
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
    ) -> BehavioralArchetype | None:
        """Layer 2: Compute archetype from 30+ days of behavioral data.

        Behavioral signals mapped to archetypes (from Confirmation Matrix):
        - Methodical Planner: consistency >0.80, work-break 3-5, even coverage
        - Anxious Achiever: calibration <-0.15, detrimental changes >0.30, revisit >0.25
        - Deep Diver: long sessions, low breadth + high depth, high AI conceptual
        - Pragmatic Strategist: low time/q + high accuracy, selective, work-break >6
        - Collaborative Learner: high AI chat discussion queries
        """
        now = datetime.now(timezone.utc)

        # Check minimum data
        first_event = await db.execute(
            select(func.min(MetacognitiveEvent.occurred_at))
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
            )
        )
        first_at = first_event.scalar()
        if not first_at:
            return None

        data_days = (now - first_at).days
        if data_days < MIN_BEHAVIORAL_DATA_DAYS:
            return None

        # Get all profiles for this student
        profiles_result = await db.execute(
            select(StudentMetacognitiveProfile).where(
                StudentMetacognitiveProfile.college_id == college_id,
                StudentMetacognitiveProfile.student_id == student_id,
            )
        )
        profiles = profiles_result.scalars().all()
        if not profiles:
            return None

        # Compute aggregate metrics
        avg_consistency = _safe_mean([p.consistency_score for p in profiles if p.consistency_score is not None])
        avg_wbr = _safe_mean([p.work_break_ratio for p in profiles if p.work_break_ratio is not None])
        avg_calibration = _safe_mean([p.confidence_calibration for p in profiles if p.confidence_calibration is not None])
        avg_detrimental = _safe_mean([p.detrimental_change_rate for p in profiles if p.detrimental_change_rate is not None])
        avg_revisit = _safe_mean([p.revisit_ratio for p in profiles if p.revisit_ratio is not None])
        avg_accuracy = _safe_mean([p.accuracy_rate for p in profiles if p.accuracy_rate is not None])
        avg_time_ms = _safe_mean([float(p.avg_time_per_question_ms) for p in profiles if p.avg_time_per_question_ms is not None])

        # Topic coverage variance (even = low variance)
        mastery_values = [p.mastery_score for p in profiles if p.mastery_score is not None]
        coverage_variance = statistics.variance(mastery_values) if len(mastery_values) >= 2 else 0.5

        # Session duration from study_session_ended events
        session_result = await db.execute(
            select(MetacognitiveEvent.event_data)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.event_type == MetacognitiveEventType.STUDY_SESSION_ENDED.value,
            )
            .order_by(MetacognitiveEvent.occurred_at.desc())
            .limit(100)
        )
        session_durations = [
            r.event_data.get("duration_minutes", 0)
            for r in session_result.scalars().all()
            if isinstance(r, MetacognitiveEvent) or True  # result is event_data dict
        ]
        # Actually the result is just event_data column values
        session_events = await db.execute(
            select(MetacognitiveEvent)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.event_type == MetacognitiveEventType.STUDY_SESSION_ENDED.value,
            )
            .order_by(MetacognitiveEvent.occurred_at.desc())
            .limit(100)
        )
        sessions = session_events.scalars().all()
        session_durations = [
            s.event_data.get("duration_minutes", 0) for s in sessions
        ]
        avg_session_duration = _safe_mean(session_durations) if session_durations else 30.0

        # AI interaction queries
        ai_result = await db.execute(
            select(func.count())
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.event_type == MetacognitiveEventType.AI_INTERACTION.value,
            )
        )
        ai_interaction_count = ai_result.scalar() or 0

        topic_count = len(profiles)

        # --- Score each archetype ---
        signals: dict[str, float] = {}

        # Methodical Planner: high consistency, optimal work-break, even coverage
        mp_consistency = min(1.0, (avg_consistency or 0) / 0.80) if avg_consistency else 0
        mp_wbr = 1.0 if avg_wbr and 3.0 <= avg_wbr <= 5.0 else (0.5 if avg_wbr else 0)
        mp_coverage = max(0, 1.0 - coverage_variance * 2) if coverage_variance is not None else 0
        signals["Methodical Planner"] = (mp_consistency * 0.4 + mp_wbr * 0.3 + mp_coverage * 0.3)

        # Anxious Achiever: negative calibration, detrimental changes, high revisits
        aa_cal = min(1.0, abs(avg_calibration) / 0.15) if avg_calibration is not None and avg_calibration < -0.05 else 0
        aa_det = min(1.0, (avg_detrimental or 0) / 0.30) if avg_detrimental else 0
        aa_rev = min(1.0, (avg_revisit or 0) / 0.25) if avg_revisit else 0
        signals["Anxious Achiever"] = (aa_cal * 0.4 + aa_det * 0.3 + aa_rev * 0.3)

        # Deep Diver: long sessions, low breadth + high depth, high AI conceptual
        dd_session = min(1.0, avg_session_duration / 90.0) if avg_session_duration else 0
        dd_depth = min(1.0, coverage_variance * 3) if coverage_variance is not None else 0  # spiky = deep
        dd_ai = min(1.0, ai_interaction_count / 50.0)
        signals["Deep Diver"] = (dd_session * 0.35 + dd_depth * 0.35 + dd_ai * 0.3)

        # Pragmatic Strategist: efficient, selective, high work-break
        ps_efficiency = 0
        if avg_time_ms and avg_accuracy:
            speed_score = min(1.0, 30_000 / avg_time_ms) if avg_time_ms > 0 else 0
            ps_efficiency = speed_score * avg_accuracy
        ps_wbr = min(1.0, (avg_wbr or 0) / 6.0) if avg_wbr and avg_wbr > 5.0 else 0
        ps_selective = max(0, 1.0 - (topic_count / 20.0)) if topic_count < 15 else 0
        signals["Pragmatic Strategist"] = (ps_efficiency * 0.4 + ps_wbr * 0.3 + ps_selective * 0.3)

        # Collaborative Learner: high AI chat (discussion-style)
        cl_ai = min(1.0, ai_interaction_count / 30.0)
        signals["Collaborative Learner"] = cl_ai

        # Find best match
        best_archetype = max(signals, key=signals.get)  # type: ignore[arg-type]
        best_score = signals[best_archetype]

        # Get self-reported archetype for discrepancy check
        arch_profile = await db.execute(
            select(StudentArchetypeProfile).where(
                StudentArchetypeProfile.college_id == college_id,
                StudentArchetypeProfile.student_id == student_id,
            )
        )
        existing_arch = arch_profile.scalar_one_or_none()
        self_reported = existing_arch.self_reported_archetype if existing_arch else None
        discrepancy = self_reported is not None and self_reported != best_archetype

        # Generate blind spots
        blind_spots = self._generate_blind_spots(
            self_reported=self_reported,
            behavioral=best_archetype,
            signals=signals,
            avg_consistency=avg_consistency,
            avg_calibration=avg_calibration,
            avg_detrimental=avg_detrimental,
        )

        # Store in StudentArchetypeProfile
        update_values = {
            "behavioral_archetype": best_archetype,
            "behavioral_confidence": round(best_score, 4),
            "archetype_signals": {k: round(v, 4) for k, v in signals.items()},
            "blind_spots": blind_spots,
            "layer2_computed_at": now,
        }

        if existing_arch:
            for key, val in update_values.items():
                setattr(existing_arch, key, val)
        else:
            stmt = pg_insert(StudentArchetypeProfile).values(
                college_id=college_id,
                student_id=student_id,
                **update_values,
            ).on_conflict_do_update(
                constraint="uq_archetype_profile_student",
                set_=update_values,
            )
            await db.execute(stmt)

        return BehavioralArchetype(
            computed_archetype=best_archetype,
            confidence=round(best_score, 4),
            archetype_signals={k: round(v, 4) for k, v in signals.items()},
            discrepancy_from_self_report=discrepancy,
            blind_spots=blind_spots,
            data_days=data_days,
        )

    # ==================================================================
    # METACOGNITIVE REVEAL (THE ONLY LLM CALL)
    # ==================================================================

    async def generate_metacognitive_reveal(
        self,
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
    ) -> MetacognitiveReveal | None:
        """Generate the 'aha moment' — Layer 1 vs Layer 2 comparison.

        Uses Haiku via AIGateway for natural language insight generation.
        This IS an LLM call (the only one in this engine).
        """
        # Load archetype profile
        result = await db.execute(
            select(StudentArchetypeProfile).where(
                StudentArchetypeProfile.college_id == college_id,
                StudentArchetypeProfile.student_id == student_id,
            )
        )
        profile = result.scalar_one_or_none()

        if not profile or not profile.self_reported_archetype or not profile.behavioral_archetype:
            return None

        match = profile.self_reported_archetype == profile.behavioral_archetype
        blind_spots = profile.blind_spots or []

        # Generate insight via Haiku
        from app.engines.ai.gateway_deps import get_ai_gateway

        gateway = get_ai_gateway()

        prompt = (
            f"You are a learning psychology expert for the Acolyte medical education platform. "
            f"Generate a brief, empathetic, data-driven insight for a student.\n\n"
            f"Self-reported archetype (from questionnaire): {profile.self_reported_archetype}\n"
            f"Behavioral archetype (from 30+ days of data): {profile.behavioral_archetype}\n"
            f"Match: {match}\n"
            f"OCEAN scores: {profile.ocean_scores}\n"
            f"Behavioral signals: {profile.archetype_signals}\n"
            f"Identified blind spots: {blind_spots}\n\n"
            f"Write a 2-3 sentence insight that:\n"
            f"1. Acknowledges what the student thinks about themselves\n"
            f"2. Shows what the data reveals about their actual behavior\n"
            f"3. Frames any discrepancy as an opportunity, not a criticism\n"
            f"4. Is warm, non-judgmental, and encouraging\n\n"
            f"Also provide 2-3 specific, actionable recommendations."
        )

        try:
            ai_response = await gateway.complete(
                db,
                system_prompt="You are a concise learning psychology advisor. Respond in JSON with keys: insight (string), recommendations (list of strings).",
                user_message=prompt,
                model="claude-haiku-4-5-20251001",
                college_id=college_id,
                user_id=student_id,
                agent_id="metacognitive_reveal",
                task_type="classification",
                max_tokens=512,
                temperature=0.7,
            )

            # Parse response
            import json
            try:
                parsed = json.loads(ai_response.content)
                insight = parsed.get("insight", ai_response.content)
                recommendations = parsed.get("recommendations", [])
            except (json.JSONDecodeError, AttributeError):
                insight = ai_response.content
                recommendations = []

        except Exception as e:
            logger.error("Failed to generate metacognitive reveal: %s", e)
            # Fallback: deterministic insight
            if match:
                insight = (
                    f"Your self-assessment as a {profile.self_reported_archetype} "
                    f"aligns well with your actual study behavior. You have strong "
                    f"self-awareness about your learning patterns."
                )
            else:
                insight = (
                    f"You identified as a {profile.self_reported_archetype}, but your "
                    f"study data over the past month shows patterns more consistent "
                    f"with a {profile.behavioral_archetype}. This gap between intention "
                    f"and action is very common and offers a valuable opportunity for growth."
                )
            recommendations = [
                "Review your study patterns in the analytics dashboard",
                "Try adjusting your study approach based on the behavioral insights",
            ]

        # Store reveal
        now = datetime.now(timezone.utc)
        profile.reveal_generated = True
        profile.reveal_insight = insight
        profile.reveal_recommendations = recommendations
        profile.reveal_generated_at = now

        return MetacognitiveReveal(
            self_reported_archetype=profile.self_reported_archetype,
            behavioral_archetype=profile.behavioral_archetype,
            match=match,
            insight=insight,
            blind_spots=blind_spots,
            recommendations=recommendations,
        )

    # ==================================================================
    # SPACED REPETITION (SM-2 ALGORITHM)
    # ==================================================================

    async def update_spaced_repetition(
        self,
        db: AsyncSession,
        *,
        student_id: UUID,
        college_id: UUID,
        subject: str,
        topic: str,
        response_quality: int,
    ) -> SpacedRepetitionUpdate | None:
        """SM-2 algorithm implementation for flashcard scheduling.

        response_quality: 0-5 (SM-2 scale)
            5 = perfect recall
            4 = correct with hesitation
            3 = correct with difficulty
            2 = incorrect but close
            1 = incorrect
            0 = complete blackout
        """
        result = await db.execute(
            select(StudentMetacognitiveProfile).where(
                StudentMetacognitiveProfile.college_id == college_id,
                StudentMetacognitiveProfile.student_id == student_id,
                StudentMetacognitiveProfile.subject == subject,
                StudentMetacognitiveProfile.topic == topic,
            )
        )
        profile = result.scalar_one_or_none()
        if not profile:
            return None

        params = profile.forgetting_curve_params or {
            "interval_hours": 24,
            "ease_factor": SM2_INITIAL_EASE_FACTOR,
            "repetitions": 0,
            "next_review_at": None,
        }

        interval = params.get("interval_hours", 24)
        ef = params.get("ease_factor", SM2_INITIAL_EASE_FACTOR)
        reps = params.get("repetitions", 0)
        q = max(0, min(5, response_quality))

        if q >= 3:
            # Correct response
            if reps == 0:
                interval = 24  # 1 day
            elif reps == 1:
                interval = 24 * 6  # 6 days
            else:
                interval = interval * ef

            reps += 1

            # SM-2 ease factor adjustment
            ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
            ef = max(SM2_MIN_EASE_FACTOR, ef)
        else:
            # Incorrect response
            reps = 0
            interval = 24  # Reset to 1 day
            # Ease factor unchanged per standard SM-2

        # Cap interval
        interval = min(interval, SM2_MAX_INTERVAL_DAYS * 24)

        now = datetime.now(timezone.utc)
        next_review = now + timedelta(hours=interval)

        params = {
            "interval_hours": round(interval, 1),
            "ease_factor": round(ef, 2),
            "repetitions": reps,
            "next_review_at": next_review.isoformat(),
            "last_reviewed_at": now.isoformat(),
        }

        profile.forgetting_curve_params = params

        return SpacedRepetitionUpdate(
            next_review_at=next_review,
            interval_hours=round(interval, 1),
            ease_factor=round(ef, 2),
            repetition_count=reps,
            response_quality=q,
        )

    # ==================================================================
    # AI AGENT INTEGRATION
    # ==================================================================

    async def get_student_context_for_ai(
        self,
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
        subject: str | None = None,
    ) -> StudentAIContext:
        """Return structured context for AI agents (S1, S6).

        This is what the Socratic Study Buddy uses to calibrate
        scaffolding level and question difficulty.
        """
        query = select(StudentMetacognitiveProfile).where(
            StudentMetacognitiveProfile.college_id == college_id,
            StudentMetacognitiveProfile.student_id == student_id,
        )
        if subject:
            query = query.where(StudentMetacognitiveProfile.subject == subject)

        result = await db.execute(query)
        profiles = result.scalars().all()

        # Overall mastery
        mastery_values = [p.mastery_score for p in profiles if p.mastery_score is not None]
        overall_mastery = sum(mastery_values) / len(mastery_values) if mastery_values else 0.0

        # Subject masteries
        subject_groups: dict[str, list[float]] = defaultdict(list)
        for p in profiles:
            if p.mastery_score is not None:
                subject_groups[p.subject].append(p.mastery_score)
        subject_masteries = {
            s: round(sum(v) / len(v), 4) for s, v in subject_groups.items()
        }

        # Weak / strong topics
        weak_topics = [
            f"{p.subject}: {p.topic}" for p in profiles
            if p.mastery_score is not None and p.mastery_score < 0.4
        ]
        strong_topics = [
            f"{p.subject}: {p.topic}" for p in profiles
            if p.mastery_score is not None and p.mastery_score > 0.8
        ]

        # Confidence tendency
        calibrations = [p.confidence_calibration for p in profiles if p.confidence_calibration is not None]
        avg_cal = sum(calibrations) / len(calibrations) if calibrations else 0.0
        if avg_cal < -0.15:
            confidence_tendency = "under_confident"
        elif avg_cal > 0.15:
            confidence_tendency = "over_confident"
        else:
            confidence_tendency = "well_calibrated"

        # Learning style (archetype)
        arch_result = await db.execute(
            select(StudentArchetypeProfile).where(
                StudentArchetypeProfile.college_id == college_id,
                StudentArchetypeProfile.student_id == student_id,
            )
        )
        arch_profile = arch_result.scalar_one_or_none()
        learning_style = (
            arch_profile.behavioral_archetype
            or arch_profile.self_reported_archetype
            if arch_profile else "unknown"
        )

        # Recent activity
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        recent_q = await db.execute(
            select(func.count())
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.event_type == MetacognitiveEventType.QUESTION_ANSWERED.value,
                MetacognitiveEvent.occurred_at >= seven_days_ago,
            )
        )
        questions_7d = recent_q.scalar() or 0

        last_session_q = await db.execute(
            select(MetacognitiveEvent.occurred_at)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
            )
            .order_by(MetacognitiveEvent.occurred_at.desc())
            .limit(1)
        )
        last_session_row = last_session_q.first()
        last_session_at = last_session_row[0].isoformat() if last_session_row else None

        # Risk level
        risk_levels = [p.risk_level for p in profiles if p.risk_level]
        if RiskLevel.HIGH.value in risk_levels:
            risk_level = RiskLevel.HIGH.value
        elif RiskLevel.MEDIUM.value in risk_levels:
            risk_level = RiskLevel.MEDIUM.value
        else:
            risk_level = RiskLevel.LOW.value

        # Recommended difficulty (1-5 from mastery)
        recommended_difficulty = max(1, min(5, round(overall_mastery * 5)))

        # Answer change tendency
        det_rates = [p.detrimental_change_rate for p in profiles if p.detrimental_change_rate is not None]
        ben_rates = [p.beneficial_change_rate for p in profiles if p.beneficial_change_rate is not None]
        avg_det = sum(det_rates) / len(det_rates) if det_rates else 0
        avg_ben = sum(ben_rates) / len(ben_rates) if ben_rates else 0
        if avg_det > 0.3:
            answer_change_tendency = "detrimental"
        elif avg_ben > 0.3:
            answer_change_tendency = "beneficial"
        else:
            answer_change_tendency = "neutral"

        return StudentAIContext(
            student_id=student_id,
            college_id=college_id,
            overall_mastery=round(overall_mastery, 4),
            subject_masteries=subject_masteries,
            weak_topics=weak_topics[:10],
            strong_topics=strong_topics[:10],
            confidence_tendency=confidence_tendency,
            learning_style=learning_style or "unknown",
            recent_activity={
                "last_session_at": last_session_at,
                "questions_done_7d": questions_7d,
                "topics_studied": len(profiles),
            },
            risk_level=risk_level,
            recommended_difficulty=recommended_difficulty,
            answer_change_tendency=answer_change_tendency,
        )

    # ==================================================================
    # BATCH RECOMPUTATION (CELERY TASKS)
    # ==================================================================

    async def recompute_all_profiles(
        self,
        db: AsyncSession,
        college_id: UUID,
    ) -> int:
        """Recompute ALL student profiles for a college. Nightly batch job."""
        result = await db.execute(
            select(
                MetacognitiveEvent.student_id,
                MetacognitiveEvent.subject,
                MetacognitiveEvent.topic,
            )
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.subject.isnot(None),
                MetacognitiveEvent.topic.isnot(None),
            )
            .distinct()
        )
        combos = result.all()

        updated = 0
        for combo in combos:
            try:
                await self.update_profile(
                    db,
                    student_id=combo.student_id,
                    college_id=college_id,
                    subject=combo.subject,
                    topic=combo.topic,
                )
                updated += 1
            except Exception as e:
                logger.error(
                    "Failed to recompute profile for student=%s subject=%s topic=%s: %s",
                    combo.student_id, combo.subject, combo.topic, e,
                )

        logger.info("Recomputed %d profiles for college %s", updated, college_id)
        return updated

    async def assess_risk_and_alert(
        self,
        db: AsyncSession,
        college_id: UUID,
    ) -> list[AtRiskStudent]:
        """Weekly risk assessment. Identify newly at-risk students."""
        return await self.get_at_risk_students(
            db, college_id, risk_level="high",
        )

    async def recompute_all_archetypes(
        self,
        db: AsyncSession,
        college_id: UUID,
    ) -> int:
        """Monthly: recompute behavioral archetypes for all students with 30+ days."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=MIN_BEHAVIORAL_DATA_DAYS)

        # Find students with events older than 30 days (i.e., 30+ days of data)
        result = await db.execute(
            select(MetacognitiveEvent.student_id)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.occurred_at <= cutoff,
            )
            .distinct()
        )
        student_ids = [row.student_id for row in result.all()]

        updated = 0
        for sid in student_ids:
            try:
                arch = await self.compute_behavioral_archetype(db, sid, college_id)
                if arch:
                    updated += 1
            except Exception as e:
                logger.error(
                    "Failed to compute archetype for student=%s: %s", sid, e,
                )

        logger.info("Recomputed %d archetypes for college %s", updated, college_id)
        return updated

    # ==================================================================
    # INTERNAL HELPERS
    # ==================================================================

    @staticmethod
    def _compute_confidence_calibration(
        q_events: list[MetacognitiveEvent],
    ) -> float | None:
        """Pearson correlation between confidence and accuracy."""
        pairs = []
        for e in q_events:
            confidence = e.event_data.get("confidence_rating")
            if confidence is None:
                continue
            correct = (
                1.0
                if e.event_data.get("selected_answer") == e.event_data.get("correct_answer")
                else 0.0
            )
            pairs.append((float(confidence), correct))

        if len(pairs) < 5:
            return None

        n = len(pairs)
        sum_x = sum(p[0] for p in pairs)
        sum_y = sum(p[1] for p in pairs)
        sum_xy = sum(p[0] * p[1] for p in pairs)
        sum_x2 = sum(p[0] ** 2 for p in pairs)
        sum_y2 = sum(p[1] ** 2 for p in pairs)

        numerator = n * sum_xy - sum_x * sum_y
        denominator = math.sqrt(
            (n * sum_x2 - sum_x ** 2) * (n * sum_y2 - sum_y ** 2)
        )

        if denominator == 0:
            return None

        return round(numerator / denominator, 4)

    @staticmethod
    def _compute_risk_level(
        mastery_score: float,
        learning_velocity: float | None,
    ) -> str:
        """Compute risk level from mastery and velocity."""
        velocity = learning_velocity or 0.0

        if mastery_score < RISK_HIGH_MASTERY_THRESHOLD or velocity < RISK_HIGH_VELOCITY_THRESHOLD:
            return RiskLevel.HIGH.value
        elif mastery_score < RISK_MEDIUM_MASTERY_THRESHOLD or velocity < RISK_MEDIUM_VELOCITY_THRESHOLD:
            return RiskLevel.MEDIUM.value
        else:
            return RiskLevel.LOW.value

    @staticmethod
    def _risk_levels_at_or_above(level: str) -> list[str]:
        if level == "low":
            return [RiskLevel.LOW.value, RiskLevel.MEDIUM.value, RiskLevel.HIGH.value]
        elif level == "medium":
            return [RiskLevel.MEDIUM.value, RiskLevel.HIGH.value]
        else:
            return [RiskLevel.HIGH.value]

    async def _compute_study_streak(
        self,
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
    ) -> int:
        """Compute consecutive days with at least one event."""
        now = datetime.now(timezone.utc)

        result = await db.execute(
            select(
                func.date(MetacognitiveEvent.occurred_at).label("event_date"),
            )
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.occurred_at >= now - timedelta(days=90),
            )
            .distinct()
            .order_by(func.date(MetacognitiveEvent.occurred_at).desc())
        )
        dates = [row.event_date for row in result.all()]

        if not dates:
            return 0

        streak = 0
        expected = now.date()

        for d in dates:
            if d == expected:
                streak += 1
                expected -= timedelta(days=1)
            elif d < expected:
                break

        return streak

    @staticmethod
    async def _compute_work_break_ratio(
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
    ) -> float | None:
        """Compute work-break ratio from study_session_ended events."""
        result = await db.execute(
            select(MetacognitiveEvent)
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.event_type == MetacognitiveEventType.STUDY_SESSION_ENDED.value,
            )
            .order_by(MetacognitiveEvent.occurred_at.desc())
            .limit(50)
        )
        sessions = result.scalars().all()
        if not sessions:
            return None

        total_study = 0.0
        total_break = 0.0
        for s in sessions:
            duration = s.event_data.get("duration_minutes", 0)
            break_time = s.event_data.get("break_time_minutes", 0)
            total_study += duration
            total_break += break_time

        if total_break <= 0:
            return None

        return total_study / total_break

    @staticmethod
    async def _compute_consistency_score(
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
    ) -> float | None:
        """Consistency = active_days / total_days_since_first_event."""
        now = datetime.now(timezone.utc)

        first_q = await db.execute(
            select(func.min(MetacognitiveEvent.occurred_at))
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
            )
        )
        first_at = first_q.scalar()
        if not first_at:
            return None

        total_days = max(1, (now - first_at).days)

        active_q = await db.execute(
            select(func.count(func.date(MetacognitiveEvent.occurred_at).distinct()))
            .where(
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.student_id == student_id,
            )
        )
        active_days = active_q.scalar() or 0

        return min(1.0, active_days / total_days)

    async def _get_archetype_info(
        self,
        db: AsyncSession,
        student_id: UUID,
        college_id: UUID,
    ) -> ArchetypeInfo | None:
        """Load archetype info for summary."""
        result = await db.execute(
            select(StudentArchetypeProfile).where(
                StudentArchetypeProfile.college_id == college_id,
                StudentArchetypeProfile.student_id == student_id,
            )
        )
        profile = result.scalar_one_or_none()
        if not profile:
            return None

        ocean = None
        if profile.ocean_scores:
            try:
                ocean = OCEANScores(**profile.ocean_scores)
            except Exception:
                pass

        return ArchetypeInfo(
            self_reported_archetype=profile.self_reported_archetype,
            behavioral_archetype=profile.behavioral_archetype,
            ocean_scores=ocean,
            archetype_match=(
                profile.self_reported_archetype == profile.behavioral_archetype
                if profile.self_reported_archetype and profile.behavioral_archetype
                else None
            ),
            reveal_available=profile.reveal_generated,
        )

    @staticmethod
    def _classify_archetype_from_ocean(
        ocean: OCEANScores,
    ) -> tuple[str, float, str | None]:
        """Classify archetype from OCEAN scores using the Assessment Matrix.

        Returns: (primary_archetype, confidence, secondary_archetype)
        """
        c = ocean.conscientiousness
        n = ocean.neuroticism
        o = ocean.openness
        e = ocean.extraversion
        a = ocean.agreeableness

        high_c = c >= OCEAN_HIGH_THRESHOLD
        low_c = c <= OCEAN_LOW_THRESHOLD
        high_n = n >= OCEAN_HIGH_THRESHOLD
        low_n = n <= OCEAN_LOW_THRESHOLD
        high_o = o >= OCEAN_HIGH_THRESHOLD
        low_o = o <= OCEAN_LOW_THRESHOLD
        high_e = e >= OCEAN_HIGH_THRESHOLD
        low_a = a <= OCEAN_LOW_THRESHOLD
        high_a = a >= OCEAN_HIGH_THRESHOLD

        # Score each archetype
        scores: dict[str, float] = {}

        # Methodical Planner: High C + Low N + Low O
        mp = 0.0
        if high_c:
            mp += 0.4
        if low_n:
            mp += 0.3
        if low_o:
            mp += 0.3
        scores["Methodical Planner"] = mp

        # Anxious Achiever: High C + High N
        aa = 0.0
        if high_c:
            aa += 0.5
        if high_n:
            aa += 0.5
        scores["Anxious Achiever"] = aa

        # Deep Diver: Low C + High O
        dd = 0.0
        if high_o:
            dd += 0.6
        if low_c:
            dd += 0.4
        scores["Deep Diver"] = dd

        # Pragmatic Strategist: High C + Low N + Low O + Low A
        ps = 0.0
        if high_c:
            ps += 0.3
        if low_n:
            ps += 0.2
        if low_o:
            ps += 0.2
        if low_a:
            ps += 0.3
        scores["Pragmatic Strategist"] = ps

        # Collaborative Learner: High E + High A
        cl = 0.0
        if high_e:
            cl += 0.5
        if high_a:
            cl += 0.5
        scores["Collaborative Learner"] = cl

        # Find best and second best
        sorted_archetypes = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        primary = sorted_archetypes[0][0]
        confidence = sorted_archetypes[0][1]

        secondary = None
        if len(sorted_archetypes) > 1 and sorted_archetypes[1][1] > 0.3:
            secondary = sorted_archetypes[1][0]

        return primary, confidence, secondary

    @staticmethod
    def _generate_risk_reasons(
        avg_mastery: float | None,
        avg_velocity: float | None,
        days_inactive: int,
        risk_topics: list[dict],
    ) -> list[str]:
        """Generate human-readable risk reasons."""
        reasons = []

        if avg_mastery is not None and avg_mastery < RISK_HIGH_MASTERY_THRESHOLD:
            reasons.append(f"Low mastery score ({avg_mastery:.0%}) across {len(risk_topics)} topics")
        elif avg_mastery is not None and avg_mastery < RISK_MEDIUM_MASTERY_THRESHOLD:
            reasons.append(f"Below-average mastery ({avg_mastery:.0%})")

        if avg_velocity is not None and avg_velocity < RISK_HIGH_VELOCITY_THRESHOLD:
            reasons.append("Rapidly declining performance")
        elif avg_velocity is not None and avg_velocity < RISK_MEDIUM_VELOCITY_THRESHOLD:
            reasons.append("Declining learning trajectory")

        if days_inactive >= INACTIVE_HIGH_DAYS:
            reasons.append(f"No activity for {days_inactive} days")
        elif days_inactive >= INACTIVE_MEDIUM_DAYS:
            reasons.append(f"Low engagement ({days_inactive} days since last activity)")

        # Specific weak topics
        weak = [t for t in risk_topics if t.get("mastery_score", 1) < 0.3]
        if weak:
            topic_names = [f"{t['subject']}: {t['topic']}" for t in weak[:3]]
            reasons.append(f"Critical weakness in {', '.join(topic_names)}")

        return reasons if reasons else ["Below risk threshold"]

    @staticmethod
    def _generate_intervention(
        risk_reasons: list[str],
        avg_mastery: float,
    ) -> str:
        """Generate recommended intervention for faculty."""
        if any("No activity" in r or "engagement" in r.lower() for r in risk_reasons):
            return "Schedule a check-in meeting to re-engage the student"
        elif any("declining" in r.lower() for r in risk_reasons):
            return "Review recent assessment performance and identify specific difficulty areas"
        elif avg_mastery < 0.3:
            return "Assign remedial practice sessions with focused topic review"
        else:
            return "Monitor closely and provide additional practice resources"

    @staticmethod
    def _generate_blind_spots(
        self_reported: str | None,
        behavioral: str,
        signals: dict[str, float],
        avg_consistency: float | None,
        avg_calibration: float | None,
        avg_detrimental: float | None,
    ) -> list[str]:
        """Generate blind spots from self-reported vs behavioral discrepancy."""
        spots = []

        if self_reported and self_reported != behavioral:
            spots.append(
                f"You identify as a {self_reported} but your data shows "
                f"patterns more consistent with a {behavioral}."
            )

        if self_reported == "Methodical Planner" and avg_consistency is not None and avg_consistency < 0.5:
            spots.append(
                f"Your consistency score is {avg_consistency:.0%}, which suggests "
                f"your study routine may not be as regular as you believe."
            )

        if self_reported != "Anxious Achiever" and avg_calibration is not None and avg_calibration < -0.2:
            spots.append(
                "Your confidence is significantly lower than your actual accuracy. "
                "You may be underestimating your knowledge."
            )

        if self_reported != "Anxious Achiever" and avg_detrimental is not None and avg_detrimental > 0.3:
            spots.append(
                f"You change {avg_detrimental:.0%} of your answers from correct to "
                f"incorrect, suggesting second-guessing may be hurting your scores."
            )

        return spots

    async def _compute_weekly_engagement(
        self,
        db: AsyncSession,
        college_id: UUID,
        department: str | None,
        weeks: int = 8,
    ) -> list[WeeklyEngagement]:
        """Compute weekly engagement trend for department analytics."""
        now = datetime.now(timezone.utc)
        result_list = []

        for w in range(weeks - 1, -1, -1):
            week_start = now - timedelta(weeks=w + 1)
            week_end = now - timedelta(weeks=w)

            base_filter = [
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.occurred_at >= week_start,
                MetacognitiveEvent.occurred_at < week_end,
            ]
            if department:
                base_filter.append(MetacognitiveEvent.subject == department)

            active_q = await db.execute(
                select(func.count(MetacognitiveEvent.student_id.distinct()))
                .where(*base_filter)
            )
            events_q = await db.execute(
                select(func.count()).where(*base_filter)
            )

            result_list.append(WeeklyEngagement(
                week_start=week_start.date().isoformat(),
                active_students=active_q.scalar() or 0,
                total_events=events_q.scalar() or 0,
            ))

        return result_list


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _round_or_none(value: float | None, digits: int) -> float | None:
    return round(value, digits) if value is not None else None


def _safe_mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_instance: MetacognitiveAnalyticsEngine | None = None


def get_analytics_engine() -> MetacognitiveAnalyticsEngine:
    """Get the singleton MetacognitiveAnalyticsEngine instance."""
    global _instance
    if _instance is None:
        _instance = MetacognitiveAnalyticsEngine()
    return _instance
