"""Mock SMS gateway for development and testing."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from .base import IncomingSMS, SMSGateway

logger = logging.getLogger(__name__)


class MockSMSGateway(SMSGateway):
    """Mock gateway that logs to console and stores OTPs in memory.

    Used for development and testing. No actual SMS is sent.
    """

    # In-memory store: phone -> latest OTP
    pending_verifications: dict[str, str] = {}

    async def send_otp(self, phone: str, otp: str, template_id: str) -> str:
        """Store OTP in memory and log to console."""
        MockSMSGateway.pending_verifications[phone] = otp
        logger.info(
            "[MOCK SMS] OTP %s sent to %s (template: %s)", otp, phone, template_id
        )
        return "mock_msg_id"

    def get_virtual_number(self) -> str:
        return "+919999999999"

    def parse_incoming_webhook(self, payload: dict) -> IncomingSMS:
        """Parse payload as-is with phone normalization."""
        sender = payload.get("sender", "")
        # Normalize
        if not sender.startswith("+"):
            if sender.startswith("91") and len(sender) == 12:
                sender = f"+{sender}"
            elif len(sender) == 10:
                sender = f"+91{sender}"
        return IncomingSMS(
            sender=sender,
            message=payload.get("message", "").strip(),
            received_at=payload.get(
                "received_at", datetime.now(timezone.utc).isoformat()
            ),
            gateway_message_id=payload.get("gateway_message_id", "mock_incoming"),
        )

    @classmethod
    def simulate_incoming_sms(cls, sender: str, code: str) -> IncomingSMS:
        """Create a properly formatted IncomingSMS for testing."""
        if not sender.startswith("+"):
            sender = f"+91{sender}" if len(sender) == 10 else sender
        return IncomingSMS(
            sender=sender,
            message=f"ACOLYTE VERIFY {code}",
            received_at=datetime.now(timezone.utc).isoformat(),
            gateway_message_id="mock_sim_msg_id",
        )
