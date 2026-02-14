"""Public API routes — unauthenticated endpoints.

Endpoints:
- GET /api/v1/public/verify/{certificate_number} — Certificate verification via QR
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["Public"])


# ---------------------------------------------------------------------------
# 1. GET /verify/{certificate_number} — Certificate verification
# ---------------------------------------------------------------------------

@router.get("/verify/{certificate_number}")
async def verify_certificate(
    certificate_number: str,
    db: AsyncSession = Depends(get_db),
):
    """Verify a certificate by its number (scanned from QR on printed certificate).

    This is a public endpoint — no authentication required.
    Returns certificate validity and basic details.
    """
    try:
        from app.engines.admin.models import Certificate
    except ImportError:
        # Certificate model may not exist yet
        return {
            "valid": False,
            "message": "Certificate verification not yet available",
        }

    result = await db.execute(
        select(Certificate).where(Certificate.certificate_number == certificate_number)
    )
    cert = result.scalar_one_or_none()

    if not cert:
        return {
            "valid": False,
            "message": "Certificate not found",
        }

    return {
        "valid": True,
        "certificate_number": cert.certificate_number,
        "certificate_type": getattr(cert, "certificate_type", "unknown"),
        "student_name": getattr(cert, "student_name", ""),
        "college_name": getattr(cert, "college_name", ""),
        "issue_date": str(getattr(cert, "issue_date", "")),
        "status": getattr(cert, "status", "issued"),
    }
