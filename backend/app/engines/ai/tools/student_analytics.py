"""StudentAnalyticsServer — student performance data, study patterns, IRT.

Used by: S1 (Socratic Study Buddy), S6 (Recommendation Engine),
F7 (Student Analytics & Mentoring).
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import (
    MetacognitiveEvent,
    StudentMetacognitiveProfile,
)
from app.engines.ai.tools.base import MCPToolServer


class StudentAnalyticsServer(MCPToolServer):
    """Student performance data, study patterns, metacognitive profiles."""

    server_name = "student_analytics"

    def get_tool_definitions(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "get_student_profile",
                "description": (
                    "Get a student's metacognitive profile including mastery "
                    "scores, confidence calibration, accuracy rates, and risk "
                    "levels across subjects and topics. Used to personalize "
                    "AI interactions based on the student's current "
                    "knowledge state.\n\nReturns: List of topic-level "
                    "profiles with mastery scores and learning metrics."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "student_id": {
                            "type": "string",
                            "description": "UUID of the student",
                        },
                        "subject": {
                            "type": "string",
                            "description": (
                                "Optional: filter by subject to get "
                                "topic-level breakdown"
                            ),
                        },
                    },
                    "required": ["student_id"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "get_student_knowledge_gaps",
                "description": (
                    "Identify topics where a student's mastery score is "
                    "below a threshold. Used by the Recommendation Engine "
                    "to prioritize study topics and by the Socratic Study "
                    "Buddy to focus questioning on weak areas.\n\nReturns: "
                    "Topics ranked by gap severity with recommended actions."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "student_id": {
                            "type": "string",
                            "description": "UUID of the student",
                        },
                        "mastery_threshold": {
                            "type": "number",
                            "description": (
                                "Mastery score below which a topic is "
                                "considered a gap (default: 0.5)"
                            ),
                        },
                        "subject": {
                            "type": "string",
                            "description": (
                                "Optional: limit to a specific subject"
                            ),
                        },
                    },
                    "required": ["student_id"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "get_study_patterns",
                "description": (
                    "Get recent study activity patterns for a student. "
                    "Aggregates MetacognitiveEvent data to show study "
                    "frequency, session duration, active subjects, and "
                    "time-of-day patterns.\n\nReturns: Aggregated study "
                    "metrics over the specified period."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "student_id": {
                            "type": "string",
                            "description": "UUID of the student",
                        },
                        "days": {
                            "type": "integer",
                            "description": (
                                "Number of past days to analyze (default: 7)"
                            ),
                        },
                    },
                    "required": ["student_id"],
                    "additionalProperties": False,
                },
            },
        ]

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    async def _tool_get_student_profile(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Return metacognitive profiles for a student."""
        student_id = UUID(params["student_id"])
        subject = params.get("subject")

        query = (
            select(StudentMetacognitiveProfile)
            .where(
                StudentMetacognitiveProfile.college_id == self.college_id,
                StudentMetacognitiveProfile.student_id == student_id,
            )
            .order_by(StudentMetacognitiveProfile.mastery_score.asc())
        )

        if subject:
            query = query.where(
                StudentMetacognitiveProfile.subject == subject
            )

        result = await self.db.execute(query)
        profiles = result.scalars().all()

        topics = []
        for p in profiles:
            topics.append({
                "subject": p.subject,
                "topic": p.topic,
                "mastery_score": float(p.mastery_score),
                "confidence_calibration": (
                    float(p.confidence_calibration)
                    if p.confidence_calibration is not None
                    else None
                ),
                "accuracy_rate": float(p.accuracy_rate),
                "total_questions_attempted": p.total_questions_attempted,
                "total_correct": p.total_correct,
                "avg_time_per_question_ms": p.avg_time_per_question_ms,
                "answer_change_rate": (
                    float(p.answer_change_rate)
                    if p.answer_change_rate is not None
                    else None
                ),
                "learning_velocity": (
                    float(p.learning_velocity)
                    if p.learning_velocity is not None
                    else None
                ),
                "risk_level": p.risk_level,
                "last_active_at": (
                    p.last_active_at.isoformat()
                    if p.last_active_at
                    else None
                ),
            })

        return {
            "student_id": str(student_id),
            "topic_profiles": topics,
            "total_topics": len(topics),
        }

    async def _tool_get_student_knowledge_gaps(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Return topics where mastery is below threshold."""
        student_id = UUID(params["student_id"])
        threshold = params.get("mastery_threshold", 0.5)
        subject = params.get("subject")

        query = (
            select(StudentMetacognitiveProfile)
            .where(
                StudentMetacognitiveProfile.college_id == self.college_id,
                StudentMetacognitiveProfile.student_id == student_id,
                StudentMetacognitiveProfile.mastery_score < threshold,
            )
            .order_by(StudentMetacognitiveProfile.mastery_score.asc())
        )

        if subject:
            query = query.where(
                StudentMetacognitiveProfile.subject == subject
            )

        result = await self.db.execute(query)
        profiles = result.scalars().all()

        gaps = []
        for p in profiles:
            gap_severity = threshold - float(p.mastery_score)
            gaps.append({
                "subject": p.subject,
                "topic": p.topic,
                "mastery_score": float(p.mastery_score),
                "gap_severity": round(gap_severity, 3),
                "risk_level": p.risk_level,
                "total_questions_attempted": p.total_questions_attempted,
                "recommendation": (
                    "Focus area — needs significant practice"
                    if gap_severity > 0.3
                    else "Review recommended"
                ),
            })

        return {
            "student_id": str(student_id),
            "mastery_threshold": threshold,
            "knowledge_gaps": gaps,
            "total_gaps": len(gaps),
        }

    async def _tool_get_study_patterns(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Aggregate recent MetacognitiveEvent data for study patterns."""
        student_id = UUID(params["student_id"])
        days = params.get("days", 7)
        since = datetime.now(timezone.utc) - timedelta(days=days)

        # Total events by type.
        type_counts_result = await self.db.execute(
            select(
                MetacognitiveEvent.event_type,
                func.count().label("count"),
            )
            .where(
                MetacognitiveEvent.college_id == self.college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.occurred_at >= since,
            )
            .group_by(MetacognitiveEvent.event_type)
        )
        event_types = {
            row.event_type: row.count
            for row in type_counts_result.all()
        }

        # Active subjects.
        subject_result = await self.db.execute(
            select(
                MetacognitiveEvent.subject,
                func.count().label("count"),
            )
            .where(
                MetacognitiveEvent.college_id == self.college_id,
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.occurred_at >= since,
                MetacognitiveEvent.subject.isnot(None),
            )
            .group_by(MetacognitiveEvent.subject)
            .order_by(func.count().desc())
        )
        active_subjects = {
            row.subject: row.count
            for row in subject_result.all()
        }

        # Total events count.
        total_events = sum(event_types.values())

        # Study sessions count.
        study_sessions = event_types.get("study_session_started", 0)

        return {
            "student_id": str(student_id),
            "period_days": days,
            "total_events": total_events,
            "event_breakdown": event_types,
            "study_sessions": study_sessions,
            "active_subjects": active_subjects,
            "questions_answered": event_types.get("question_answered", 0),
            "flashcards_reviewed": event_types.get("flashcard_reviewed", 0),
        }
