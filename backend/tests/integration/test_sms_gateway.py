"""Tests for SMS gateway abstraction."""

import os
import pytest

os.environ.setdefault("SMS_GATEWAY_PROVIDER", "mock")

from app.engines.integration.sms import get_sms_gateway
from app.engines.integration.sms.mock import MockSMSGateway
from app.engines.integration.sms.msg91 import _normalize_indian_phone


class TestMockGateway:
    @pytest.mark.asyncio
    async def test_send_otp_stores_in_memory(self):
        """Mock gateway stores OTP in pending_verifications dict."""
        gw = MockSMSGateway()
        MockSMSGateway.pending_verifications.clear()
        msg_id = await gw.send_otp("+919876543210", "123456", "template_1")
        assert msg_id == "mock_msg_id"
        assert MockSMSGateway.pending_verifications["+919876543210"] == "123456"

    def test_get_virtual_number(self):
        """Mock gateway returns test virtual number."""
        gw = MockSMSGateway()
        assert gw.get_virtual_number() == "+919999999999"

    def test_simulate_incoming_sms(self):
        """simulate_incoming_sms creates properly formatted IncomingSMS."""
        sms = MockSMSGateway.simulate_incoming_sms("9876543210", "847293")
        assert sms.sender == "+919876543210"
        assert sms.message == "ACOLYTE VERIFY 847293"
        assert sms.gateway_message_id == "mock_sim_msg_id"

    def test_parse_incoming_webhook(self):
        """Mock gateway parses webhook payload."""
        gw = MockSMSGateway()
        payload = {
            "sender": "9876543210",
            "message": "ACOLYTE VERIFY 123456",
        }
        sms = gw.parse_incoming_webhook(payload)
        assert sms.sender == "+919876543210"
        assert sms.message == "ACOLYTE VERIFY 123456"


class TestPhoneNormalization:
    def test_10_digit(self):
        """10-digit number gets +91 prefix."""
        assert _normalize_indian_phone("9876543210") == "+919876543210"

    def test_12_digit_with_91(self):
        """12-digit with 91 prefix gets + prepended."""
        assert _normalize_indian_phone("919876543210") == "+919876543210"

    def test_already_normalized(self):
        """Already +91 prefixed number passes through."""
        assert _normalize_indian_phone("+919876543210") == "+919876543210"

    def test_with_spaces(self):
        """Handles leading/trailing spaces."""
        assert _normalize_indian_phone("  9876543210  ") == "+919876543210"


class TestFactory:
    def test_returns_mock_for_test_env(self):
        """Factory returns MockSMSGateway when provider is 'mock'."""
        gw = get_sms_gateway()
        assert isinstance(gw, MockSMSGateway)
