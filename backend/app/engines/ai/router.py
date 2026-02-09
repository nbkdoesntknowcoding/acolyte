"""Request Router — classifies and routes AI requests to specialized agents.

Uses Haiku/GPT-4o-mini for fast, cheap classification.
"""

from enum import Enum


class AgentType(str, Enum):
    SOCRATIC_TUTOR = "socratic_tutor"
    MCQ_GENERATOR = "mcq_generator"
    SAQ_RUBRIC_GENERATOR = "saq_rubric_generator"
    LESSON_PLAN_GENERATOR = "lesson_plan_generator"
    ROTATION_SCHEDULER = "rotation_scheduler"
    COMPLIANCE_MONITOR = "compliance_monitor"
    CONTENT_EXTRACTOR = "content_extractor"
    FLASHCARD_GENERATOR = "flashcard_generator"
    SAF_GENERATOR = "saf_generator"


async def classify_request(message: str, context: dict) -> AgentType:
    """Classify an incoming request and route to the appropriate agent.

    Uses fast-classification model (Haiku/GPT-4o-mini).
    """
    # TODO: Implement LLM-based classification
    # For now, return based on context hints
    role = context.get("role", "student")
    if role == "student":
        return AgentType.SOCRATIC_TUTOR
    elif role == "faculty":
        return AgentType.MCQ_GENERATOR
    else:
        return AgentType.COMPLIANCE_MONITOR
