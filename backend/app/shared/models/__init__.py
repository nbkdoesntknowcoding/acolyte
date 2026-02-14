"""Shared models package.

Re-exports Base, TenantModel, AuditLog so that existing imports
like `from app.shared.models import Base, TenantModel` continue to work.
"""

from .base import AuditLog, Base, TenantModel
from .committee import CommitteeActionItem, CommitteeMeeting
from .device_trust import DeviceResetLog, DeviceTrust, DeviceTransferRequest
from .dynamic_roles import DynamicRoleAssignment
from .qr import QRActionPoint, QRScanLog

__all__ = [
    "Base",
    "TenantModel",
    "AuditLog",
    "CommitteeActionItem",
    "CommitteeMeeting",
    "DeviceTrust",
    "DeviceTransferRequest",
    "DeviceResetLog",
    "DynamicRoleAssignment",
    "QRActionPoint",
    "QRScanLog",
]
