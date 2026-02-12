"""Fee Calculator Service — fee computation, installment schedules, late fees.

All monetary values in paisa (1 rupee = 100 paisa).
"""

import logging
import math
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.admin.models import FeePayment, FeeStructure, Student
from app.shared.exceptions import NotFoundException, ValidationException

logger = logging.getLogger(__name__)


class FeeCalculatorService:
    """Fee calculation and analysis."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def calculate_total_fee(
        self,
        student_id: UUID,
        academic_year: str,
    ) -> dict:
        """Calculate total fee for a student based on their quota and academic year.

        Returns dict with component breakdown and total.
        """
        # Get student to determine quota
        result = await self.db.execute(
            select(Student).where(Student.id == student_id)
        )
        student = result.scalar_one_or_none()
        if student is None:
            raise NotFoundException("Student", str(student_id))

        quota = student.admission_quota or "State"

        # Get fee structure for this quota + year
        result = await self.db.execute(
            select(FeeStructure).where(
                FeeStructure.academic_year == academic_year,
                FeeStructure.quota == quota,
                FeeStructure.is_active.is_(True),
            )
        )
        fee_structure = result.scalar_one_or_none()
        if fee_structure is None:
            raise NotFoundException(
                "FeeStructure",
                f"academic_year={academic_year}, quota={quota}",
            )

        # Determine hostel fee based on gender
        hostel_fee = 0
        if student.is_hosteler:
            if student.gender == "female":
                hostel_fee = fee_structure.hostel_fee_girls or fee_structure.hostel_fee or 0
            else:
                hostel_fee = fee_structure.hostel_fee_boys or fee_structure.hostel_fee or 0

        components = {
            "tuition_fee": fee_structure.tuition_fee or 0,
            "development_fee": fee_structure.development_fee or 0,
            "hostel_fee": hostel_fee,
            "mess_fee": fee_structure.mess_fee or 0 if student.is_hosteler else 0,
            "examination_fee": fee_structure.examination_fee or fee_structure.exam_fee or 0,
            "library_fee": fee_structure.library_fee or 0,
            "laboratory_fee": fee_structure.laboratory_fee or fee_structure.lab_fee or 0,
            "caution_deposit": fee_structure.caution_deposit or 0,
            "admission_charges": fee_structure.admission_charges or 0,
            "university_registration_fee": fee_structure.university_registration_fee or 0,
            "insurance_premium": fee_structure.insurance_premium or 0,
            "identity_card_fee": fee_structure.identity_card_fee or 0,
            "other_fees": fee_structure.other_fees or 0,
        }
        total = sum(components.values())

        return {
            "student_id": str(student_id),
            "academic_year": academic_year,
            "quota": quota,
            "fee_structure_id": str(fee_structure.id),
            "components": components,
            "total": total,
        }

    async def calculate_outstanding(self, student_id: UUID) -> dict:
        """Calculate outstanding balance for a student across all years.

        Returns total fee, total paid, outstanding, and per-year breakdown.
        """
        result = await self.db.execute(
            select(Student).where(Student.id == student_id)
        )
        student = result.scalar_one_or_none()
        if student is None:
            raise NotFoundException("Student", str(student_id))

        # Sum all successful payments for this student
        paid_result = await self.db.execute(
            select(func.coalesce(func.sum(FeePayment.amount), 0)).where(
                FeePayment.student_id == student_id,
                FeePayment.status.in_(["captured", "settled"]),
            )
        )
        total_paid = paid_result.scalar_one()

        # Get all active fee structures matching student's quota
        quota = student.admission_quota or "State"
        structures_result = await self.db.execute(
            select(FeeStructure).where(
                FeeStructure.quota == quota,
                FeeStructure.is_active.is_(True),
            )
        )
        structures = structures_result.scalars().all()

        total_fee = 0
        for fs in structures:
            hostel_fee = 0
            if student.is_hosteler:
                if student.gender == "female":
                    hostel_fee = fs.hostel_fee_girls or fs.hostel_fee or 0
                else:
                    hostel_fee = fs.hostel_fee_boys or fs.hostel_fee or 0

            year_total = sum([
                fs.tuition_fee or 0,
                fs.development_fee or 0,
                hostel_fee,
                fs.mess_fee or 0 if student.is_hosteler else 0,
                fs.examination_fee or fs.exam_fee or 0,
                fs.library_fee or 0,
                fs.laboratory_fee or fs.lab_fee or 0,
                fs.caution_deposit or 0,
                fs.admission_charges or 0,
                fs.university_registration_fee or 0,
                fs.insurance_premium or 0,
                fs.identity_card_fee or 0,
                fs.other_fees or 0,
            ])
            total_fee += year_total

        outstanding = total_fee - total_paid

        return {
            "student_id": str(student_id),
            "total_fee": total_fee,
            "total_paid": total_paid,
            "outstanding": max(0, outstanding),
            "overpaid": max(0, -outstanding) if outstanding < 0 else 0,
        }

    async def calculate_late_fee(
        self,
        student_id: UUID,
        fee_structure_id: UUID,
        installment_number: int,
        as_of_date: date | None = None,
    ) -> dict:
        """Calculate late fee for a specific installment.

        Args:
            student_id: The student.
            fee_structure_id: The fee structure to check against.
            installment_number: Which installment (1-based).
            as_of_date: Date to calculate as of (defaults to today).
        """
        if as_of_date is None:
            as_of_date = date.today()

        result = await self.db.execute(
            select(FeeStructure).where(FeeStructure.id == fee_structure_id)
        )
        fee_structure = result.scalar_one_or_none()
        if fee_structure is None:
            raise NotFoundException("FeeStructure", str(fee_structure_id))

        # Get installment config
        installment_config = fee_structure.installment_config or []
        installment = None
        for inst in installment_config:
            if inst.get("installment_no") == installment_number:
                installment = inst
                break

        if installment is None:
            raise ValidationException(
                f"Installment {installment_number} not found in fee structure"
            )

        due_date_str = installment.get("due_date")
        if not due_date_str:
            return {"late_fee": 0, "days_late": 0, "due_date": None}

        due_date = date.fromisoformat(due_date_str)
        grace_period = fee_structure.grace_period_days or 0
        effective_due = date.fromordinal(due_date.toordinal() + grace_period)

        if as_of_date <= effective_due:
            return {
                "late_fee": 0,
                "days_late": 0,
                "due_date": due_date_str,
                "grace_period_days": grace_period,
            }

        # Check if this installment has already been paid
        paid_result = await self.db.execute(
            select(FeePayment).where(
                FeePayment.student_id == student_id,
                FeePayment.fee_structure_id == fee_structure_id,
                FeePayment.installment_number == installment_number,
                FeePayment.status.in_(["captured", "settled"]),
            )
        )
        if paid_result.scalar_one_or_none() is not None:
            return {
                "late_fee": 0,
                "days_late": 0,
                "due_date": due_date_str,
                "already_paid": True,
            }

        days_late = (as_of_date - effective_due).days
        late_fee_per_day = fee_structure.late_fee_per_day or 0
        late_fee = days_late * late_fee_per_day

        return {
            "late_fee": late_fee,
            "days_late": days_late,
            "due_date": due_date_str,
            "grace_period_days": grace_period,
            "late_fee_per_day": late_fee_per_day,
        }

    async def generate_installment_schedule(
        self,
        fee_structure_id: UUID,
    ) -> list[dict]:
        """Generate installment schedule from fee structure config.

        Returns list of installments with amounts and due dates.
        """
        result = await self.db.execute(
            select(FeeStructure).where(FeeStructure.id == fee_structure_id)
        )
        fee_structure = result.scalar_one_or_none()
        if fee_structure is None:
            raise NotFoundException("FeeStructure", str(fee_structure_id))

        # Calculate total fee (excluding one-time charges for installment calc)
        recurring_total = sum([
            fee_structure.tuition_fee or 0,
            fee_structure.development_fee or 0,
            fee_structure.hostel_fee_boys or fee_structure.hostel_fee or 0,
            fee_structure.mess_fee or 0,
            fee_structure.examination_fee or fee_structure.exam_fee or 0,
            fee_structure.library_fee or 0,
            fee_structure.laboratory_fee or fee_structure.lab_fee or 0,
            fee_structure.insurance_premium or 0,
            fee_structure.other_fees or 0,
        ])

        installment_config = fee_structure.installment_config or []
        if not installment_config:
            return [{
                "installment_no": 1,
                "due_date": None,
                "percentage": 100,
                "amount": recurring_total,
            }]

        schedule = []
        for inst in installment_config:
            pct = inst.get("percentage", 0)
            amount = math.ceil(recurring_total * pct / 100)
            schedule.append({
                "installment_no": inst.get("installment_no"),
                "due_date": inst.get("due_date"),
                "percentage": pct,
                "amount": amount,
            })

        return schedule

    async def check_fee_regulatory_compliance(
        self,
        fee_structure_id: UUID,
    ) -> dict:
        """Check if fee structure is within state FRC regulatory cap.

        Returns compliance status and details.
        """
        result = await self.db.execute(
            select(FeeStructure).where(FeeStructure.id == fee_structure_id)
        )
        fee_structure = result.scalar_one_or_none()
        if fee_structure is None:
            raise NotFoundException("FeeStructure", str(fee_structure_id))

        # Calculate total fee
        total = sum([
            fee_structure.tuition_fee or 0,
            fee_structure.development_fee or 0,
            fee_structure.hostel_fee_boys or fee_structure.hostel_fee or 0,
            fee_structure.mess_fee or 0,
            fee_structure.examination_fee or fee_structure.exam_fee or 0,
            fee_structure.library_fee or 0,
            fee_structure.laboratory_fee or fee_structure.lab_fee or 0,
            fee_structure.caution_deposit or 0,
            fee_structure.admission_charges or 0,
            fee_structure.university_registration_fee or 0,
            fee_structure.insurance_premium or 0,
            fee_structure.identity_card_fee or 0,
            fee_structure.other_fees or 0,
        ])

        cap = fee_structure.fee_regulatory_cap
        if cap is None:
            return {
                "fee_structure_id": str(fee_structure_id),
                "total_fee": total,
                "regulatory_cap": None,
                "is_compliant": True,
                "message": "No regulatory cap configured",
            }

        is_compliant = total <= cap
        excess = max(0, total - cap)

        return {
            "fee_structure_id": str(fee_structure_id),
            "total_fee": total,
            "regulatory_cap": cap,
            "is_compliant": is_compliant,
            "excess_amount": excess,
            "approved_by": fee_structure.approved_by,
            "approval_date": str(fee_structure.approval_date) if fee_structure.approval_date else None,
        }

    async def get_defaulters(
        self,
        academic_year: str,
        page: int = 1,
        page_size: int = 25,
    ) -> dict:
        """Get list of students with overdue fees for a given academic year.

        Checks installment due dates against payment records.
        """
        today = date.today()

        # Get all fee structures for this year
        fs_result = await self.db.execute(
            select(FeeStructure).where(
                FeeStructure.academic_year == academic_year,
                FeeStructure.is_active.is_(True),
            )
        )
        fee_structures = fs_result.scalars().all()

        defaulters = []
        for fs in fee_structures:
            installments = fs.installment_config or []
            for inst in installments:
                due_date_str = inst.get("due_date")
                if not due_date_str:
                    continue

                due_date = date.fromisoformat(due_date_str)
                grace_period = fs.grace_period_days or 0
                effective_due = date.fromordinal(due_date.toordinal() + grace_period)

                if today <= effective_due:
                    continue

                inst_no = inst.get("installment_no")

                # Find students in this quota who haven't paid this installment
                students_result = await self.db.execute(
                    select(Student).where(
                        Student.admission_quota == fs.quota,
                        Student.status.in_(["active", "enrolled"]),
                    )
                )
                students = students_result.scalars().all()

                for student in students:
                    paid_result = await self.db.execute(
                        select(FeePayment.id).where(
                            FeePayment.student_id == student.id,
                            FeePayment.fee_structure_id == fs.id,
                            FeePayment.installment_number == inst_no,
                            FeePayment.status.in_(["captured", "settled"]),
                        )
                    )
                    if paid_result.scalar_one_or_none() is None:
                        days_late = (today - effective_due).days
                        late_fee = days_late * (fs.late_fee_per_day or 0)
                        defaulters.append({
                            "student_id": str(student.id),
                            "student_name": student.name,
                            "enrollment_number": student.enrollment_number,
                            "quota": fs.quota,
                            "installment_number": inst_no,
                            "due_date": due_date_str,
                            "days_overdue": days_late,
                            "late_fee": late_fee,
                        })

        # Paginate
        total = len(defaulters)
        offset = (page - 1) * page_size
        paginated = defaulters[offset : offset + page_size]

        return {
            "data": paginated,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, math.ceil(total / page_size)),
        }

    async def get_collection_summary(self, academic_year: str) -> dict:
        """Get fee collection summary by quota.

        Returns collected, outstanding, and overdue amounts per quota.
        """
        # Get all fee structures for this year
        fs_result = await self.db.execute(
            select(FeeStructure).where(
                FeeStructure.academic_year == academic_year,
                FeeStructure.is_active.is_(True),
            )
        )
        fee_structures = fs_result.scalars().all()

        quotas = {}
        for fs in fee_structures:
            # Count students in this quota
            student_count_result = await self.db.execute(
                select(func.count()).select_from(Student).where(
                    Student.admission_quota == fs.quota,
                    Student.status.in_(["active", "enrolled"]),
                )
            )
            student_count = student_count_result.scalar_one()

            # Sum payments for this fee structure
            collected_result = await self.db.execute(
                select(func.coalesce(func.sum(FeePayment.amount), 0)).where(
                    FeePayment.fee_structure_id == fs.id,
                    FeePayment.status.in_(["captured", "settled"]),
                )
            )
            collected = collected_result.scalar_one()

            # Estimate total expected (simplified — total fee * student count)
            total_fee = sum([
                fs.tuition_fee or 0,
                fs.development_fee or 0,
                fs.hostel_fee or 0,
                fs.mess_fee or 0,
                fs.examination_fee or fs.exam_fee or 0,
                fs.library_fee or 0,
                fs.laboratory_fee or fs.lab_fee or 0,
                fs.other_fees or 0,
            ])
            expected = total_fee * student_count

            quotas[fs.quota] = {
                "quota": fs.quota,
                "student_count": student_count,
                "total_expected": expected,
                "total_collected": collected,
                "outstanding": max(0, expected - collected),
                "collection_percentage": round(collected / expected * 100, 1) if expected > 0 else 0,
            }

        return {
            "academic_year": academic_year,
            "quotas": list(quotas.values()),
            "grand_total_expected": sum(q["total_expected"] for q in quotas.values()),
            "grand_total_collected": sum(q["total_collected"] for q in quotas.values()),
        }
