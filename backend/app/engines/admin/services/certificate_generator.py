"""Certificate Generator Service — PDF generation with QR verification.

Generates certificates (bonafide, migration, transfer, etc.) with
QR codes for public verification. Actual PDF rendering uses a
template approach — the service produces data, route handles PDF output.
"""

import logging
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.admin.models import Certificate, College, Department, Student
from app.engines.admin.utils.validators import generate_certificate_number
from app.shared.exceptions import NotFoundException, ValidationException

logger = logging.getLogger(__name__)

# Certificate types and their required fields
CERTIFICATE_TYPES = {
    "bonafide": {
        "title": "Bonafide Certificate",
        "requires_purpose": True,
        "signatory": "Principal",
    },
    "migration": {
        "title": "Migration Certificate",
        "requires_purpose": False,
        "signatory": "Principal",
    },
    "transfer": {
        "title": "Transfer Certificate",
        "requires_purpose": False,
        "signatory": "Principal",
    },
    "character": {
        "title": "Character Certificate",
        "requires_purpose": False,
        "signatory": "Principal",
    },
    "noc": {
        "title": "No Objection Certificate",
        "requires_purpose": True,
        "signatory": "Dean",
    },
    "fee_paid": {
        "title": "Fee Paid Certificate",
        "requires_purpose": False,
        "signatory": "Accounts Officer",
    },
    "course_completion": {
        "title": "Course Completion Certificate",
        "requires_purpose": False,
        "signatory": "Dean",
    },
    "custom": {
        "title": "Certificate",
        "requires_purpose": True,
        "signatory": "Principal",
    },
}

# Base URL for QR verification — configured in college settings
DEFAULT_VERIFICATION_BASE_URL = "https://verify.acolyte.ai/cert"


class CertificateGeneratorService:
    """Certificate generation and verification."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_certificate(
        self,
        student_id: UUID,
        certificate_type: str,
        purpose: str | None = None,
        purpose_detail: str | None = None,
        generated_by: UUID | None = None,
        custom_fields: dict | None = None,
    ) -> dict:
        """Generate a certificate for a student.

        Creates the Certificate record and returns data needed
        for PDF rendering. Actual PDF generation is handled separately.

        Returns dict with all certificate data for template rendering.
        """
        if certificate_type not in CERTIFICATE_TYPES:
            raise ValidationException(
                f"Invalid certificate type: {certificate_type}. "
                f"Valid types: {', '.join(CERTIFICATE_TYPES.keys())}"
            )

        cert_config = CERTIFICATE_TYPES[certificate_type]

        if cert_config["requires_purpose"] and not purpose:
            raise ValidationException(
                f"Certificate type '{certificate_type}' requires a purpose"
            )

        # Get student details
        result = await self.db.execute(
            select(Student).where(Student.id == student_id)
        )
        student = result.scalar_one_or_none()
        if student is None:
            raise NotFoundException("Student", str(student_id))

        if student.status in ("dropped", "rusticated"):
            raise ValidationException(
                f"Cannot generate certificate for student with status: {student.status}"
            )

        # Get college details
        college_result = await self.db.execute(
            select(College).where(College.id == student.college_id)
        )
        college = college_result.scalar_one_or_none()

        # Generate unique certificate number
        prefix_map = {
            "bonafide": "BFC",
            "migration": "MIG",
            "transfer": "TC",
            "character": "CC",
            "noc": "NOC",
            "fee_paid": "FPC",
            "course_completion": "CCC",
            "custom": "CRT",
        }
        prefix = prefix_map.get(certificate_type, "CRT")
        certificate_number = generate_certificate_number(prefix)

        # Build verification URL
        verification_url = f"{DEFAULT_VERIFICATION_BASE_URL}/{certificate_number}"
        qr_data = verification_url

        # Create certificate record
        certificate = Certificate(
            college_id=student.college_id,
            student_id=student_id,
            certificate_type=certificate_type,
            certificate_number=certificate_number,
            purpose=purpose,
            purpose_detail=purpose_detail,
            qr_code_data=qr_data,
            qr_verification_url=verification_url,
            status="generated",
            issued_date=date.today(),
            generated_by=generated_by,
            custom_fields=custom_fields,
            signed_by=cert_config["signatory"],
        )
        self.db.add(certificate)
        await self.db.flush()
        await self.db.refresh(certificate)

        # Build render data for PDF template
        render_data = {
            "certificate_id": str(certificate.id),
            "certificate_number": certificate_number,
            "certificate_type": certificate_type,
            "certificate_title": cert_config["title"],
            "verification_url": verification_url,
            "qr_data": qr_data,
            "issued_date": date.today().isoformat(),
            "signatory": cert_config["signatory"],
            # College info
            "college_name": college.name if college else "",
            "college_address": college.address if college else "",
            "college_phone": college.phone if college else "",
            "college_email": college.email if college else "",
            "college_logo_url": college.logo_url if college else "",
            "university_affiliation": college.university_affiliation if college else "",
            # Student info
            "student_name": student.name,
            "enrollment_number": student.enrollment_number,
            "admission_year": student.admission_year,
            "current_phase": student.current_phase,
            "father_name": student.father_name,
            "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else None,
            # Purpose
            "purpose": purpose,
            "purpose_detail": purpose_detail,
            "custom_fields": custom_fields,
        }

        return render_data

    async def verify_certificate(
        self,
        certificate_number: str,
    ) -> dict:
        """Public verification endpoint — check if certificate is valid.

        No authentication required — this is a public verification service.
        Returns limited info for privacy.
        """
        result = await self.db.execute(
            select(Certificate).where(
                Certificate.certificate_number == certificate_number,
            )
        )
        certificate = result.scalar_one_or_none()

        if certificate is None:
            return {
                "valid": False,
                "certificate_number": certificate_number,
                "message": "Certificate not found",
            }

        if certificate.status == "revoked":
            return {
                "valid": False,
                "certificate_number": certificate_number,
                "status": "revoked",
                "revoked_date": certificate.revoked_date.isoformat() if certificate.revoked_date else None,
                "message": "This certificate has been revoked",
            }

        # Get student name (limited info)
        student_result = await self.db.execute(
            select(Student.name, Student.enrollment_number).where(
                Student.id == certificate.student_id,
            )
        )
        student_row = student_result.one_or_none()

        # Get college name
        college_result = await self.db.execute(
            select(College.name).where(
                College.id == certificate.college_id,
            )
        )
        college_name = college_result.scalar_one_or_none()

        return {
            "valid": True,
            "certificate_number": certificate_number,
            "certificate_type": certificate.certificate_type,
            "status": certificate.status,
            "issued_date": certificate.issued_date.isoformat() if certificate.issued_date else None,
            "student_name": student_row.name if student_row else None,
            "enrollment_number": student_row.enrollment_number if student_row else None,
            "college_name": college_name,
            "signed_by": certificate.signed_by,
        }

    async def revoke_certificate(
        self,
        certificate_id: UUID,
        reason: str,
        revoked_by: UUID | None = None,
    ) -> dict:
        """Revoke an issued certificate.

        Marks the certificate as revoked with reason and date.
        """
        result = await self.db.execute(
            select(Certificate).where(Certificate.id == certificate_id)
        )
        certificate = result.scalar_one_or_none()
        if certificate is None:
            raise NotFoundException("Certificate", str(certificate_id))

        if certificate.status == "revoked":
            raise ValidationException("Certificate is already revoked")

        certificate.status = "revoked"
        certificate.revoked_date = date.today()
        certificate.revocation_reason = reason
        await self.db.flush()

        return {
            "certificate_id": str(certificate_id),
            "certificate_number": certificate.certificate_number,
            "status": "revoked",
            "revoked_date": date.today().isoformat(),
            "reason": reason,
        }
