"""Tests for Dynamic Role Assignment service."""

import os
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

os.environ.setdefault("DEVICE_TRUST_SECRET", "test-device-trust-secret-key-32chars!")
os.environ.setdefault("QR_TOKEN_SECRET", "test-qr-token-secret-key-32chars-ok!")
os.environ.setdefault("QR_ACTION_POINT_SECRET", "test-action-point-hmac-secret-key!")

from app.shared.services.dynamic_role_service import DynamicRoleService


def _make_mock_db():
    """Create a mock async DB session."""
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    db.execute.return_value = mock_result
    db.flush = AsyncMock()

    def _add_with_id(obj):
        if hasattr(obj, "id") and obj.id is None:
            obj.id = uuid4()

    db.add = MagicMock(side_effect=_add_with_id)
    return db


def _make_mock_role(
    user_id=None, role_type="committee_member", context_type="committee",
    context_id=None, is_active=True, valid_until=None,
):
    role = MagicMock()
    role.id = uuid4()
    role.college_id = uuid4()
    role.user_id = user_id or uuid4()
    role.user_type = "faculty"
    role.user_name = "Dr. Test"
    role.role_type = role_type
    role.context_type = context_type
    role.context_id = context_id or uuid4()
    role.context_name = "Test Committee"
    role.valid_from = date.today()
    role.valid_until = valid_until
    role.is_active = is_active
    role.auto_deactivate = True
    role.assigned_by = uuid4()
    role.assigned_by_name = "Admin"
    role.assignment_order_url = None
    role.notes = None
    role.permissions = ["committee.view"]
    role.created_at = datetime.now(timezone.utc)
    return role


class TestGetUserRoles:
    @pytest.mark.asyncio
    async def test_returns_active_roles_only(self):
        """get_user_roles returns only active, non-expired assignments."""
        db = _make_mock_db()
        active_role = _make_mock_role(is_active=True)
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [active_role]
        db.execute.return_value = mock_result

        service = DynamicRoleService(db)
        roles = await service.get_user_roles(active_role.user_id, active_role.college_id)

        assert len(roles) == 1
        assert roles[0].is_active is True

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_roles(self):
        """get_user_roles returns empty list when no active roles."""
        db = _make_mock_db()
        service = DynamicRoleService(db)
        roles = await service.get_user_roles(uuid4(), uuid4())
        assert roles == []


class TestAssignRole:
    @pytest.mark.asyncio
    async def test_creates_new_assignment(self):
        """assign_role creates a new assignment with derived permissions."""
        db = _make_mock_db()
        service = DynamicRoleService(db)

        college_id = uuid4()
        user_id = uuid4()
        context_id = uuid4()

        with patch("app.shared.services.dynamic_role_service.publish_event", new_callable=AsyncMock):
            result = await service.assign_role(
                college_id=college_id,
                user_id=user_id,
                user_type="faculty",
                user_name="Dr. Test",
                role_type="committee_chair",
                context_type="committee",
                context_id=context_id,
                context_name="Anti-Ragging Committee",
                valid_from=date.today(),
                valid_until=None,
                auto_deactivate=True,
                assigned_by=uuid4(),
            )

        db.add.assert_called_once()
        # Verify the object passed to db.add has correct fields
        added = db.add.call_args[0][0]
        assert added.role_type == "committee_chair"
        assert added.is_active is True
        assert "committee.manage" in added.permissions

    @pytest.mark.asyncio
    async def test_prevents_duplicate_active_assignment(self):
        """assign_role raises 409 for duplicate active assignment."""
        db = _make_mock_db()
        existing = _make_mock_role()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute.return_value = mock_result

        service = DynamicRoleService(db)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.assign_role(
                college_id=existing.college_id,
                user_id=existing.user_id,
                user_type="faculty",
                user_name="Dr. Test",
                role_type=existing.role_type,
                context_type="committee",
                context_id=existing.context_id,
                context_name="Test",
                valid_from=date.today(),
                valid_until=None,
                auto_deactivate=True,
                assigned_by=uuid4(),
            )
        assert exc_info.value.status_code == 409


class TestRevokeRole:
    @pytest.mark.asyncio
    async def test_sets_inactive(self):
        """revoke_role sets is_active=False on the assignment."""
        db = _make_mock_db()
        role = _make_mock_role(is_active=True)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = role
        db.execute.return_value = mock_result

        service = DynamicRoleService(db)
        with patch("app.shared.services.dynamic_role_service.publish_event", new_callable=AsyncMock):
            await service.revoke_role(role.id, uuid4(), "test reason")

        assert role.is_active is False

    @pytest.mark.asyncio
    async def test_not_found_raises_404(self):
        """revoke_role raises 404 for non-existent assignment."""
        db = _make_mock_db()
        service = DynamicRoleService(db)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.revoke_role(uuid4(), uuid4(), "test")
        assert exc_info.value.status_code == 404


class TestCommitteeAccess:
    @pytest.mark.asyncio
    async def test_non_member_blocked(self):
        """Non-member gets 403 when trying to access committee meetings."""
        db = _make_mock_db()
        service = DynamicRoleService(db)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.get_committee_meetings(uuid4(), uuid4(), uuid4())
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_member_can_view_meetings(self):
        """Committee member can view meetings."""
        db = _make_mock_db()
        role = _make_mock_role(role_type="committee_member")

        # First call: verify membership, second: get meetings
        result_role = MagicMock()
        result_role.scalar_one_or_none.return_value = role
        result_meetings = MagicMock()
        result_meetings.scalars.return_value.all.return_value = []
        db.execute.side_effect = [result_role, result_meetings]

        service = DynamicRoleService(db)
        meetings = await service.get_committee_meetings(
            role.context_id, role.user_id, role.college_id,
        )
        assert meetings == []

    @pytest.mark.asyncio
    async def test_chair_can_schedule_meeting(self):
        """Committee chair can schedule a meeting."""
        db = _make_mock_db()
        role = _make_mock_role(role_type="committee_chair")

        result_role = MagicMock()
        result_role.scalar_one_or_none.return_value = role
        db.execute.return_value = result_role

        service = DynamicRoleService(db)
        meeting = await service.create_committee_meeting(
            committee_id=role.context_id,
            user_id=role.user_id,
            college_id=role.college_id,
            title="Monthly Review",
            meeting_date=datetime.now(timezone.utc),
        )
        db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_member_cannot_schedule_meeting(self):
        """Regular member gets 403 when trying to schedule a meeting."""
        db = _make_mock_db()
        role = _make_mock_role(role_type="committee_member")

        result_role = MagicMock()
        result_role.scalar_one_or_none.return_value = role
        db.execute.return_value = result_role

        service = DynamicRoleService(db)

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await service.create_committee_meeting(
                committee_id=role.context_id,
                user_id=role.user_id,
                college_id=role.college_id,
                title="Unauthorized Meeting",
                meeting_date=datetime.now(timezone.utc),
            )
        assert exc_info.value.status_code == 403


class TestGetExpiringRoles:
    @pytest.mark.asyncio
    async def test_returns_expiring_roles(self):
        """get_expiring_roles returns roles expiring within window."""
        db = _make_mock_db()
        expiring = _make_mock_role(valid_until=date.today() + timedelta(days=15))
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [expiring]
        db.execute.return_value = mock_result

        service = DynamicRoleService(db)
        roles = await service.get_expiring_roles(expiring.college_id, days=30)
        assert len(roles) == 1
