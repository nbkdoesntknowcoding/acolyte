"""Recommendation Engine — Section S6 of architecture document.

LangGraph supervisor graph that proactively tells students WHAT to study
next based on their metacognitive data from S8. This is where S8's data
becomes actionable.

Output types:
1. Proactive study plans (targeted review plans)
2. Workload management (break reminders, burnout prevention)
3. Weak area alerts (high-yield gaps)
4. Resource recommendations (practice tests, flashcards)
5. Progress celebration (keeps students motivated)

Graph: START → gather_student_data → analyze_knowledge_gaps
             → assess_workload → generate_recommendations
             → build_study_plan (if weekly) → END

Public interface:
    from app.engines.ai.agents.recommendation_engine import (
        run_recommendations,
        get_current_recommendations,
        dismiss_recommendation,
        complete_recommendation,
        get_current_study_plan,
    )
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, TypedDict
from uuid import UUID

from langgraph.graph import END, START, StateGraph
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.agents.recommendation_schemas import (
    GeneratedRecommendationBatch,
    GeneratedWeeklyPlan,
    ImprovementTrend,
    KnowledgeGap,
    RecommendationListResponse,
    RecommendationResponse,
    StudyPlanDayResponse,
    StudyPlanResponse,
    WorkloadAssessment,
)
from app.engines.ai.gateway import AIGateway
from app.engines.ai.models import (
    AgentExecution,
    ExecutionStatus,
    ExecutionType,
    MetacognitiveEvent,
    StudentArchetypeProfile,
    StudentMetacognitiveProfile,
    StudentRecommendation,
    StudentStudyPlan,
    TaskType,
)
from app.engines.ai.prompt_registry import PromptRegistry

logger = logging.getLogger(__name__)

AGENT_ID = "recommendation_engine"

# Archetype-specific workload guidance
ARCHETYPE_GUIDANCE: dict[str, dict[str, Any]] = {
    "Methodical Planner": {
        "optimal_pattern": "steady daily blocks",
        "warning": "Needs structure — irregular schedules cause anxiety",
        "advice_tone": "structured and organized",
        "break_style": "scheduled 10-min breaks every 50 minutes",
    },
    "Anxious Achiever": {
        "optimal_pattern": "moderate with reassurance",
        "warning": "Prone to burnout — needs break reminders",
        "advice_tone": "reassuring and encouraging",
        "break_style": "frequent 15-min breaks with relaxation exercises",
    },
    "Deep Diver": {
        "optimal_pattern": "focused deep sessions",
        "warning": "May neglect breadth — nudge towards other topics",
        "advice_tone": "intellectually stimulating",
        "break_style": "natural breaks between deep-dive sessions",
    },
    "Collaborative Learner": {
        "optimal_pattern": "mixed solo and group study",
        "warning": "May avoid difficult solo practice",
        "advice_tone": "community-oriented and supportive",
        "break_style": "social breaks — discuss with peers",
    },
    "Pragmatic Strategist": {
        "optimal_pattern": "efficiency-focused prioritization",
        "warning": "May skip fundamentals for high-yield only",
        "advice_tone": "results-driven and strategic",
        "break_style": "short tactical breaks to maintain peak efficiency",
    },
}


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------

class RecommendationState(TypedDict):
    """State flowing through the recommendation LangGraph."""

    student_id: str
    college_id: str
    trigger: str  # "login", "session_end", "weekly", "manual"

    # Collected data
    student_context: dict
    recent_events: list[dict]
    archetype: str | None

    # Analysis
    knowledge_gaps: list[dict]
    improvement_trends: list[dict]
    workload_assessment: dict

    # Output
    recommendations: list[dict]
    study_plan: dict | None
    execution_id: str | None


# ---------------------------------------------------------------------------
# LangGraph nodes
# ---------------------------------------------------------------------------

async def gather_student_data(state: RecommendationState) -> dict:
    """Node 1: Gather all student data from S8 metacognitive engine."""
    from app.core.database import async_session_factory
    from app.engines.ai.analytics.metacognitive import get_analytics_engine

    student_id = UUID(state["student_id"])
    college_id = UUID(state["college_id"])

    engine = get_analytics_engine()

    async with async_session_factory() as db:
        from sqlalchemy import text
        await db.execute(
            text("SET app.current_college_id = :cid"),
            {"cid": state["college_id"]},
        )

        # Get full student context
        context = await engine.get_student_context_for_ai(
            db, student_id, college_id,
        )

        # Get recent events (last 7 days)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        result = await db.execute(
            select(MetacognitiveEvent)
            .where(
                MetacognitiveEvent.student_id == student_id,
                MetacognitiveEvent.college_id == college_id,
                MetacognitiveEvent.occurred_at >= seven_days_ago,
            )
            .order_by(MetacognitiveEvent.occurred_at.desc())
            .limit(200)
        )
        events = result.scalars().all()

        # Get archetype
        arch_result = await db.execute(
            select(StudentArchetypeProfile).where(
                StudentArchetypeProfile.student_id == student_id,
                StudentArchetypeProfile.college_id == college_id,
            )
        )
        arch = arch_result.scalars().first()

    archetype = None
    if arch:
        archetype = arch.behavioral_archetype or arch.self_reported_archetype

    recent = []
    for e in events:
        recent.append({
            "type": e.event_type,
            "subject": e.subject,
            "topic": e.topic,
            "at": e.occurred_at.isoformat() if e.occurred_at else None,
        })

    return {
        "student_context": context.model_dump(),
        "recent_events": recent,
        "archetype": archetype,
    }


async def analyze_knowledge_gaps(state: RecommendationState) -> dict:
    """Node 2: Identify knowledge gaps from metacognitive profiles."""
    student_id = UUID(state["student_id"])
    college_id = UUID(state["college_id"])

    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        from sqlalchemy import text
        await db.execute(
            text("SET app.current_college_id = :cid"),
            {"cid": state["college_id"]},
        )

        result = await db.execute(
            select(StudentMetacognitiveProfile).where(
                StudentMetacognitiveProfile.student_id == student_id,
                StudentMetacognitiveProfile.college_id == college_id,
            )
        )
        profiles = result.scalars().all()

    gaps: list[dict] = []
    trends: list[dict] = []

    for p in profiles:
        mastery = p.mastery_score or 0.0
        velocity = p.learning_velocity or 0.0

        # Critical gaps: mastery < 0.4
        if mastery < 0.4:
            gaps.append(KnowledgeGap(
                subject=p.subject,
                topic=p.topic,
                mastery_score=mastery,
                gap_type="critical_gap",
                priority=1,
                detail=f"Mastery at {mastery:.0%} — needs urgent attention",
            ).model_dump())

        # Declining topics: negative learning velocity
        elif velocity < -0.05:
            gaps.append(KnowledgeGap(
                subject=p.subject,
                topic=p.topic,
                mastery_score=mastery,
                gap_type="declining",
                priority=2,
                detail=f"Mastery declining (velocity: {velocity:+.2f}/month)",
            ).model_dump())

        # Calibration issues: confidence ≠ accuracy
        if p.confidence_calibration is not None and abs(p.confidence_calibration) < 0.2:
            if mastery < 0.6:
                gaps.append(KnowledgeGap(
                    subject=p.subject,
                    topic=p.topic,
                    mastery_score=mastery,
                    gap_type="calibration_issue",
                    priority=3,
                    detail="Poor confidence calibration — may be over/under-confident",
                ).model_dump())

        # Track improvement trends
        if velocity != 0:
            direction = "improving" if velocity > 0.02 else ("declining" if velocity < -0.02 else "stable")
            trends.append(ImprovementTrend(
                subject=p.subject,
                topic=p.topic,
                direction=direction,
                velocity=velocity,
                mastery_current=mastery,
            ).model_dump())

    # Sort gaps by priority
    gaps.sort(key=lambda g: (g["priority"], g["mastery_score"]))

    return {
        "knowledge_gaps": gaps[:20],  # Top 20 gaps
        "improvement_trends": trends,
    }


async def assess_workload(state: RecommendationState) -> dict:
    """Node 3: Assess current study workload and burnout risk."""
    context = state["student_context"]
    recent = state["recent_events"]
    archetype = state["archetype"]

    # Calculate study metrics from recent events
    session_starts = [
        e for e in recent if e["type"] == "study_session_started"
    ]
    session_ends = [
        e for e in recent if e["type"] == "study_session_ended"
    ]

    study_sessions_7d = len(session_starts)

    # Estimate daily study minutes
    total_minutes = study_sessions_7d * 45  # rough estimate per session

    # Days since last activity
    last_active = context.get("recent_activity", {}).get("last_session_at")
    if last_active:
        try:
            last_dt = datetime.fromisoformat(last_active)
            days_inactive = (datetime.now(timezone.utc) - last_dt).days
        except (ValueError, TypeError):
            days_inactive = 0
    else:
        days_inactive = 99

    # Burnout detection
    burnout_risk = (
        study_sessions_7d > 21  # >3 sessions/day average
        or total_minutes > 420  # >60 min/day avg × 7
    )

    # Disengagement detection
    disengagement_risk = days_inactive >= 3

    # Archetype fit assessment
    guidance = ARCHETYPE_GUIDANCE.get(archetype or "", {})
    if burnout_risk:
        archetype_fit = "too_intense"
        archetype_advice = guidance.get(
            "warning",
            "You're studying intensely — remember to take breaks.",
        )
    elif disengagement_risk:
        archetype_fit = "disengaged"
        archetype_advice = "It's been a while! Even 15 minutes today helps."
    elif archetype == "Deep Diver" and len(set(
        e.get("subject", "") for e in recent if e.get("subject")
    )) <= 1:
        archetype_fit = "needs_breadth"
        archetype_advice = guidance.get(
            "warning",
            "You're focused deeply on one subject — try branching out.",
        )
    else:
        archetype_fit = "optimal"
        archetype_advice = guidance.get(
            "break_style",
            "You're maintaining a healthy study rhythm.",
        )

    assessment = WorkloadAssessment(
        daily_study_minutes_avg=round(total_minutes / 7, 1),
        study_sessions_7d=study_sessions_7d,
        work_break_ratio=None,
        burnout_risk=burnout_risk,
        disengagement_risk=disengagement_risk,
        days_since_last_activity=days_inactive,
        archetype_fit=archetype_fit,
        archetype_advice=archetype_advice,
    )

    return {"workload_assessment": assessment.model_dump()}


async def generate_recommendations(state: RecommendationState) -> dict:
    """Node 4: Generate personalized recommendations via Sonnet."""
    from app.engines.ai.gateway_deps import get_ai_gateway
    from app.engines.ai.prompt_registry import get_prompt_registry

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = UUID(state["student_id"])
    college_id = UUID(state["college_id"])
    archetype = state["archetype"] or "unknown"
    gaps = state["knowledge_gaps"]
    trends = state["improvement_trends"]
    workload = state["workload_assessment"]
    context = state["student_context"]

    # Check for any improving trends (for celebration)
    improving = [t for t in trends if t.get("direction") == "improving"]

    system_prompt = registry.get(
        "recommendation_engine",
        fallback=(
            "You are a medical education AI mentor. Generate personalized "
            "study recommendations for a medical student. Rules:\n"
            "1. Be a GUIDE, not a prescriber — suggest, don't dictate\n"
            "2. Personalize to the student's learning archetype\n"
            "3. Every recommendation must be ACTIONABLE and SPECIFIC\n"
            "4. Include data-driven reasons (cite mastery %, trends)\n"
            "5. Balance urgency (weak areas) with motivation (progress)\n"
            "6. If the student has improving trends, ALWAYS include at "
            "least one 'celebrate_progress' recommendation\n"
            "7. Recommend breaks if burnout risk is detected\n"
            "8. Generate 5-8 recommendations, priority-ordered"
        ),
    )

    # Build context for LLM
    gap_summary = "\n".join(
        f"- [{g['gap_type']}] {g['subject']}/{g['topic']}: "
        f"mastery={g['mastery_score']:.0%} — {g['detail']}"
        for g in gaps[:10]
    )

    trend_summary = "\n".join(
        f"- {t['subject']}/{t['topic']}: {t['direction']} "
        f"(velocity={t['velocity']:+.2f}, current={t['mastery_current']:.0%})"
        for t in trends[:10]
    )

    user_msg = (
        f"Student archetype: {archetype}\n"
        f"Overall mastery: {context.get('overall_mastery', 0):.0%}\n"
        f"Risk level: {context.get('risk_level', 'unknown')}\n"
        f"Confidence tendency: {context.get('confidence_tendency', 'unknown')}\n\n"
        f"Knowledge gaps (priority-ordered):\n{gap_summary or 'None identified'}\n\n"
        f"Improvement trends:\n{trend_summary or 'No trend data yet'}\n\n"
        f"Workload: {workload.get('daily_study_minutes_avg', 0):.0f} min/day avg, "
        f"{workload.get('study_sessions_7d', 0)} sessions this week\n"
        f"Burnout risk: {workload.get('burnout_risk', False)}\n"
        f"Days inactive: {workload.get('days_since_last_activity', 0)}\n"
        f"Archetype fit: {workload.get('archetype_fit', 'unknown')}\n\n"
        f"Improving topics: {len(improving)}\n"
        f"{'IMPORTANT: Include at least one celebrate_progress recommendation!' if improving else ''}\n\n"
        f"Generate 5-8 personalized recommendations."
    )

    # Create audit execution
    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        from sqlalchemy import text
        await db.execute(
            text("SET app.current_college_id = :cid"),
            {"cid": state["college_id"]},
        )

        execution = AgentExecution(
            college_id=college_id,
            user_id=student_id,
            agent_id=AGENT_ID,
            task_type=TaskType.RECOMMENDATION.value,
            execution_type=ExecutionType.AGENT.value,
            status=ExecutionStatus.RUNNING.value,
            input_data={
                "trigger": state["trigger"],
                "gaps_count": len(gaps),
                "archetype": archetype,
            },
        )
        db.add(execution)
        await db.flush()
        execution_id = str(execution.id)

        # Constrained decoding
        batch: GeneratedRecommendationBatch = await gateway.complete_structured(
            db,
            system_prompt=system_prompt,
            user_message=user_msg,
            output_schema=GeneratedRecommendationBatch,
            college_id=college_id,
            user_id=student_id,
            agent_id=AGENT_ID,
            task_type=TaskType.RECOMMENDATION.value,
            max_tokens=4096,
        )

        # Persist recommendations
        recs: list[dict] = []
        for gen in batch.recommendations:
            rec = StudentRecommendation(
                college_id=college_id,
                student_id=student_id,
                execution_id=execution.id,
                type=gen.type,
                priority=gen.priority,
                title=gen.title,
                description=gen.description,
                action=gen.action,
                estimated_time_minutes=gen.estimated_time_minutes,
                reason=gen.reason,
                deep_link=gen.deep_link,
                trigger=state["trigger"],
                status="active",
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
            db.add(rec)
            await db.flush()
            await db.refresh(rec)

            recs.append({
                "id": str(rec.id),
                "type": rec.type,
                "priority": rec.priority,
                "title": rec.title,
                "description": rec.description,
                "action": rec.action,
                "estimated_time_minutes": rec.estimated_time_minutes,
                "reason": rec.reason,
                "deep_link": rec.deep_link,
                "trigger": rec.trigger,
                "status": rec.status,
                "created_at": rec.created_at.isoformat() if rec.created_at else None,
            })

        execution.status = ExecutionStatus.COMPLETED.value
        execution.output_data = {"recommendation_count": len(recs)}
        await db.commit()

    return {
        "recommendations": recs,
        "execution_id": execution_id,
    }


async def build_study_plan(state: RecommendationState) -> dict:
    """Node 5 (conditional): Build weekly study plan for 'weekly' trigger."""
    from app.engines.ai.gateway_deps import get_ai_gateway
    from app.engines.ai.prompt_registry import get_prompt_registry

    gateway = get_ai_gateway()
    registry = get_prompt_registry()

    student_id = UUID(state["student_id"])
    college_id = UUID(state["college_id"])
    archetype = state["archetype"] or "unknown"
    gaps = state["knowledge_gaps"]
    workload = state["workload_assessment"]

    system_prompt = registry.get(
        "study_plan_generator",
        fallback=(
            "You are a medical education AI planner. Create a 7-day study "
            "schedule for a medical student. Rules:\n"
            "1. Allocate subjects based on knowledge gaps (weakest first)\n"
            "2. Include flashcard review sessions daily\n"
            "3. Include at least 2 practice test slots per week\n"
            "4. Add break recommendations appropriate for archetype\n"
            "5. Keep daily study between 2-5 hours (adjustable)\n"
            "6. Balance morning (fresh concepts) and evening (review)\n"
            "7. Set a motivational weekly goal"
        ),
    )

    gap_summary = "\n".join(
        f"- {g['subject']}/{g['topic']}: mastery={g['mastery_score']:.0%}"
        for g in gaps[:10]
    )

    guidance = ARCHETYPE_GUIDANCE.get(archetype, {})
    user_msg = (
        f"Student archetype: {archetype}\n"
        f"Optimal pattern: {guidance.get('optimal_pattern', 'balanced study')}\n"
        f"Break style: {guidance.get('break_style', 'regular breaks')}\n"
        f"Current study load: {workload.get('daily_study_minutes_avg', 0):.0f} min/day\n\n"
        f"Priority gaps:\n{gap_summary or 'No specific gaps identified'}\n\n"
        f"Days: Monday through Sunday\n"
        f"Create a comprehensive 7-day study plan."
    )

    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        from sqlalchemy import text
        await db.execute(
            text("SET app.current_college_id = :cid"),
            {"cid": state["college_id"]},
        )

        plan: GeneratedWeeklyPlan = await gateway.complete_structured(
            db,
            system_prompt=system_prompt,
            user_message=user_msg,
            output_schema=GeneratedWeeklyPlan,
            college_id=college_id,
            user_id=student_id,
            agent_id=AGENT_ID,
            task_type=TaskType.RECOMMENDATION.value,
            max_tokens=4096,
        )

        # Expire old plans
        await db.execute(
            update(StudentStudyPlan)
            .where(
                StudentStudyPlan.student_id == student_id,
                StudentStudyPlan.college_id == college_id,
                StudentStudyPlan.status == "active",
            )
            .values(status="expired")
        )

        today = date.today()
        # Week starts next Monday
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        week_start = today + timedelta(days=days_until_monday)
        week_end = week_start + timedelta(days=6)

        plan_data = plan.model_dump()

        study_plan = StudentStudyPlan(
            college_id=college_id,
            student_id=student_id,
            execution_id=UUID(state["execution_id"]) if state.get("execution_id") else None,
            week_start=week_start,
            week_end=week_end,
            plan_data=plan_data,
            focus_subjects=plan.focus_subjects,
            weekly_goal=plan.weekly_goal,
            status="active",
        )
        db.add(study_plan)
        await db.flush()
        await db.refresh(study_plan)

        plan_response = {
            "id": str(study_plan.id),
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "plan_data": plan_data,
            "focus_subjects": plan.focus_subjects,
            "weekly_goal": plan.weekly_goal,
            "status": "active",
            "created_at": study_plan.created_at.isoformat() if study_plan.created_at else None,
        }

        await db.commit()

    return {"study_plan": plan_response}


# ---------------------------------------------------------------------------
# Conditional edge
# ---------------------------------------------------------------------------

def should_build_plan(state: RecommendationState) -> str:
    """Conditional: build weekly plan only for 'weekly' trigger."""
    if state["trigger"] == "weekly":
        return "build_study_plan"
    return END


# ---------------------------------------------------------------------------
# Build graph
# ---------------------------------------------------------------------------

def build_recommendation_graph() -> StateGraph:
    """Build the S6 Recommendation Engine LangGraph."""
    graph = StateGraph(RecommendationState)

    graph.add_node("gather_student_data", gather_student_data)
    graph.add_node("analyze_knowledge_gaps", analyze_knowledge_gaps)
    graph.add_node("assess_workload", assess_workload)
    graph.add_node("generate_recommendations", generate_recommendations)
    graph.add_node("build_study_plan", build_study_plan)

    graph.add_edge(START, "gather_student_data")
    graph.add_edge("gather_student_data", "analyze_knowledge_gaps")
    graph.add_edge("analyze_knowledge_gaps", "assess_workload")
    graph.add_edge("assess_workload", "generate_recommendations")
    graph.add_conditional_edges(
        "generate_recommendations",
        should_build_plan,
        {"build_study_plan": "build_study_plan", END: END},
    )
    graph.add_edge("build_study_plan", END)

    return graph


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def run_recommendations(
    db: AsyncSession,
    gateway: AIGateway,
    prompt_registry: PromptRegistry,
    *,
    student_id: UUID,
    college_id: UUID,
    trigger: str = "manual",
) -> RecommendationListResponse:
    """Run the full recommendation pipeline.

    Triggers:
    - "manual": Student explicitly requests recommendations
    - "login": Generated on student login
    - "session_end": Generated after a study session ends
    - "weekly": Generates recommendations + weekly study plan
    """
    graph = build_recommendation_graph()
    compiled = graph.compile()

    initial_state: RecommendationState = {
        "student_id": str(student_id),
        "college_id": str(college_id),
        "trigger": trigger,
        "student_context": {},
        "recent_events": [],
        "archetype": None,
        "knowledge_gaps": [],
        "improvement_trends": [],
        "workload_assessment": {},
        "recommendations": [],
        "study_plan": None,
        "execution_id": None,
    }

    result = await compiled.ainvoke(initial_state)

    recs = [
        RecommendationResponse(
            id=r["id"],
            type=r["type"],
            priority=r["priority"],
            title=r["title"],
            description=r["description"],
            action=r["action"],
            estimated_time_minutes=r.get("estimated_time_minutes", 30),
            reason=r.get("reason", ""),
            deep_link=r.get("deep_link"),
            trigger=r.get("trigger", trigger),
            status=r.get("status", "active"),
            created_at=datetime.fromisoformat(r["created_at"]) if r.get("created_at") else None,
        )
        for r in result.get("recommendations", [])
    ]

    active = sum(1 for r in recs if r.status == "active")

    return RecommendationListResponse(
        recommendations=recs,
        total=len(recs),
        active=active,
    )


async def get_current_recommendations(
    db: AsyncSession,
    *,
    student_id: UUID,
    college_id: UUID,
) -> RecommendationListResponse:
    """Get the student's current active recommendations."""
    result = await db.execute(
        select(StudentRecommendation)
        .where(
            StudentRecommendation.student_id == student_id,
            StudentRecommendation.college_id == college_id,
            StudentRecommendation.status == "active",
        )
        .order_by(
            StudentRecommendation.priority.asc(),
            StudentRecommendation.created_at.desc(),
        )
        .limit(20)
    )
    recs = result.scalars().all()

    responses = [
        RecommendationResponse(
            id=str(r.id),
            type=r.type,
            priority=r.priority,
            title=r.title,
            description=r.description,
            action=r.action,
            estimated_time_minutes=r.estimated_time_minutes or 30,
            reason=r.reason or "",
            deep_link=r.deep_link,
            trigger=r.trigger,
            status=r.status,
            created_at=r.created_at,
        )
        for r in recs
    ]

    return RecommendationListResponse(
        recommendations=responses,
        total=len(responses),
        active=len(responses),
    )


async def dismiss_recommendation(
    db: AsyncSession,
    *,
    student_id: UUID,
    college_id: UUID,
    recommendation_id: UUID,
    reason: str | None = None,
) -> dict:
    """Dismiss a recommendation (student doesn't want to do it)."""
    result = await db.execute(
        select(StudentRecommendation).where(
            StudentRecommendation.id == recommendation_id,
            StudentRecommendation.student_id == student_id,
            StudentRecommendation.college_id == college_id,
        )
    )
    rec = result.scalars().first()
    if not rec:
        return {"status": "not_found"}

    rec.status = "dismissed"
    rec.dismissed_at = datetime.now(timezone.utc)
    rec.dismiss_reason = reason
    await db.flush()

    return {"status": "dismissed", "id": str(rec.id)}


async def complete_recommendation(
    db: AsyncSession,
    *,
    student_id: UUID,
    college_id: UUID,
    recommendation_id: UUID,
    feedback: str | None = None,
) -> dict:
    """Mark a recommendation as completed."""
    result = await db.execute(
        select(StudentRecommendation).where(
            StudentRecommendation.id == recommendation_id,
            StudentRecommendation.student_id == student_id,
            StudentRecommendation.college_id == college_id,
        )
    )
    rec = result.scalars().first()
    if not rec:
        return {"status": "not_found"}

    rec.status = "completed"
    rec.completed_at = datetime.now(timezone.utc)
    rec.completion_feedback = feedback
    await db.flush()

    # Fire metacognitive event
    try:
        from app.engines.ai.analytics.metacognitive import get_analytics_engine
        from app.engines.ai.analytics.schemas import MetacognitiveEventInput

        engine = get_analytics_engine()
        event = MetacognitiveEventInput(
            student_id=student_id,
            college_id=college_id,
            event_type="ai_interaction",
            event_data={
                "interaction_type": "recommendation_completed",
                "recommendation_id": str(recommendation_id),
                "recommendation_type": rec.type,
            },
        )
        await engine.capture_event(db, event)
    except Exception:
        logger.warning("Failed to fire metacognitive event", exc_info=True)

    return {"status": "completed", "id": str(rec.id)}


async def get_current_study_plan(
    db: AsyncSession,
    *,
    student_id: UUID,
    college_id: UUID,
) -> StudyPlanResponse | None:
    """Get the student's current active study plan."""
    result = await db.execute(
        select(StudentStudyPlan)
        .where(
            StudentStudyPlan.student_id == student_id,
            StudentStudyPlan.college_id == college_id,
            StudentStudyPlan.status == "active",
        )
        .order_by(StudentStudyPlan.created_at.desc())
        .limit(1)
    )
    plan = result.scalars().first()
    if not plan:
        return None

    plan_data = plan.plan_data or {}
    days_data = plan_data.get("days", [])

    day_responses = []
    for day in days_data:
        blocks = day.get("study_blocks", [])
        total_min = sum(b.get("duration_minutes", 0) for b in blocks)
        day_responses.append(StudyPlanDayResponse(
            day_name=day.get("day_name", ""),
            date=None,
            study_blocks=blocks,
            break_reminder=day.get("break_reminder", ""),
            total_study_minutes=total_min,
        ))

    return StudyPlanResponse(
        id=str(plan.id),
        week_start=plan.week_start,
        week_end=plan.week_end,
        days=day_responses,
        focus_subjects=plan.focus_subjects or [],
        weekly_goal=plan.weekly_goal or "",
        status=plan.status,
        created_at=plan.created_at,
    )
