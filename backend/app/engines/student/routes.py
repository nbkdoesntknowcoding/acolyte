"""Student Engine — API Routes.

Prefix: /api/v1/student
"""

from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/dashboard")
async def get_student_dashboard():
    """Get student dashboard summary."""
    return {
        "study_sessions_this_week": 0,
        "flashcards_due": 0,
        "practice_tests_completed": 0,
        "competencies_logged": 0,
    }


@router.get("/sessions")
async def list_study_sessions():
    """List study sessions for the current student."""
    return {"data": [], "total": 0}


@router.get("/flashcards")
async def list_flashcards():
    """List flashcards for the current student."""
    return {"data": [], "total": 0}


@router.get("/practice-tests")
async def list_practice_tests():
    """List practice tests."""
    return {"data": [], "total": 0}
