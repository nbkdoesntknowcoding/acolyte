"""Abstract SMS gateway interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class IncomingSMS:
    """Normalized incoming SMS from any gateway."""

    sender: str  # +91XXXXXXXXXX
    message: str
    received_at: str
    gateway_message_id: str


class SMSGateway(ABC):
    """Abstract SMS gateway. Supports sending OTPs and receiving incoming SMS."""

    @abstractmethod
    async def send_otp(self, phone: str, otp: str, template_id: str) -> str:
        """Send an OTP SMS. Returns gateway message ID."""

    @abstractmethod
    def get_virtual_number(self) -> str:
        """Get the virtual number that receives incoming SMS."""

    @abstractmethod
    def parse_incoming_webhook(self, payload: dict) -> IncomingSMS:
        """Parse the incoming SMS webhook payload from this gateway."""
