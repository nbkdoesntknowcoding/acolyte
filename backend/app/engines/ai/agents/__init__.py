"""LangGraph agents — Section L of architecture document.

Agents are standalone LangGraph StateGraphs invoked by the Central AI Engine.
Each agent has its own typed state schema, conditional routing, and checkpointing.

Usage from routes or other engines (via AI engine public interface):

    from app.engines.ai.agents.socratic_study_buddy import (
        run_socratic_study_buddy,
        stream_socratic_study_buddy,
    )
    from app.engines.ai.agents.practice_question_generator import (
        generate_practice_questions,
        GeneratedMCQ,
        PracticeQuestionBatch,
    )
    from app.engines.ai.agents.exam_question_generator import (
        generate_exam_questions,
        handle_faculty_review,
        ExamQuestionDraft,
    )
"""

from app.engines.ai.agents.socratic_study_buddy import (  # noqa: F401
    SocraticState,
    build_socratic_graph,
    run_socratic_study_buddy,
    stream_socratic_study_buddy,
)
from app.engines.ai.agents.practice_question_generator import (  # noqa: F401
    GeneratedMCQ,
    MCQOption,
    PracticeQuestionBatch,
    QuestionGenState,
    build_question_gen_graph,
    generate_practice_questions,
)
from app.engines.ai.agents.exam_question_generator import (  # noqa: F401
    ExamGenState,
    ExamQuestionDraft,
    GeneratedLAQ,
    GeneratedSAQ,
    RubricCriterion,
    SubQuestion,
    build_exam_gen_graph,
    generate_exam_questions,
    handle_faculty_review,
)
