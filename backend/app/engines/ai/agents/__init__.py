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
    from app.engines.ai.agents.neet_pg_prep import (
        generate_neetpg_mock_test,
        analyze_neetpg_result,
        get_neetpg_high_yield_topics,
        get_neetpg_history,
        NEETPGPrepAgent,
    )
    from app.engines.ai.agents.flashcard_generator import (
        FlashcardGenerator,
        generate_flashcards_from_pdf,
        generate_flashcards_from_topic,
        get_review_session,
        process_flashcard_review,
        get_flashcard_stats,
    )
    from app.engines.ai.agents.recommendation_engine import (
        run_recommendations,
        get_current_recommendations,
        dismiss_recommendation,
        complete_recommendation,
        get_current_study_plan,
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
from app.engines.ai.agents.neet_pg_prep import (  # noqa: F401
    NEETPGPrepAgent,
    analyze_neetpg_result,
    generate_neetpg_mock_test,
    get_neetpg_high_yield_topics,
    get_neetpg_history,
)
from app.engines.ai.agents.flashcard_generator import (  # noqa: F401
    FlashcardGenerator,
    generate_flashcards_from_pdf,
    generate_flashcards_from_topic,
    get_flashcard_stats,
    get_review_session,
    process_flashcard_review,
)
from app.engines.ai.agents.recommendation_engine import (  # noqa: F401
    build_recommendation_graph,
    complete_recommendation,
    dismiss_recommendation,
    get_current_recommendations,
    get_current_study_plan,
    run_recommendations,
)
