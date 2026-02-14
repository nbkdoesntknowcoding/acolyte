"""Tests for AQP Celery background tasks.

Verifies task registration and logic with mocked DB sessions.
"""

import os
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

os.environ.setdefault("DEVICE_TRUST_SECRET", "test-device-trust-secret-key-32chars!")
os.environ.setdefault("QR_TOKEN_SECRET", "test-qr-token-secret-key-32chars-ok!")
os.environ.setdefault("QR_ACTION_POINT_SECRET", "test-action-point-hmac-secret-key!")

# Patch target for all tasks — they use deferred imports
_DB_PATCH = "app.core.database.sync_session_factory"


def _make_mock_session(rowcount=0, rows=None):
    """Create a mock sync session context manager."""
    mock_session = MagicMock()
    mock_result = MagicMock()
    mock_result.rowcount = rowcount
    mock_result.all.return_value = rows or []
    mock_session.execute.return_value = mock_result
    mock_session.__enter__ = MagicMock(return_value=mock_session)
    mock_session.__exit__ = MagicMock(return_value=False)
    return mock_session


class TestDeviceTasks:
    def test_check_expired_tokens(self):
        """check_expired_device_tokens expires old tokens."""
        mock_session = _make_mock_session(rowcount=3)

        with patch(_DB_PATCH, return_value=mock_session):
            from app.shared.tasks.device_tasks import check_expired_device_tokens
            result = check_expired_device_tokens()

        assert result["expired_count"] == 3
        mock_session.commit.assert_called_once()

    def test_cleanup_transfer_requests(self):
        """cleanup_expired_transfer_requests expires stale requests."""
        mock_session = _make_mock_session(rowcount=5)

        with patch(_DB_PATCH, return_value=mock_session):
            from app.shared.tasks.device_tasks import cleanup_expired_transfer_requests
            result = cleanup_expired_transfer_requests()

        assert result["expired_count"] == 5

    def test_flag_suspicious_resets(self):
        """flag_suspicious_device_resets returns flagged users."""
        mock_row = MagicMock()
        mock_row.user_id = "test-user-123"
        mock_row.reset_count = 5
        mock_session = _make_mock_session(rows=[mock_row])

        with patch(_DB_PATCH, return_value=mock_session):
            from app.shared.tasks.device_tasks import flag_suspicious_device_resets
            result = flag_suspicious_device_resets()

        assert result["flagged_count"] == 1


class TestQRTasks:
    def test_rotate_qrs(self):
        """rotate_action_point_qrs rotates secrets."""
        mock_session = _make_mock_session(rowcount=2)

        with patch(_DB_PATCH, return_value=mock_session):
            from app.shared.tasks.qr_tasks import rotate_action_point_qrs
            result = rotate_action_point_qrs()

        assert result["rotated_count"] == 2

    def test_daily_report(self):
        """generate_qr_daily_report aggregates scan data."""
        mock_row = MagicMock()
        mock_row.college_id = "college-1"
        mock_row.action_type = "mess_entry"
        mock_row.validation_result = "success"
        mock_row.scan_count = 42
        mock_session = _make_mock_session(rows=[mock_row])

        with patch(_DB_PATCH, return_value=mock_session):
            from app.shared.tasks.qr_tasks import generate_qr_daily_report
            result = generate_qr_daily_report()

        assert result["aggregation_count"] == 1


class TestRoleTasks:
    def test_check_expiring_roles(self):
        """check_expiring_roles finds upcoming expirations."""
        mock_row = MagicMock()
        mock_row.id = "role-1"
        mock_row.user_id = "user-1"
        mock_row.user_name = "Dr. Test"
        mock_row.role_type = "committee_chair"
        mock_row.context_name = "Anti-Ragging"
        mock_row.valid_until = date.today() + timedelta(days=5)
        mock_row.college_id = "college-1"
        mock_session = _make_mock_session(rows=[mock_row])

        with patch(_DB_PATCH, return_value=mock_session):
            from app.shared.tasks.role_tasks import check_expiring_roles
            result = check_expiring_roles()

        assert result["expiring_count"] == 1

    def test_auto_deactivate_expired(self):
        """auto_deactivate_expired_roles deactivates old roles."""
        mock_session = _make_mock_session(rowcount=4)

        with patch(_DB_PATCH, return_value=mock_session):
            from app.shared.tasks.role_tasks import auto_deactivate_expired_roles
            result = auto_deactivate_expired_roles()

        assert result["deactivated_count"] == 4


class TestBeatScheduleRegistration:
    def test_all_aqp_tasks_in_beat_schedule(self):
        """All AQP tasks are registered in the Celery beat schedule."""
        from app.core.celery_app import CELERY_BEAT_SCHEDULE

        expected_tasks = [
            "check-expired-device-tokens",
            "flag-suspicious-resets",
            "cleanup-transfer-requests",
            "rotate-qr-codes",
            "qr-daily-report",
            "check-expiring-roles",
            "auto-deactivate-expired-roles",
        ]
        for task_name in expected_tasks:
            assert task_name in CELERY_BEAT_SCHEDULE, f"Missing: {task_name}"
