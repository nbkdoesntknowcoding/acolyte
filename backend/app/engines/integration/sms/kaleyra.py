"""Kaleyra (formerly Solutions Infini) SMS gateway — fallback provider."""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

from .base import IncomingSMS, SMSGateway
from .msg91 import _normalize_indian_phone

logger = logging.getLogger(__name__)


class KaleyraGateway(SMSGateway):
    """Kaleyra SMS gateway as fallback to MSG91."""

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.KALEYRA_API_KEY
        self.sid = settings.KALEYRA_SID

    async def send_otp(self, phone: str, otp: str, template_id: str) -> str:
        """Send OTP via Kaleyra API."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"https://api.kaleyra.io/v1/{self.sid}/messages",
                headers={"api-key": self.api_key},
                json={
                    "to": phone,
                    "type": "OTP",
                    "sender": "ACOLYT",
                    "body": f"Your Acolyte verification code is {otp}",
                    "template_id": template_id,
                },
            )
            data = response.json()
            msg_id = data.get("id", "")
            logger.info("Kaleyra OTP sent to %s, id=%s", phone[:6] + "****", msg_id)
            return msg_id

    def get_virtual_number(self) -> str:
        return ""  # Kaleyra VMN configured separately

    def parse_incoming_webhook(self, payload: dict) -> IncomingSMS:
        """Parse Kaleyra incoming SMS webhook format."""
        sender = _normalize_indian_phone(payload.get("from", payload.get("sender", "")))
        return IncomingSMS(
            sender=sender,
            message=payload.get("body", payload.get("message", "")).strip(),
            received_at=payload.get("received_at", ""),
            gateway_message_id=payload.get("id", ""),
        )
