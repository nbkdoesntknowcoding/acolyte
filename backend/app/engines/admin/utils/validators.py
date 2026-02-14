"""Indian-context validators and generators for the Admin Engine."""

import hashlib
import re
import uuid
from datetime import datetime, timezone


def validate_indian_phone(phone: str) -> bool:
    """Validate Indian mobile number (10 digits starting with 6-9)."""
    return bool(re.match(r"^[6-9]\d{9}$", phone))


def validate_neet_score(score: int) -> bool:
    """Validate NEET score (0-720)."""
    return 0 <= score <= 720


def hash_aadhaar(aadhaar_number: str) -> str:
    """Hash Aadhaar number using SHA-256. NEVER store raw Aadhaar."""
    cleaned = aadhaar_number.replace(" ", "").replace("-", "")
    if not re.match(r"^\d{12}$", cleaned):
        raise ValueError("Invalid Aadhaar number format")
    return hashlib.sha256(cleaned.encode()).hexdigest()


def generate_receipt_number(prefix: str = "RCP") -> str:
    """Generate unique receipt number: RCP-YYYYMMDD-XXXXXX."""
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y%m%d")
    unique_part = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_part}-{unique_part}"


def generate_certificate_number(prefix: str = "CERT") -> str:
    """Generate unique certificate number: CERT-YYYYMMDD-XXXXXX."""
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y%m%d")
    unique_part = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_part}-{unique_part}"


def generate_ticket_number(prefix: str = "TKT") -> str:
    """Generate unique ticket number: TKT-YYYYMMDD-XXXXXX."""
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y%m%d")
    unique_part = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{date_part}-{unique_part}"


def validate_pin_code(pin_code: str) -> bool:
    """Validate Indian PIN code (6 digits, first digit 1-9)."""
    return bool(re.match(r"^[1-9]\d{5}$", pin_code))


def validate_ifsc(ifsc: str) -> bool:
    """Validate IFSC code (4 alpha + 0 + 6 alphanumeric)."""
    return bool(re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", ifsc.upper()))
