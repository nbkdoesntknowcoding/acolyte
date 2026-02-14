"""Scholarship Matcher Service — auto-match students to eligible schemes.

Compares student profiles against all active ScholarshipScheme criteria
and creates StudentScholarship records for matches.
"""

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.admin.models import (
    ScholarshipScheme,
    Student,
    StudentScholarship,
)
from app.shared.exceptions import NotFoundException

logger = logging.getLogger(__name__)


class ScholarshipMatcherService:
    """Auto-match students to eligible scholarship schemes."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def match_student_to_schemes(
        self,
        student_id: UUID,
    ) -> list[dict]:
        """Compare one student's profile against all active schemes.

        Returns list of eligible schemes with match reasons.
        Does NOT create StudentScholarship records yet — call apply to do that.
        """
        result = await self.db.execute(
            select(Student).where(Student.id == student_id)
        )
        student = result.scalar_one_or_none()
        if student is None:
            raise NotFoundException("Student", str(student_id))

        # Get all active schemes
        schemes_result = await self.db.execute(
            select(ScholarshipScheme).where(
                ScholarshipScheme.is_active.is_(True),
            )
        )
        schemes = schemes_result.scalars().all()

        # Get existing scholarships for this student to avoid duplicates
        existing_result = await self.db.execute(
            select(StudentScholarship.scheme_id).where(
                StudentScholarship.student_id == student_id,
                StudentScholarship.application_status.notin_(["rejected"]),
            )
        )
        existing_scheme_ids = {row[0] for row in existing_result.all()}

        matches = []
        for scheme in schemes:
            if scheme.id in existing_scheme_ids:
                continue

            eligible, reasons = self._check_eligibility(student, scheme)
            if eligible:
                matches.append({
                    "scheme_id": str(scheme.id),
                    "scheme_name": scheme.name,
                    "awarding_body": scheme.awarding_body,
                    "amount_per_year": scheme.amount_per_year,
                    "amount_description": scheme.amount_description,
                    "covers_components": scheme.covers_components,
                    "application_portal": scheme.application_portal,
                    "portal_url": scheme.portal_url,
                    "match_reasons": reasons,
                    "already_applied": False,
                })

        return matches

    def _check_eligibility(
        self,
        student: Student,
        scheme: ScholarshipScheme,
    ) -> tuple[bool, list[str]]:
        """Check if a student meets a scheme's eligibility criteria.

        Returns (eligible: bool, reasons: list[str]).
        """
        reasons = []
        disqualified = False

        # Category check
        if scheme.eligible_categories:
            if student.category and student.category in scheme.eligible_categories:
                reasons.append(f"Category match: {student.category}")
            elif student.category:
                return False, [f"Category {student.category} not in eligible list"]
            else:
                # No category set — can't confirm eligibility
                return False, ["Student category not set"]

        # Income check
        if scheme.income_ceiling is not None:
            # We don't store family income on student model directly.
            # Mark as "needs verification" rather than disqualifying.
            reasons.append("Income verification required")

        # State check
        if scheme.eligible_states:
            if student.state and student.state in scheme.eligible_states:
                reasons.append(f"State match: {student.state}")
            elif student.state:
                return False, [f"State {student.state} not in eligible states"]
            else:
                reasons.append("State verification needed")

        # Merit criteria — basic check on NEET score/percentage
        if scheme.merit_criteria:
            # Simple heuristic: if merit_criteria mentions percentage and student has 12th marks
            criteria_lower = scheme.merit_criteria.lower()
            if "50%" in criteria_lower or "fifty" in criteria_lower:
                if student.class_12_percentage and student.class_12_percentage >= 50:
                    reasons.append(f"Merit match: 12th percentage {student.class_12_percentage}%")
                elif student.class_12_percentage and student.class_12_percentage < 50:
                    return False, ["Does not meet 50% merit criteria"]
                else:
                    reasons.append("Merit verification needed (no 12th marks on file)")
            else:
                reasons.append(f"Merit criteria to verify: {scheme.merit_criteria}")

        if not reasons:
            reasons.append("General eligibility — no specific criteria restrictions")

        return True, reasons

    async def auto_match_all_students(
        self,
        college_id: UUID,
    ) -> dict:
        """Batch match all active students against all active schemes.

        Creates StudentScholarship records for new matches with status="matched".
        Returns summary of matches created.
        """
        # Get all active students
        students_result = await self.db.execute(
            select(Student).where(
                Student.status.in_(["active", "enrolled"]),
            )
        )
        students = students_result.scalars().all()

        total_matches = 0
        student_summaries = []

        for student in students:
            matches = await self.match_student_to_schemes(student.id)
            new_matches = 0

            for match in matches:
                scholarship = StudentScholarship(
                    college_id=college_id,
                    student_id=student.id,
                    scheme_id=match["scheme_id"],
                    application_status="matched",
                    sanctioned_amount=match.get("amount_per_year"),
                )
                self.db.add(scholarship)
                new_matches += 1

            if new_matches > 0:
                student_summaries.append({
                    "student_id": str(student.id),
                    "student_name": student.name,
                    "enrollment_number": student.enrollment_number,
                    "matches": new_matches,
                })
                total_matches += new_matches

        if total_matches > 0:
            await self.db.flush()

        return {
            "students_processed": len(students),
            "total_matches": total_matches,
            "students_with_matches": len(student_summaries),
            "details": student_summaries,
        }

    async def check_renewal_eligibility(
        self,
        student_scholarship_id: UUID,
    ) -> dict:
        """Check if a student still meets renewal criteria for their scholarship.

        Returns eligibility status and reasons.
        """
        result = await self.db.execute(
            select(StudentScholarship).where(
                StudentScholarship.id == student_scholarship_id,
            )
        )
        ss = result.scalar_one_or_none()
        if ss is None:
            raise NotFoundException("StudentScholarship", str(student_scholarship_id))

        # Get scheme
        scheme_result = await self.db.execute(
            select(ScholarshipScheme).where(ScholarshipScheme.id == ss.scheme_id)
        )
        scheme = scheme_result.scalar_one_or_none()
        if scheme is None:
            raise NotFoundException("ScholarshipScheme", str(ss.scheme_id))

        # Get student
        student_result = await self.db.execute(
            select(Student).where(Student.id == ss.student_id)
        )
        student = student_result.scalar_one_or_none()
        if student is None:
            raise NotFoundException("Student", str(ss.student_id))

        issues = []
        is_eligible = True

        # Check if scheme requires renewal
        if not scheme.renewal_required:
            return {
                "student_scholarship_id": str(student_scholarship_id),
                "is_eligible": True,
                "renewal_required": False,
                "message": "Scheme does not require renewal",
            }

        # Check student status
        if student.status not in ("active", "enrolled"):
            issues.append(f"Student status is '{student.status}' — must be active/enrolled")
            is_eligible = False

        # Check renewal criteria (basic parsing)
        if scheme.renewal_criteria:
            criteria_lower = scheme.renewal_criteria.lower()
            if "50%" in criteria_lower:
                if student.class_12_percentage and student.class_12_percentage < 50:
                    issues.append("Below 50% marks requirement")
                    is_eligible = False
            # Attendance check would need integration engine data
            if "attendance" in criteria_lower:
                issues.append("Attendance verification pending (requires integration data)")

        return {
            "student_scholarship_id": str(student_scholarship_id),
            "student_name": student.name,
            "scheme_name": scheme.name,
            "is_eligible": is_eligible,
            "renewal_required": True,
            "renewal_criteria": scheme.renewal_criteria,
            "issues": issues,
        }

    async def get_disbursement_summary(self) -> dict:
        """Get scholarship disbursement summary.

        Total disbursed, pending, by scheme.
        """
        result = await self.db.execute(
            select(
                ScholarshipScheme.name,
                func.count(StudentScholarship.id).label("total_applications"),
                func.sum(
                    func.case(
                        (StudentScholarship.application_status == "disbursed", 1),
                        else_=0,
                    )
                ).label("disbursed_count"),
                func.coalesce(func.sum(StudentScholarship.disbursed_amount), 0).label("total_disbursed"),
                func.coalesce(func.sum(StudentScholarship.sanctioned_amount), 0).label("total_sanctioned"),
            ).join(
                ScholarshipScheme, StudentScholarship.scheme_id == ScholarshipScheme.id
            ).group_by(ScholarshipScheme.name)
        )
        rows = result.all()

        schemes = []
        grand_disbursed = 0
        grand_sanctioned = 0
        for row in rows:
            schemes.append({
                "scheme_name": row.name,
                "total_applications": row.total_applications,
                "disbursed_count": row.disbursed_count,
                "total_disbursed": row.total_disbursed,
                "total_sanctioned": row.total_sanctioned,
                "pending_amount": row.total_sanctioned - row.total_disbursed,
            })
            grand_disbursed += row.total_disbursed
            grand_sanctioned += row.total_sanctioned

        return {
            "schemes": schemes,
            "grand_total_disbursed": grand_disbursed,
            "grand_total_sanctioned": grand_sanctioned,
            "grand_total_pending": grand_sanctioned - grand_disbursed,
        }
