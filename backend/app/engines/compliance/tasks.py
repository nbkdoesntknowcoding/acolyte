"""Compliance Engine — Celery Background Tasks."""

from app.core.celery_app import celery_app


@celery_app.task(name="compliance.daily_snapshot")
def generate_daily_compliance_snapshot(college_id: str):
    """Generate daily compliance snapshot for all departments."""
    pass


@celery_app.task(name="compliance.prophet_forecast")
def run_prophet_forecast(college_id: str):
    """Run Prophet forecasting on 90-day rolling compliance data."""
    pass
