"""Faculty Engine — Celery Background Tasks."""

import logging

from app.core.celery_app import celery_app
from app.core.tasks import AcolyteBaseTask

logger = logging.getLogger(__name__)


@celery_app.task(base=AcolyteBaseTask, name="faculty.batch_generate_mcqs")
def batch_generate_mcqs(competency_codes: list[str], college_id: str):
    """Batch MCQ generation via Claude Batch API (50% discount).

    Generates MCQs for multiple competency codes in a single batch
    request. Each MCQ includes psychometric targets (difficulty,
    discrimination, Bloom's level).
    """
    logger.info(
        "Batch generating MCQs for %d competencies, college_id=%s",
        len(competency_codes), college_id,
    )
    # TODO: Implement — build prompts per competency, submit to
    # Claude Batch API via Central AI Engine, store in question_bank_items


@celery_app.task(base=AcolyteBaseTask, name="faculty.calculate_psychometrics")
def calculate_psychometrics(assessment_id: str):
    """Calculate psychometric data after an assessment is conducted.

    Computes difficulty_index, discrimination_index, and
    distractor_effectiveness for each MCQ based on student responses.
    """
    logger.info("Calculating psychometrics for assessment_id=%s", assessment_id)
    # TODO: Implement — fetch test_attempts, calculate item analysis,
    # update question_bank_items with psychometric data
