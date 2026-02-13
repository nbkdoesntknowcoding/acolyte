"""Tests for QR action handlers (admin + faculty engines)."""

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

os.environ.setdefault("DEVICE_TRUST_SECRET", "test-device-trust-secret-key-32chars!")
os.environ.setdefault("QR_TOKEN_SECRET", "test-qr-token-secret-key-32chars-ok!")
os.environ.setdefault("QR_ACTION_POINT_SECRET", "test-action-point-hmac-secret-key!")

from app.engines.admin.services.qr_handlers import (
    handle_hostel_checkin,
    handle_library_checkout,
    handle_mess_entry,
    register_admin_qr_handlers,
)
from app.engines.faculty.services.qr_handlers import (
    handle_attendance_mark,
    handle_clinical_posting,
    register_faculty_qr_handlers,
)
from app.shared.services.qr_service import QRService


def _make_mock_db(scan_count=0, last_direction=None):
    """Create a mock async DB session."""
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar.return_value = scan_count
    if last_direction:
        mock_result.scalar_one_or_none.return_value = {"direction": last_direction}
    else:
        mock_result.scalar_one_or_none.return_value = None
    db.execute.return_value = mock_result
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


def _make_mock_action_point(action_type="mess_entry", extra_data=None):
    ap = MagicMock()
    ap.id = uuid4()
    ap.college_id = uuid4()
    ap.action_type = action_type
    ap.security_level = "standard"
    ap.extra_data = extra_data or {}
    ap.duplicate_window_minutes = 30
    return ap


class TestMessEntry:
    @pytest.mark.asyncio
    async def test_mess_entry_breakfast_before_10am(self):
        """Mess entry before 10am returns breakfast."""
        db = _make_mock_db(scan_count=0)
        ap = _make_mock_action_point("mess_entry")
        device = MagicMock()

        with patch("app.engines.admin.services.qr_handlers.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 13, 8, 30, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = await handle_mess_entry(uuid4(), ap, device, None, db)

        assert result["status"] == "success"
        assert result["meal"] == "breakfast"

    @pytest.mark.asyncio
    async def test_mess_entry_lunch_between_10_15(self):
        """Mess entry between 10am and 3pm returns lunch."""
        db = _make_mock_db(scan_count=0)
        ap = _make_mock_action_point("mess_entry")
        device = MagicMock()

        with patch("app.engines.admin.services.qr_handlers.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 13, 12, 0, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = await handle_mess_entry(uuid4(), ap, device, None, db)

        assert result["status"] == "success"
        assert result["meal"] == "lunch"

    @pytest.mark.asyncio
    async def test_mess_entry_duplicate_same_meal_rejected(self):
        """Duplicate mess scan in same period returns duplicate."""
        db = _make_mock_db(scan_count=1)  # Already has 1 scan today
        ap = _make_mock_action_point("mess_entry")
        device = MagicMock()

        result = await handle_mess_entry(uuid4(), ap, device, None, db)

        assert result["status"] == "duplicate"


class TestLibraryCheckout:
    @pytest.mark.asyncio
    async def test_library_checkout_success(self):
        """Library checkout with valid entity returns success."""
        db = _make_mock_db()
        ap = _make_mock_action_point("library_checkout")
        device = MagicMock()
        entity_id = uuid4()

        result = await handle_library_checkout(
            uuid4(), ap, device, None, db, entity_id=entity_id
        )

        assert result["status"] == "success"
        assert "due_date" in result

    @pytest.mark.asyncio
    async def test_library_checkout_no_entity_fails(self):
        """Library checkout without entity_id returns error."""
        db = _make_mock_db()
        ap = _make_mock_action_point("library_checkout")
        device = MagicMock()

        result = await handle_library_checkout(uuid4(), ap, device, None, db)

        assert result["status"] == "error"


class TestHostelCheckin:
    @pytest.mark.asyncio
    async def test_hostel_entry_after_curfew_flagged(self):
        """Hostel entry after 10pm is flagged as curfew violation."""
        db = _make_mock_db(last_direction=None)  # No previous scan = entry
        ap = _make_mock_action_point("hostel_checkin")
        device = MagicMock()

        with patch("app.engines.admin.services.qr_handlers.datetime") as mock_dt:
            mock_dt.now.return_value = datetime(2026, 2, 13, 23, 30, tzinfo=timezone.utc)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            with patch(
                "app.core.events.publish_event",
                new_callable=AsyncMock,
            ):
                result = await handle_hostel_checkin(uuid4(), ap, device, None, db)

        assert result["status"] == "success"
        assert result["direction"] == "entry"
        assert result["curfew_violation"] is True


class TestAttendanceMark:
    @pytest.mark.asyncio
    async def test_attendance_mark_with_gps(self):
        """Attendance marking returns subject from metadata."""
        db = _make_mock_db()
        ap = _make_mock_action_point(
            "attendance_mark",
            extra_data={"subject": "Anatomy", "class_session_id": "sess_123"},
        )
        ap.security_level = "elevated"
        device = MagicMock()

        result = await handle_attendance_mark(
            uuid4(), ap, device, {"lat": 12.97, "lng": 77.59}, db
        )

        assert result["status"] == "success"
        assert result["subject"] == "Anatomy"
        assert result["gps_validated"] is True


class TestClinicalPosting:
    @pytest.mark.asyncio
    async def test_clinical_posting_records(self):
        """Clinical posting scan records the posting."""
        db = _make_mock_db()
        ap = _make_mock_action_point(
            "clinical_posting",
            extra_data={"department": "General Medicine"},
        )
        device = MagicMock()

        result = await handle_clinical_posting(uuid4(), ap, device, None, db)

        assert result["status"] == "success"
        assert "General Medicine" in result["message"]


class TestHandlerRegistration:
    def test_admin_handlers_registered(self):
        """register_admin_qr_handlers registers all admin handlers."""
        # Clear handlers first
        QRService._action_handlers.clear()
        register_admin_qr_handlers(QRService)

        assert "mess_entry" in QRService._action_handlers
        assert "library_checkout" in QRService._action_handlers
        assert "hostel_checkin" in QRService._action_handlers
        assert "equipment_checkout" in QRService._action_handlers

    def test_faculty_handlers_registered(self):
        """register_faculty_qr_handlers registers all faculty handlers."""
        QRService._action_handlers.clear()
        register_faculty_qr_handlers(QRService)

        assert "attendance_mark" in QRService._action_handlers
        assert "clinical_posting" in QRService._action_handlers
        assert "event_checkin" in QRService._action_handlers
        assert "exam_hall_entry" in QRService._action_handlers
