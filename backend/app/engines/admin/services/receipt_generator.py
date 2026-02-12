"""Receipt Generator Service — fee receipt data preparation.

Generates receipt data for fee payments. Actual PDF rendering
is handled by the route layer (or a dedicated PDF microservice).
"""

import logging
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.admin.models import College, FeePayment, FeeStructure, Student
from app.engines.admin.utils.indian_currency import format_inr
from app.engines.admin.utils.validators import generate_receipt_number
from app.shared.exceptions import NotFoundException, ValidationException

logger = logging.getLogger(__name__)


class ReceiptGeneratorService:
    """Fee receipt generation."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_receipt(
        self,
        payment_id: UUID,
    ) -> dict:
        """Generate fee receipt data for a payment.

        Creates a receipt number if not already assigned, and returns
        all data needed for PDF rendering.
        """
        # Get payment
        result = await self.db.execute(
            select(FeePayment).where(FeePayment.id == payment_id)
        )
        payment = result.scalar_one_or_none()
        if payment is None:
            raise NotFoundException("FeePayment", str(payment_id))

        if payment.status not in ("captured", "settled"):
            raise ValidationException(
                f"Cannot generate receipt for payment with status: {payment.status}"
            )

        # Assign receipt number if not already present
        if not payment.receipt_number:
            payment.receipt_number = generate_receipt_number("RCP")
            await self.db.flush()

        # Get student
        student_result = await self.db.execute(
            select(Student).where(Student.id == payment.student_id)
        )
        student = student_result.scalar_one_or_none()
        if student is None:
            raise NotFoundException("Student", str(payment.student_id))

        # Get college
        college_result = await self.db.execute(
            select(College).where(College.id == payment.college_id)
        )
        college = college_result.scalar_one_or_none()

        # Get fee structure for component names
        fee_structure = None
        if payment.fee_structure_id:
            fs_result = await self.db.execute(
                select(FeeStructure).where(FeeStructure.id == payment.fee_structure_id)
            )
            fee_structure = fs_result.scalar_one_or_none()

        # Build fee breakdown for display
        breakdown_items = []
        if payment.fee_breakdown:
            for component, amount in payment.fee_breakdown.items():
                breakdown_items.append({
                    "component": component.replace("_", " ").title(),
                    "amount": amount,
                    "amount_display": format_inr(amount),
                })
        else:
            breakdown_items.append({
                "component": payment.fee_component or "Fee Payment",
                "amount": payment.amount,
                "amount_display": format_inr(payment.amount),
            })

        # Late fee as separate line item
        if payment.late_fee_amount and payment.late_fee_amount > 0:
            breakdown_items.append({
                "component": f"Late Fee ({payment.late_fee_days} days)",
                "amount": payment.late_fee_amount,
                "amount_display": format_inr(payment.late_fee_amount),
            })

        total_amount = payment.amount + (payment.late_fee_amount or 0)

        # Number to words (for receipt)
        amount_in_words = self._amount_to_words(total_amount)

        return {
            "receipt_number": payment.receipt_number,
            "payment_id": str(payment.id),
            "payment_date": payment.payment_date.isoformat() if payment.payment_date else date.today().isoformat(),
            "payment_method": payment.payment_method,
            "reference_number": payment.reference_number or payment.razorpay_payment_id,
            # College info
            "college_name": college.name if college else "",
            "college_address": college.address if college else "",
            "college_phone": college.phone if college else "",
            "college_email": college.email if college else "",
            "college_logo_url": college.logo_url if college else "",
            # Student info
            "student_name": student.name,
            "enrollment_number": student.enrollment_number,
            "admission_year": student.admission_year,
            "admission_quota": student.admission_quota,
            "current_phase": student.current_phase,
            "father_name": student.father_name,
            # Fee details
            "academic_year": payment.academic_year,
            "semester": payment.semester,
            "installment_number": payment.installment_number,
            "quota": fee_structure.quota if fee_structure else student.admission_quota,
            # Breakdown
            "breakdown": breakdown_items,
            "subtotal": payment.amount,
            "subtotal_display": format_inr(payment.amount),
            "late_fee": payment.late_fee_amount or 0,
            "late_fee_display": format_inr(payment.late_fee_amount or 0),
            "total_amount": total_amount,
            "total_amount_display": format_inr(total_amount),
            "amount_in_words": amount_in_words,
            # Notes
            "notes": payment.notes,
        }

    @staticmethod
    def _amount_to_words(paisa: int) -> str:
        """Convert amount in paisa to Indian English words.

        Example: 1_42_35_600_00 → "One Crore Forty-Two Lakh Thirty-Five Thousand Six Hundred Rupees Only"
        """
        rupees = paisa // 100
        paise = paisa % 100

        if rupees == 0 and paise == 0:
            return "Zero Rupees Only"

        ones = [
            "", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
            "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
            "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
        ]
        tens = [
            "", "", "Twenty", "Thirty", "Forty", "Fifty",
            "Sixty", "Seventy", "Eighty", "Ninety",
        ]

        def two_digits(n: int) -> str:
            if n < 20:
                return ones[n]
            return f"{tens[n // 10]} {ones[n % 10]}".strip()

        def three_digits(n: int) -> str:
            if n >= 100:
                return f"{ones[n // 100]} Hundred {two_digits(n % 100)}".strip()
            return two_digits(n)

        # Indian number system: ones, tens, hundreds, thousands, lakhs, crores
        parts = []
        if rupees >= 10_000_000:
            crores = rupees // 10_000_000
            parts.append(f"{three_digits(crores)} Crore")
            rupees %= 10_000_000

        if rupees >= 100_000:
            lakhs = rupees // 100_000
            parts.append(f"{two_digits(lakhs)} Lakh")
            rupees %= 100_000

        if rupees >= 1_000:
            thousands = rupees // 1_000
            parts.append(f"{two_digits(thousands)} Thousand")
            rupees %= 1_000

        if rupees > 0:
            parts.append(three_digits(rupees))

        result = " ".join(parts) + " Rupees"

        if paise > 0:
            result += f" and {two_digits(paise)} Paise"

        result += " Only"
        return result
