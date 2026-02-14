"""MSR Checker Service — NMC Minimum Standard Requirements compliance.

Checks faculty strength against NMC MSR 2023 norms per department
and sanctioned intake. Provides gap analysis and retirement forecasting.
"""

import logging
import math
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.admin.models import College, Department, Faculty
from app.shared.exceptions import NotFoundException

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# NMC MSR 2023 — Faculty requirements per department per intake of 100
# Format: {"designation": count}
# For higher intakes, multiply proportionally (150 → 1.5x, 200 → 2x, 250 → 2.5x)
# ---------------------------------------------------------------------------
MSR_BASE_REQUIREMENTS = {
    # Pre-clinical departments
    "anatomy": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Tutor": 2},
    "physiology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Tutor": 2},
    "biochemistry": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Tutor": 2},
    # Para-clinical departments
    "pathology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Tutor": 2},
    "microbiology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Tutor": 2},
    "pharmacology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Tutor": 2},
    "forensic_medicine": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 1, "Tutor": 1},
    "community_medicine": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Tutor": 2},
    # Clinical departments
    "general_medicine": {"Professor": 1, "Associate Professor": 2, "Assistant Professor": 3, "Senior Resident": 3},
    "general_surgery": {"Professor": 1, "Associate Professor": 2, "Assistant Professor": 3, "Senior Resident": 3},
    "obstetrics_gynaecology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Senior Resident": 2},
    "paediatrics": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Senior Resident": 2},
    "orthopaedics": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Senior Resident": 2},
    "ophthalmology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 1, "Senior Resident": 1},
    "ent": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 1, "Senior Resident": 1},
    "dermatology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 1, "Senior Resident": 1},
    "psychiatry": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 1, "Senior Resident": 1},
    "anaesthesiology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 2, "Senior Resident": 2},
    "radiology": {"Professor": 1, "Associate Professor": 1, "Assistant Professor": 1, "Senior Resident": 1},
}

# Map department codes to MSR keys (case-insensitive matching)
DEPT_CODE_TO_MSR = {
    "ANAT": "anatomy",
    "PHYS": "physiology",
    "BCHM": "biochemistry",
    "PATH": "pathology",
    "MCBIO": "microbiology",
    "PHARM": "pharmacology",
    "FMT": "forensic_medicine",
    "CMED": "community_medicine",
    "MED": "general_medicine",
    "SURG": "general_surgery",
    "OBGY": "obstetrics_gynaecology",
    "PED": "paediatrics",
    "ORTH": "orthopaedics",
    "OPTH": "ophthalmology",
    "ENT": "ent",
    "DERM": "dermatology",
    "PSYCH": "psychiatry",
    "ANAES": "anaesthesiology",
    "RAD": "radiology",
}


class MSRCheckerService:
    """NMC Faculty MSR compliance checking."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_msr_requirements(self, college_id: UUID) -> dict:
        """Load NMC MSR minimums for the college's intake size.

        Returns requirements per department scaled to actual intake.
        """
        # Get college info for intake
        result = await self.db.execute(
            select(College).where(College.id == college_id)
        )
        college = result.scalar_one_or_none()
        if college is None:
            raise NotFoundException("College", str(college_id))

        intake = college.sanctioned_intake or 100
        multiplier = intake / 100

        requirements = {}
        for dept_key, designations in MSR_BASE_REQUIREMENTS.items():
            scaled = {}
            for designation, count in designations.items():
                scaled[designation] = math.ceil(count * multiplier)
            requirements[dept_key] = {
                "designations": scaled,
                "total": sum(scaled.values()),
            }

        return {
            "college_id": str(college_id),
            "college_name": college.name,
            "sanctioned_intake": intake,
            "multiplier": multiplier,
            "requirements": requirements,
        }

    async def calculate_department_compliance(
        self,
        department_id: UUID,
    ) -> dict:
        """Calculate MSR compliance for a single department.

        Returns actual vs required faculty per designation with gap analysis.
        """
        # Get department
        dept_result = await self.db.execute(
            select(Department).where(Department.id == department_id)
        )
        department = dept_result.scalar_one_or_none()
        if department is None:
            raise NotFoundException("Department", str(department_id))

        # Map department to MSR key
        msr_key = DEPT_CODE_TO_MSR.get(department.code)
        if msr_key is None:
            # Try matching by name
            dept_name_lower = department.name.lower().replace(" ", "_").replace("&", "and")
            msr_key = dept_name_lower if dept_name_lower in MSR_BASE_REQUIREMENTS else None

        if msr_key is None:
            return {
                "department_id": str(department_id),
                "department_name": department.name,
                "msr_applicable": False,
                "message": "Department not in NMC MSR requirements",
            }

        # Get college intake for scaling
        college_result = await self.db.execute(
            select(College).where(College.id == department.college_id)
        )
        college = college_result.scalar_one_or_none()
        intake = college.sanctioned_intake if college else 100
        multiplier = intake / 100

        # Get requirements
        base_req = MSR_BASE_REQUIREMENTS[msr_key]
        requirements = {d: math.ceil(c * multiplier) for d, c in base_req.items()}

        # Count actual faculty per designation
        faculty_result = await self.db.execute(
            select(Faculty.designation, func.count(Faculty.id)).where(
                Faculty.department_id == department_id,
                Faculty.status == "active",
            ).group_by(Faculty.designation)
        )
        actual = {row[0]: row[1] for row in faculty_result.all()}

        # Build gap analysis
        designations = []
        total_required = 0
        total_actual = 0
        total_gap = 0

        for designation, required in requirements.items():
            current = actual.get(designation, 0)
            gap = max(0, required - current)
            surplus = max(0, current - required)
            total_required += required
            total_actual += current
            total_gap += gap

            designations.append({
                "designation": designation,
                "required": required,
                "actual": current,
                "gap": gap,
                "surplus": surplus,
                "is_compliant": current >= required,
            })

        is_compliant = total_gap == 0
        compliance_percentage = round(total_actual / total_required * 100, 1) if total_required > 0 else 100

        return {
            "department_id": str(department_id),
            "department_name": department.name,
            "department_code": department.code,
            "msr_applicable": True,
            "sanctioned_intake": intake,
            "designations": designations,
            "total_required": total_required,
            "total_actual": total_actual,
            "total_gap": total_gap,
            "is_compliant": is_compliant,
            "compliance_percentage": compliance_percentage,
        }

    async def get_overall_compliance_score(self) -> dict:
        """Weighted compliance across all departments.

        Returns overall score and per-department breakdown.
        """
        # Get all active departments
        dept_result = await self.db.execute(
            select(Department).where(Department.is_active.is_(True))
        )
        departments = dept_result.scalars().all()

        department_scores = []
        total_required = 0
        total_actual = 0

        for dept in departments:
            compliance = await self.calculate_department_compliance(dept.id)
            if not compliance.get("msr_applicable"):
                continue

            department_scores.append({
                "department_id": str(dept.id),
                "department_name": dept.name,
                "department_code": dept.code,
                "required": compliance["total_required"],
                "actual": compliance["total_actual"],
                "gap": compliance["total_gap"],
                "is_compliant": compliance["is_compliant"],
                "compliance_percentage": compliance["compliance_percentage"],
            })

            total_required += compliance["total_required"]
            total_actual += compliance["total_actual"]

        overall_percentage = round(total_actual / total_required * 100, 1) if total_required > 0 else 100
        total_gap = max(0, total_required - total_actual)

        # Severity classification
        if overall_percentage >= 100:
            severity = "green"
        elif overall_percentage >= 90:
            severity = "yellow"
        elif overall_percentage >= 75:
            severity = "orange"
        else:
            severity = "red"

        return {
            "overall_compliance_percentage": overall_percentage,
            "severity": severity,
            "total_required": total_required,
            "total_actual": total_actual,
            "total_gap": total_gap,
            "compliant_departments": sum(1 for d in department_scores if d["is_compliant"]),
            "non_compliant_departments": sum(1 for d in department_scores if not d["is_compliant"]),
            "departments": department_scores,
        }

    async def forecast_retirement_impact(
        self,
        years_ahead: int = 3,
    ) -> list[dict]:
        """Forecast faculty retirements and their MSR impact.

        Returns timeline of retirements with per-department gap projections.
        """
        today = date.today()
        cutoff = today + timedelta(days=years_ahead * 365)

        result = await self.db.execute(
            select(Faculty, Department.name.label("dept_name"), Department.code.label("dept_code")).join(
                Department, Faculty.department_id == Department.id
            ).where(
                Faculty.status == "active",
                Faculty.retirement_date.isnot(None),
                Faculty.retirement_date <= cutoff,
                Faculty.retirement_date >= today,
            ).order_by(Faculty.retirement_date)
        )
        rows = result.all()

        retirements = []
        for faculty, dept_name, dept_code in rows:
            days_until = (faculty.retirement_date - today).days
            years_until = round(days_until / 365, 1)

            retirements.append({
                "faculty_id": str(faculty.id),
                "faculty_name": faculty.name,
                "designation": faculty.designation,
                "department_name": dept_name,
                "department_code": dept_code,
                "department_id": str(faculty.department_id),
                "retirement_date": faculty.retirement_date.isoformat(),
                "days_until_retirement": days_until,
                "years_until_retirement": years_until,
                "specialization": faculty.specialization,
            })

        # Group by year
        yearly_summary = {}
        for r in retirements:
            year = r["retirement_date"][:4]
            if year not in yearly_summary:
                yearly_summary[year] = {"count": 0, "departments_affected": set()}
            yearly_summary[year]["count"] += 1
            yearly_summary[year]["departments_affected"].add(r["department_name"])

        summary = [
            {
                "year": year,
                "retiring_count": data["count"],
                "departments_affected": list(data["departments_affected"]),
            }
            for year, data in sorted(yearly_summary.items())
        ]

        return {
            "forecast_years": years_ahead,
            "total_retiring": len(retirements),
            "yearly_summary": summary,
            "retirements": retirements,
        }

    async def get_critical_gaps(self) -> list[dict]:
        """Departments where hiring is urgent — gap > 0, ordered by severity.

        Combines MSR gap analysis with retirement forecast for a
        prioritized hiring plan.
        """
        overall = await self.get_overall_compliance_score()
        gaps = []

        for dept in overall["departments"]:
            if dept["gap"] > 0:
                gaps.append({
                    "department_id": dept["department_id"],
                    "department_name": dept["department_name"],
                    "department_code": dept["department_code"],
                    "current_gap": dept["gap"],
                    "required": dept["required"],
                    "actual": dept["actual"],
                    "compliance_percentage": dept["compliance_percentage"],
                    "priority": "critical" if dept["compliance_percentage"] < 75 else (
                        "high" if dept["compliance_percentage"] < 90 else "medium"
                    ),
                })

        # Sort by priority then by gap size
        priority_order = {"critical": 0, "high": 1, "medium": 2}
        gaps.sort(key=lambda g: (priority_order.get(g["priority"], 3), -g["current_gap"]))

        return gaps
