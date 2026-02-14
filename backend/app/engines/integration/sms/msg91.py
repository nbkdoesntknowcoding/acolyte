"""MSG91 SMS gateway implementation.

Setup required:
1. MSG91 account with transactional route
2. DLT registration for templates (mandatory in India)
3. Virtual mobile number (VMN) for incoming SMS
4. Incoming SMS webhook configured to POST to our endpoint
"""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

from .base import IncomingSMS, SMSGateway

logger = logging.getLogger(__name__)


def _normalize_indian_phone(sender: str) -> str:
    """Normalize an Indian phone number to +91XXXXXXXXXX format."""
    sender = sender.strip()
    if sender.startswith("+91") and len(sender) == 13:
        return sender
    if sender.startswith("91") and len(sender) == 12:
        return f"+{sender}"
    if len(sender) == 10 and sender[0] in "6789":
        return f"+91{sender}"
    # Fallback: take last 10 digits
    digits = "".join(c for c in sender if c.isdigit())
    if len(digits) >= 10:
        return f"+91{digits[-10:]}"
    return sender


class MSG91Gateway(SMSGateway):
    """MSG91 SMS gateway for production use in India."""

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.MSG91_API_KEY
        self.sender_id = settings.MSG91_SENDER_ID
        self.vmn = settings.MSG91_VIRTUAL_NUMBER
        self.dlt_template_id = settings.MSG91_DLT_TEMPLATE_ID

    async def send_otp(self, phone: str, otp: str, template_id: str) -> str:
        """Send OTP via MSG91 Flow API."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.msg91.com/api/v5/flow/",
                headers={"authkey": self.api_key},
                json={
                    "template_id": template_id or self.dlt_template_id,
                    "short_url": "0",
                    "recipients": [{"mobiles": phone, "otp": otp}],
                },
            )
            data = response.json()
            msg_id = data.get("request_id", "")
            logger.info("MSG91 OTP sent to %s, request_id=%s", phone[:6] + "****", msg_id)
            return msg_id

    def get_virtual_number(self) -> str:
        return self.vmn

    def parse_incoming_webhook(self, payload: dict) -> IncomingSMS:
        """Parse MSG91 incoming SMS webhook format."""
        sender = _normalize_indian_phone(payload.get("sender", ""))
        return IncomingSMS(
            sender=sender,
            message=payload.get("message", "").strip(),
            received_at=payload.get("received_at", ""),
            gateway_message_id=payload.get("msgId", ""),
        )
