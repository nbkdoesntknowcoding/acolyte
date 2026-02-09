"""Faculty Engine — Celery Background Tasks."""

from app.core.celery_app import celery_app


@celery_app.task(name="faculty.batch_generate_mcqs")
def batch_generate_mcqs(competency_codes: list[str], college_id: str):
    """Batch MCQ generation via Claude Batch API (50% discount)."""
    pass


@celery_app.task(name="faculty.calculate_psychometrics")
def calculate_psychometrics(assessment_id: str):
    """Calculate psychometric data after an assessment is conducted."""
    pass
