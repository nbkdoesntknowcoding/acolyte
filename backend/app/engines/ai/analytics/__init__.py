"""Metacognitive Analytics — Section S8 of architecture document.

Background data capture and processing engine. NOT an LLM agent —
pure computation on student interaction events (with one Haiku call
for metacognitive reveal).

Powers:
- S1: Socratic Study Buddy (knows student's knowledge level)
- S6: Recommendation Engine (what to study next)
- F7: Student Analytics & Mentoring (faculty sees at-risk students)

Usage:
    from app.engines.ai.analytics import (
        MetacognitiveAnalyticsEngine,
        get_analytics_engine,
        MetacognitiveEventInput,
        StudentSummary,
        StudentAIContext,
        AtRiskStudent,
    )

    engine = get_analytics_engine()
    await engine.capture_event(db, event)
    summary = await engine.get_student_summary(db, student_id, college_id)
    context = await engine.get_student_context_for_ai(db, student_id, college_id)
"""

from app.engines.ai.analytics.metacognitive import (  # noqa: F401
    MetacognitiveAnalyticsEngine,
    get_analytics_engine,
)
from app.engines.ai.analytics.schemas import (  # noqa: F401
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
