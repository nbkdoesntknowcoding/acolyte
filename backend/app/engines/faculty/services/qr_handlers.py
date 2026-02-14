"""Faculty engine QR action handlers.

Handlers for faculty-domain QR actions: attendance, clinical posting, events, exams.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def handle_attendance_mark(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    **kwargs,
) -> dict:
    """Handle classroom attendance marking via QR scan."""
    # Extract context from action point metadata
    ap_meta = action_point.extra_data if hasattr(action_point, "extra_data") else {}
    if isinstance(ap_meta, dict):
        class_session_id = ap_meta.get("class_session_id")
        subject = ap_meta.get("subject", "Unknown")
    else:
        class_session_id = None
        subject = "Unknown"

    gps_validated = gps is not None and action_point.security_level in ("elevated", "strict")

    return {
        "status": "success",
        "message": f"Attendance marked for {subject}",
        "subject": subject,
        "class_session_id": class_session_id,
        "gps_validated": gps_validated,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def handle_clinical_posting(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    **kwargs,
) -> dict:
    """Handle clinical posting check-in scan."""
    # In full implementation: query ClinicalRotation for user + department
    ap_meta = action_point.extra_data if hasattr(action_point, "extra_data") else {}
    department = ap_meta.get("department", "Unknown") if isinstance(ap_meta, dict) else "Unknown"

    return {
        "status": "success",
        "message": f"Clinical posting attendance recorded for {department}",
        "department": department,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def handle_event_checkin(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    **kwargs,
) -> dict:
    """Handle CME/FDP/conference event check-in."""
    ap_meta = action_point.extra_data if hasattr(action_point, "extra_data") else {}
    event_name = ap_meta.get("event_name", "Event") if isinstance(ap_meta, dict) else "Event"

    return {
        "status": "success",
        "message": f"Checked in to {event_name}",
        "event_name": event_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def handle_exam_hall_entry(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    **kwargs,
) -> dict:
    """Handle exam hall entry — requires STRICT security level."""
    ap_meta = action_point.extra_data if hasattr(action_point, "extra_data") else {}
    exam_name = ap_meta.get("exam_name", "Exam") if isinstance(ap_meta, dict) else "Exam"

    return {
        "status": "success",
        "message": f"Exam hall entry recorded for {exam_name}",
        "exam_name": exam_name,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def register_faculty_qr_handlers(qr_service_cls) -> None:
    """Register all faculty engine QR action handlers."""
    qr_service_cls.register_handler("attendance_mark", handle_attendance_mark)
    qr_service_cls.register_handler("clinical_posting", handle_clinical_posting)
    qr_service_cls.register_handler("event_checkin", handle_event_checkin)
    qr_service_cls.register_handler("exam_hall_entry", handle_exam_hall_entry)
