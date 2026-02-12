"""Admin Engine — Executive / Management Dashboard Routes.

Prefix: /api/v1/admin/executive
High-level aggregation endpoints for the management dashboard: financial
overview, compliance heatmap (placeholder), and critical action items.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db
from app.engines.admin.models import (
    Faculty,
    FeePayment,
    Student,
    WorkflowInstance,
)
from app.middleware.clerk_auth import CurrentUser

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas (local — aggregation views, not CRUD responses)
# ---------------------------------------------------------------------------

class AcademicYearRevenue(BaseModel):
    """Revenue summary for a single academic year."""
    academic_year: str
    total_captured: int  # paisa
    total_pending: int  # paisa
    total_failed: int  # paisa
    total_refunded: int  # paisa
    payment_count: int


class FinancialOverviewResponse(BaseModel):
    """Revenue and collection summary grouped by academic year."""
    years: list[AcademicYearRevenue]
    grand_total_captured: int  # paisa
    grand_total_pending: int  # paisa
    grand_total_outstanding: int  # paisa


class ComplianceHeatmapResponse(BaseModel):
    """Compliance heatmap placeholder structure.

    Will be populated with real data from the Compliance Engine in a later phase.
    """
    departments: list[str]
    categories: list[str]
    data: list[dict]


class ActionItemsResponse(BaseModel):
    """Critical action items requiring management attention."""
    overdue_fees_count: int
    msr_gaps_count: int
    pending_approvals_count: int
    expiring_documents_count: int
    faculty_retiring_soon_count: int


# ---------------------------------------------------------------------------
# GET /financial-overview — revenue and collection summary
# ---------------------------------------------------------------------------

@router.get("/financial-overview", response_model=FinancialOverviewResponse)
async def get_financial_overview(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Revenue and collection summary aggregated by academic year.

    Groups fee payments by status (captured, pending, failed, refunded)
    within each academic year. All monetary values are in paisa.
    """
    query = (
        select(
            func.coalesce(FeePayment.academic_year, "Unknown").label("academic_year"),
            FeePayment.status,
            func.sum(FeePayment.amount).label("total_amount"),
            func.count(FeePayment.id).label("payment_count"),
        )
        .group_by("academic_year", FeePayment.status)
        .order_by("academic_year")
    )

    result = await db.execute(query)
    rows = result.all()

    # Aggregate into year -> status -> (amount, count)
    year_data: dict[str, dict[str, tuple[int, int]]] = {}
    for row in rows:
        ay = row[0]
        st = row[1] or "unknown"
        amount = int(row[2] or 0)
        count = row[3]
        if ay not in year_data:
            year_data[ay] = {}
        year_data[ay][st] = (amount, count)

    grand_captured = 0
    grand_pending = 0
    years = []

    for ay, status_map in sorted(year_data.items()):
        captured_amt, captured_cnt = status_map.get("captured", (0, 0))
        settled_amt, settled_cnt = status_map.get("settled", (0, 0))
        pending_amt, pending_cnt = status_map.get("pending", (0, 0))
        failed_amt, _ = status_map.get("failed", (0, 0))
        refunded_amt, _ = status_map.get("refunded", (0, 0))

        # captured + settled = successfully collected
        total_captured = captured_amt + settled_amt
        total_count = sum(v[1] for v in status_map.values())

        grand_captured += total_captured
        grand_pending += pending_amt

        years.append(
            AcademicYearRevenue(
                academic_year=ay,
                total_captured=total_captured,
                total_pending=pending_amt,
                total_failed=failed_amt,
                total_refunded=refunded_amt,
                payment_count=total_count,
            )
        )

    return FinancialOverviewResponse(
        years=years,
        grand_total_captured=grand_captured,
        grand_total_pending=grand_pending,
        grand_total_outstanding=grand_pending,
    )


# ---------------------------------------------------------------------------
# GET /compliance-heatmap — placeholder
# ---------------------------------------------------------------------------

@router.get("/compliance-heatmap", response_model=ComplianceHeatmapResponse)
async def get_compliance_heatmap(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Compliance heatmap data (placeholder).

    Returns the expected structure for the compliance heatmap visualization.
    Actual data will be populated by the Compliance Engine integration
    in a later development phase. The frontend can build its UI against
    this contract now.

    Categories represent NMC compliance areas; data cells will hold
    scores from 0-100 per department per category.
    """
    return ComplianceHeatmapResponse(
        departments=[],
        categories=[
            "Faculty MSR",
            "AEBAS Attendance",
            "Infrastructure",
            "Hospital Data",
            "Academic Records",
            "Research Output",
        ],
        data=[],
    )


# ---------------------------------------------------------------------------
# GET /action-items — critical items needing management attention
# ---------------------------------------------------------------------------

@router.get("/action-items", response_model=ActionItemsResponse)
async def get_action_items(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Critical action items aggregated from multiple models.

    Returns counts of items requiring management attention:
    - overdue_fees_count: fee payments still pending past 30 days
    - msr_gaps_count: placeholder (0) until Compliance Engine integration
    - pending_approvals_count: workflow instances in pending/in_progress status
    - expiring_documents_count: placeholder (0) until document expiry tracking
    - faculty_retiring_soon_count: faculty with retirement_date within 180 days
    """
    now = datetime.now(timezone.utc)
    today = date.today()
    thirty_days_ago = now - timedelta(days=30)
    six_months_from_now = today + timedelta(days=180)

    # 1. Overdue fees: payments still pending created more than 30 days ago
    overdue_query = (
        select(func.count(FeePayment.id))
        .where(
            FeePayment.status == "pending",
            FeePayment.created_at <= thirty_days_ago,
        )
    )
    overdue_result = await db.execute(overdue_query)
    overdue_fees_count = overdue_result.scalar_one() or 0

    # 2. MSR gaps: placeholder — real data comes from Compliance Engine
    msr_gaps_count = 0

    # 3. Pending approvals: workflow instances in pending or in_progress status
    approvals_query = (
        select(func.count(WorkflowInstance.id))
        .where(WorkflowInstance.status.in_(["pending", "in_progress"]))
    )
    approvals_result = await db.execute(approvals_query)
    pending_approvals_count = approvals_result.scalar_one() or 0

    # 4. Expiring documents: placeholder — Document model lacks expiry field;
    #    will be wired when document lifecycle management is implemented
    expiring_documents_count = 0

    # 5. Faculty retiring within the next 6 months
    retiring_query = (
        select(func.count(Faculty.id))
        .where(
            Faculty.status == "active",
            Faculty.retirement_date.isnot(None),
            Faculty.retirement_date <= six_months_from_now,
            Faculty.retirement_date >= today,
        )
    )
    retiring_result = await db.execute(retiring_query)
    faculty_retiring_soon_count = retiring_result.scalar_one() or 0

    return ActionItemsResponse(
        overdue_fees_count=overdue_fees_count,
        msr_gaps_count=msr_gaps_count,
        pending_approvals_count=pending_approvals_count,
        expiring_documents_count=expiring_documents_count,
        faculty_retiring_soon_count=faculty_retiring_soon_count,
    )
