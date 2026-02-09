"""Integration Engine — API Routes.

Prefix: /api/v1/integration
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/attendance")
async def list_attendance_records():
    """List attendance records."""
    return {"data": [], "total": 0}


@router.post("/attendance/import")
async def import_attendance():
    """Import attendance data (CSV or AEBAS parallel capture)."""
    return {"status": "not_implemented"}


@router.get("/hmis")
async def list_hmis_data():
    """List HMIS data points."""
    return {"data": [], "total": 0}


@router.post("/webhooks/razorpay")
async def razorpay_webhook():
    """Handle Razorpay webhook events."""
    return {"status": "received"}
