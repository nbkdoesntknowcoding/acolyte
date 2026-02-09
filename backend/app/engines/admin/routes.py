"""Admin Engine — API Routes.

Prefix: /api/v1/admin
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/dashboard")
async def get_admin_dashboard():
    """Get admin dashboard summary."""
    return {
        "total_students": 0,
        "total_faculty": 0,
        "fee_collection_this_semester": 0,
        "pending_admissions": 0,
    }


@router.get("/students")
async def list_students():
    """List students with pagination."""
    return {"data": [], "total": 0}


@router.get("/faculty")
async def list_faculty():
    """List faculty with pagination."""
    return {"data": [], "total": 0}


@router.get("/departments")
async def list_departments():
    """List departments."""
    return {"data": [], "total": 0}


@router.get("/fees")
async def list_fee_structures():
    """List fee structures."""
    return {"data": [], "total": 0}
