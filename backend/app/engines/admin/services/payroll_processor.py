"""Payroll Processor Service — salary computation, statutory deductions.

All monetary values in paisa (1 rupee = 100 paisa).
Indian payroll: 7th CPC + private college scales.
"""

import logging
import math
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.admin.models import Faculty, PayrollRecord, SalaryStructure
from app.shared.exceptions import NotFoundException, ValidationException

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TDS slabs — New Tax Regime (FY 2025-26 onward, India)
# Values in paisa
# ---------------------------------------------------------------------------
NEW_REGIME_SLABS = [
    (0, 400_000_00, 0.00),           # Up to ₹4,00,000 — nil
    (400_000_00, 800_000_00, 0.05),   # ₹4L–₹8L — 5%
    (800_000_00, 1200_000_00, 0.10),  # ₹8L–₹12L — 10%
    (1200_000_00, 1600_000_00, 0.15), # ₹12L–₹16L — 15%
    (1600_000_00, 2000_000_00, 0.20), # ₹16L–₹20L — 20%
    (2000_000_00, 2400_000_00, 0.25), # ₹20L–₹24L — 25%
    (2400_000_00, float("inf"), 0.30),# Above ₹24L — 30%
]

OLD_REGIME_SLABS = [
    (0, 250_000_00, 0.00),           # Up to ₹2.5L — nil
    (250_000_00, 500_000_00, 0.05),   # ₹2.5L–₹5L — 5%
    (500_000_00, 1000_000_00, 0.20),  # ₹5L–₹10L — 20%
    (1000_000_00, float("inf"), 0.30),# Above ₹10L — 30%
]

# Professional Tax common slabs (Karnataka as default)
# (monthly_gross_min_paisa, monthly_gross_max_paisa, monthly_pt_paisa)
KARNATAKA_PT_SLABS = [
    (0, 25_000_00, 0),               # Up to ₹25,000 — nil
    (25_000_00, float("inf"), 200_00),  # Above ₹25,000 — ₹200/month
]


class PayrollProcessorService:
    """Payroll computation following Indian statutory rules."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def calculate_salary(
        self,
        faculty_id: UUID,
        month: int,
        year: int,
    ) -> dict:
        """Calculate full salary for a faculty member for given month/year.

        Fetches SalaryStructure for the faculty's designation/pay_scale_type,
        computes all allowances and deductions, returns full breakdown.
        """
        if not (1 <= month <= 12):
            raise ValidationException("Month must be between 1 and 12")

        # Get faculty
        result = await self.db.execute(
            select(Faculty).where(Faculty.id == faculty_id)
        )
        faculty = result.scalar_one_or_none()
        if faculty is None:
            raise NotFoundException("Faculty", str(faculty_id))

        # Get salary structure
        result = await self.db.execute(
            select(SalaryStructure).where(
                SalaryStructure.designation == faculty.designation,
                SalaryStructure.pay_scale_type == (faculty.pay_scale_type or "private"),
                SalaryStructure.is_active.is_(True),
            )
        )
        salary_structure = result.scalar_one_or_none()
        if salary_structure is None:
            raise NotFoundException(
                "SalaryStructure",
                f"designation={faculty.designation}, pay_scale_type={faculty.pay_scale_type}",
            )

        # Compute earnings
        basic = salary_structure.basic_pay or 0
        da = int(basic * (salary_structure.da_percentage or 0) / 100)
        hra = int(basic * (salary_structure.hra_percentage or 0) / 100)
        npa = int(basic * (salary_structure.npa_percentage or 0) / 100)
        transport = salary_structure.transport_allowance or 0

        gross = basic + da + hra + npa + transport

        # Compute deductions
        epf_employee = self.calculate_epf_employee(basic, salary_structure.epf_employee_percentage)
        epf_employer = self.calculate_epf_employer(basic, salary_structure.epf_employer_percentage)

        esi_employee = 0
        esi_employer = 0
        esi_ceiling = salary_structure.esi_salary_ceiling or 2100_000  # ₹21,000 default
        if gross <= esi_ceiling:
            esi_employee = self.calculate_esi_employee(gross, salary_structure.esi_employee_percentage)
            esi_employer = self.calculate_esi_employer(gross, salary_structure.esi_employer_percentage)

        # Annual income estimate for TDS
        annual_gross = gross * 12
        annual_tds = self.calculate_tds(annual_gross, regime="new")
        monthly_tds = math.ceil(annual_tds / 12)

        professional_tax = self.calculate_professional_tax(
            gross,
            salary_structure.professional_tax_slab or KARNATAKA_PT_SLABS,
        )

        total_deductions = epf_employee + esi_employee + monthly_tds + professional_tax
        net_pay = gross - total_deductions

        return {
            "faculty_id": str(faculty_id),
            "faculty_name": faculty.name,
            "month": month,
            "year": year,
            "designation": faculty.designation,
            "pay_scale_type": faculty.pay_scale_type,
            # Earnings
            "basic_pay": basic,
            "dearness_allowance": da,
            "house_rent_allowance": hra,
            "non_practicing_allowance": npa,
            "transport_allowance": transport,
            "special_allowance": 0,
            "other_allowances": 0,
            "gross_earnings": gross,
            # Deductions
            "epf_employee": epf_employee,
            "epf_employer": epf_employer,
            "esi_employee": esi_employee,
            "esi_employer": esi_employer,
            "tds": monthly_tds,
            "professional_tax": professional_tax,
            "other_deductions": 0,
            "total_deductions": total_deductions,
            # Net
            "net_pay": net_pay,
        }

    @staticmethod
    def calculate_epf_employee(basic_pay: int, percentage: float | None = None) -> int:
        """Employee EPF contribution: 12% of basic pay."""
        pct = percentage if percentage is not None else 12.0
        return math.ceil(basic_pay * pct / 100)

    @staticmethod
    def calculate_epf_employer(basic_pay: int, percentage: float | None = None) -> int:
        """Employer EPF contribution: 12% of basic pay."""
        pct = percentage if percentage is not None else 12.0
        return math.ceil(basic_pay * pct / 100)

    @staticmethod
    def calculate_esi_employee(gross: int, percentage: float | None = None) -> int:
        """Employee ESI: 0.75% if gross <= ₹21,000/month."""
        pct = percentage if percentage is not None else 0.75
        return math.ceil(gross * pct / 100)

    @staticmethod
    def calculate_esi_employer(gross: int, percentage: float | None = None) -> int:
        """Employer ESI: 3.25% if gross <= ₹21,000/month."""
        pct = percentage if percentage is not None else 3.25
        return math.ceil(gross * pct / 100)

    @staticmethod
    def calculate_tds(annual_income: int, regime: str = "new") -> int:
        """Income tax per slab (New or Old regime).

        Args:
            annual_income: Annual gross income in paisa.
            regime: "new" or "old".

        Returns:
            Annual TDS amount in paisa.
        """
        slabs = NEW_REGIME_SLABS if regime == "new" else OLD_REGIME_SLABS
        tax = 0

        for lower, upper, rate in slabs:
            if annual_income <= lower:
                break
            taxable_in_slab = min(annual_income, upper) - lower
            tax += int(taxable_in_slab * rate)

        # 4% health & education cess
        cess = math.ceil(tax * 0.04)
        return tax + cess

    @staticmethod
    def calculate_professional_tax(
        monthly_gross: int,
        pt_slabs: list | None = None,
    ) -> int:
        """State-specific professional tax.

        Uses Karnataka slabs as default.
        """
        slabs = pt_slabs or KARNATAKA_PT_SLABS
        for lower, upper, amount in slabs:
            if lower <= monthly_gross < upper:
                return amount
            # Handle tuple format from JSONB: [lower, upper, amount]
            if isinstance(lower, (list, tuple)):
                low, high, amt = lower
                if low <= monthly_gross < high:
                    return amt
        return 0

    async def calculate_batch_payroll(
        self,
        month: int,
        year: int,
    ) -> list[dict]:
        """Calculate payroll for all active faculty members.

        Returns list of salary computations.
        """
        result = await self.db.execute(
            select(Faculty).where(Faculty.status == "active")
        )
        faculty_list = result.scalars().all()

        payroll_results = []
        errors = []
        for faculty in faculty_list:
            try:
                salary = await self.calculate_salary(faculty.id, month, year)
                payroll_results.append(salary)
            except (NotFoundException, ValidationException) as e:
                errors.append({
                    "faculty_id": str(faculty.id),
                    "faculty_name": faculty.name,
                    "error": str(e),
                })

        return {
            "month": month,
            "year": year,
            "processed": len(payroll_results),
            "errors": len(errors),
            "records": payroll_results,
            "error_details": errors,
        }

    async def save_payroll_records(
        self,
        records: list[dict],
        college_id: UUID,
    ) -> list[UUID]:
        """Persist calculated payroll records to database.

        Returns list of created PayrollRecord IDs.
        """
        created_ids = []
        for record in records:
            payroll = PayrollRecord(
                college_id=college_id,
                faculty_id=record["faculty_id"],
                month=record["month"],
                year=record["year"],
                basic_pay=record["basic_pay"],
                dearness_allowance=record["dearness_allowance"],
                house_rent_allowance=record["house_rent_allowance"],
                non_practicing_allowance=record["non_practicing_allowance"],
                transport_allowance=record["transport_allowance"],
                special_allowance=record.get("special_allowance", 0),
                other_allowances=record.get("other_allowances", 0),
                gross_earnings=record["gross_earnings"],
                epf_employee=record["epf_employee"],
                epf_employer=record["epf_employer"],
                esi_employee=record["esi_employee"],
                esi_employer=record["esi_employer"],
                tds=record["tds"],
                professional_tax=record["professional_tax"],
                other_deductions=record.get("other_deductions", 0),
                total_deductions=record["total_deductions"],
                net_pay=record["net_pay"],
                status="calculated",
                calculated_at=datetime.utcnow(),
            )
            self.db.add(payroll)
            await self.db.flush()
            created_ids.append(payroll.id)

        return created_ids

    async def get_statutory_summary(self, month: int, year: int) -> dict:
        """Get EPF/ESI/TDS/PT totals for the month.

        Used for statutory compliance reporting.
        """
        from sqlalchemy import func as sqlfunc

        result = await self.db.execute(
            select(
                sqlfunc.coalesce(sqlfunc.sum(PayrollRecord.epf_employee), 0).label("total_epf_employee"),
                sqlfunc.coalesce(sqlfunc.sum(PayrollRecord.epf_employer), 0).label("total_epf_employer"),
                sqlfunc.coalesce(sqlfunc.sum(PayrollRecord.esi_employee), 0).label("total_esi_employee"),
                sqlfunc.coalesce(sqlfunc.sum(PayrollRecord.esi_employer), 0).label("total_esi_employer"),
                sqlfunc.coalesce(sqlfunc.sum(PayrollRecord.tds), 0).label("total_tds"),
                sqlfunc.coalesce(sqlfunc.sum(PayrollRecord.professional_tax), 0).label("total_pt"),
                sqlfunc.coalesce(sqlfunc.sum(PayrollRecord.gross_earnings), 0).label("total_gross"),
                sqlfunc.coalesce(sqlfunc.sum(PayrollRecord.net_pay), 0).label("total_net"),
                sqlfunc.count(PayrollRecord.id).label("employee_count"),
            ).where(
                PayrollRecord.month == month,
                PayrollRecord.year == year,
            )
        )
        row = result.one()

        return {
            "month": month,
            "year": year,
            "employee_count": row.employee_count,
            "total_gross": row.total_gross,
            "total_net": row.total_net,
            "statutory": {
                "epf_employee": row.total_epf_employee,
                "epf_employer": row.total_epf_employer,
                "epf_total": row.total_epf_employee + row.total_epf_employer,
                "esi_employee": row.total_esi_employee,
                "esi_employer": row.total_esi_employer,
                "esi_total": row.total_esi_employee + row.total_esi_employer,
                "tds": row.total_tds,
                "professional_tax": row.total_pt,
            },
        }

    async def generate_bank_file(self, month: int, year: int) -> dict:
        """Generate NEFT/RTGS bank transfer data for bulk salary disbursement.

        Returns structured data (actual file generation would be handled by route).
        """
        result = await self.db.execute(
            select(PayrollRecord, Faculty).join(
                Faculty, PayrollRecord.faculty_id == Faculty.id
            ).where(
                PayrollRecord.month == month,
                PayrollRecord.year == year,
                PayrollRecord.status.in_(["calculated", "approved"]),
            )
        )
        rows = result.all()

        transfers = []
        total_amount = 0
        for payroll, faculty in rows:
            transfers.append({
                "beneficiary_name": faculty.name,
                "account_number": "****" if faculty.bank_account_number_hash else None,
                "ifsc": faculty.bank_ifsc,
                "bank_name": faculty.bank_name,
                "amount": payroll.net_pay,
                "employee_id": faculty.employee_id,
                "narration": f"Salary {month:02d}/{year} - {faculty.employee_id or faculty.name}",
            })
            total_amount += payroll.net_pay

        return {
            "month": month,
            "year": year,
            "transfer_count": len(transfers),
            "total_amount": total_amount,
            "transfers": transfers,
        }
