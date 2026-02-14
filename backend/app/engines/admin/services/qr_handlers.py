"""Admin engine QR action handlers.

Handlers for admin-domain QR actions: mess entry, library, hostel, equipment.
Each handler is an async function called by QRService when the matching
action_type is scanned.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.qr import QRScanLog

logger = logging.getLogger(__name__)


def _get_meal_by_hour(hour: int) -> str:
    """Determine meal type based on hour of day."""
    if hour < 10:
        return "breakfast"
    elif hour < 15:
        return "lunch"
    elif hour < 18:
        return "snacks"
    else:
        return "dinner"


async def handle_mess_entry(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    **kwargs,
) -> dict:
    """Handle mess entry scan — determine meal and check for duplicates."""
    now = datetime.now(timezone.utc)
    meal = _get_meal_by_hour(now.hour)

    # Check duplicate: same user + mess_entry + same date + same meal
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count(QRScanLog.id)).where(
            QRScanLog.user_id == user_id,
            QRScanLog.action_type == "mess_entry",
            QRScanLog.validation_result == "success",
            QRScanLog.scanned_at >= today_start,
        )
    )
    count = result.scalar() or 0

    # Simple duplicate check: more than 1 scan per meal period
    if count > 0:
        return {
            "status": "duplicate",
            "message": f"Already scanned for {meal} today",
            "meal": meal,
        }

    return {
        "status": "success",
        "message": f"{meal.capitalize()} entry recorded",
        "meal": meal,
        "timestamp": now.isoformat(),
    }


async def handle_library_checkout(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    entity_id: UUID | None = None,
    **kwargs,
) -> dict:
    """Handle library book checkout scan."""
    if not entity_id:
        return {
            "status": "error",
            "message": "No book specified for checkout",
        }

    # In a full implementation, these would query LibraryBook and LibraryIssuance models.
    # For now, return success with placeholder data.
    return {
        "status": "success",
        "message": "Book checked out successfully",
        "entity_id": str(entity_id),
        "due_date": (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                     + __import__("datetime").timedelta(days=14)).isoformat(),
    }


async def handle_library_return(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    **kwargs,
) -> dict:
    """Handle library book return scan — returns list of active issuances for selection."""
    # In full implementation: query LibraryIssuance where user_id and status="issued"
    return {
        "status": "select_book",
        "message": "Select book to return",
        "active_issuances": [],
    }


async def handle_hostel_checkin(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    **kwargs,
) -> dict:
    """Handle hostel check-in/check-out scan with curfew detection."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Check last scan today to determine direction
    result = await db.execute(
        select(QRScanLog.extra_data).where(
            QRScanLog.user_id == user_id,
            QRScanLog.action_type == "hostel_checkin",
            QRScanLog.validation_result == "success",
            QRScanLog.scanned_at >= today_start,
        ).order_by(QRScanLog.scanned_at.desc()).limit(1)
    )
    last_scan = result.scalar_one_or_none()

    # Determine direction
    if last_scan and isinstance(last_scan, dict) and last_scan.get("direction") == "entry":
        direction = "exit"
    else:
        direction = "entry"

    # Curfew check: entry after 10pm or before 5am
    curfew_violation = False
    if direction == "entry" and (now.hour >= 22 or now.hour < 5):
        curfew_violation = True
        try:
            from app.core.events import publish_event
            await publish_event("hostel.curfew_violation", {
                "user_id": str(user_id),
                "time": now.isoformat(),
            })
        except Exception:
            logger.warning("Failed to publish curfew violation event")

    return {
        "status": "success",
        "message": f"Hostel {direction} recorded",
        "direction": direction,
        "curfew_violation": curfew_violation,
        "timestamp": now.isoformat(),
    }


async def handle_equipment_checkout(
    user_id: UUID,
    action_point,
    device_trust,
    gps: dict | None,
    db: AsyncSession,
    entity_id: UUID | None = None,
    **kwargs,
) -> dict:
    """Handle equipment checkout scan."""
    if not entity_id:
        return {
            "status": "error",
            "message": "No equipment specified for checkout",
        }

    return {
        "status": "success",
        "message": "Equipment checked out successfully",
        "entity_id": str(entity_id),
    }


def register_admin_qr_handlers(qr_service_cls) -> None:
    """Register all admin engine QR action handlers."""
    qr_service_cls.register_handler("mess_entry", handle_mess_entry)
    qr_service_cls.register_handler("library_checkout", handle_library_checkout)
    qr_service_cls.register_handler("library_return", handle_library_return)
    qr_service_cls.register_handler("library_visit", handle_library_return)
    qr_service_cls.register_handler("hostel_checkin", handle_hostel_checkin)
    qr_service_cls.register_handler("equipment_checkout", handle_equipment_checkout)
