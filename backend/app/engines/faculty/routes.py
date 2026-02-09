"""Faculty Engine — API Routes.

Prefix: /api/v1/faculty
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/dashboard")
async def get_faculty_dashboard():
    """Get faculty dashboard summary."""
    return {
        "pending_assessments": 0,
        "logbook_entries_awaiting": 0,
        "question_bank_count": 0,
        "active_rotations": 0,
    }


@router.get("/logbook")
async def list_logbook_entries():
    """List logbook entries (filtered by faculty's department)."""
    return {"data": [], "total": 0}


@router.get("/question-bank")
async def list_question_bank():
    """List question bank items."""
    return {"data": [], "total": 0}


@router.get("/assessments")
async def list_assessments():
    """List assessments."""
    return {"data": [], "total": 0}


@router.get("/rotations")
async def list_rotations():
    """List clinical rotations."""
    return {"data": [], "total": 0}


@router.get("/lesson-plans")
async def list_lesson_plans():
    """List lesson plans."""
    return {"data": [], "total": 0}
