"""SMS Gateway abstraction — factory for provider selection.

Uses SMS_GATEWAY_PROVIDER setting to select the appropriate implementation.
"""

from __future__ import annotations

from app.config import get_settings

from .base import IncomingSMS, SMSGateway


def get_sms_gateway() -> SMSGateway:
    """Return the configured SMS gateway implementation."""
    settings = get_settings()
    provider = settings.SMS_GATEWAY_PROVIDER.lower()
    if provider == "msg91":
        from .msg91 import MSG91Gateway
        return MSG91Gateway()
    elif provider == "kaleyra":
        from .kaleyra import KaleyraGateway
        return KaleyraGateway()
    else:
        from .mock import MockSMSGateway
        return MockSMSGateway()


__all__ = ["get_sms_gateway", "SMSGateway", "IncomingSMS"]
