"""Admin Engine — Admission Pipeline Routes.

Prefix: /api/v1/admin/admissions
Read-only analytics endpoints built on the Student model to provide
admission pipeline views, counseling round summaries, and quota analysis.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db
from app.engines.admin.models import Student
from app.middleware.clerk_auth import CurrentUser

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas (local to this module — not in schemas.py because these
# are aggregation views, not CRUD responses)
# ---------------------------------------------------------------------------

class PipelineStage(BaseModel):
    """A single stage in the admission pipeline."""
    status: str
    count: int
    percentage: float


class PipelineResponse(BaseModel):
    """Admission pipeline grouped by status."""
    stages: list[PipelineStage]
    total: int


class CounselingRound(BaseModel):
    """Admission count for a single counseling round."""
    counseling_round: str
    count: int
    percentage: float


class CounselingRoundsResponse(BaseModel):
    """Admission counts grouped by counseling round."""
    rounds: list[CounselingRound]
    total: int


class QuotaStatusBreakdown(BaseModel):
    """Status breakdown within a single quota."""
    status: str
    count: int


class QuotaAnalysisItem(BaseModel):
    """Admission analysis for a single quota."""
    quota: str
    total: int
    breakdown: list[QuotaStatusBreakdown]


class QuotaAnalysisResponse(BaseModel):
    """Quota-wise admission analysis."""
    quotas: list[QuotaAnalysisItem]
    grand_total: int


# ---------------------------------------------------------------------------
# Admission statuses that represent the admission pipeline (pre-active)
# ---------------------------------------------------------------------------

_ADMISSION_STATUSES = [
    "applied",
    "documents_submitted",
    "under_verification",
    "fee_pending",
    "enrolled",
]


# ---------------------------------------------------------------------------
# GET /pipeline — admission pipeline grouped by status
# ---------------------------------------------------------------------------

@router.get("/pipeline", response_model=PipelineResponse)
async def get_admission_pipeline(
    admission_year: int | None = Query(None, description="Filter by admission year"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get the admission pipeline showing student counts per admission status.

    Returns the count and percentage for each stage: applied,
    documents_submitted, under_verification, fee_pending, enrolled.
    Only includes students in admission-pipeline statuses (not active/graduated).
    """
    query = (
        select(
            Student.status,
            func.count(Student.id).label("count"),
        )
        .where(Student.status.in_(_ADMISSION_STATUSES))
    )

    if admission_year is not None:
        query = query.where(Student.admission_year == admission_year)

    query = query.group_by(Student.status)

    result = await db.execute(query)
    rows = result.all()

    counts_by_status: dict[str, int] = {row[0]: row[1] for row in rows}
    total = sum(counts_by_status.values())

    stages = []
    for status_name in _ADMISSION_STATUSES:
        count = counts_by_status.get(status_name, 0)
        pct = round((count / total * 100), 1) if total > 0 else 0.0
        stages.append(PipelineStage(status=status_name, count=count, percentage=pct))

    return PipelineResponse(stages=stages, total=total)


# ---------------------------------------------------------------------------
# GET /counseling-rounds — round-wise admission counts
# ---------------------------------------------------------------------------

@router.get("/counseling-rounds", response_model=CounselingRoundsResponse)
async def get_counseling_rounds(
    admission_year: int | None = Query(None, description="Filter by admission year"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get admission counts grouped by counseling round.

    Returns the number of students admitted through each counseling round
    (Round 1, Round 2, Mop-Up, Stray Vacancy, etc.) with percentages.
    """
    query = (
        select(
            func.coalesce(Student.counseling_round, "Not Specified").label("round"),
            func.count(Student.id).label("count"),
        )
    )

    if admission_year is not None:
        query = query.where(Student.admission_year == admission_year)

    query = query.group_by("round").order_by(func.count(Student.id).desc())

    result = await db.execute(query)
    rows = result.all()

    total = sum(row[1] for row in rows)

    rounds = []
    for row in rows:
        pct = round((row[1] / total * 100), 1) if total > 0 else 0.0
        rounds.append(
            CounselingRound(counseling_round=row[0], count=row[1], percentage=pct)
        )

    return CounselingRoundsResponse(rounds=rounds, total=total)


# ---------------------------------------------------------------------------
# GET /quota-analysis — quota-wise admission analysis
# ---------------------------------------------------------------------------

@router.get("/quota-analysis", response_model=QuotaAnalysisResponse)
async def get_quota_analysis(
    admission_year: int | None = Query(None, description="Filter by admission year"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get quota-wise admission analysis with status breakdown.

    For each admission quota (AIQ, State, Management, NRI, etc.), returns
    the total count and a breakdown by admission status. Useful for
    tracking how many students are at each pipeline stage per quota.
    """
    query = (
        select(
            func.coalesce(Student.admission_quota, "Unknown").label("quota"),
            Student.status,
            func.count(Student.id).label("count"),
        )
    )

    if admission_year is not None:
        query = query.where(Student.admission_year == admission_year)

    query = query.group_by("quota", Student.status).order_by("quota", Student.status)

    result = await db.execute(query)
    rows = result.all()

    # Aggregate into quota -> status -> count
    quota_data: dict[str, dict[str, int]] = {}
    for row in rows:
        quota_name = row[0]
        status_name = row[1] or "unknown"
        count = row[2]
        if quota_name not in quota_data:
            quota_data[quota_name] = {}
        quota_data[quota_name][status_name] = count

    grand_total = 0
    quotas = []
    for quota_name, status_counts in sorted(quota_data.items()):
        quota_total = sum(status_counts.values())
        grand_total += quota_total
        breakdown = [
            QuotaStatusBreakdown(status=s, count=c)
            for s, c in sorted(status_counts.items())
        ]
        quotas.append(
            QuotaAnalysisItem(quota=quota_name, total=quota_total, breakdown=breakdown)
        )

    return QuotaAnalysisResponse(quotas=quotas, grand_total=grand_total)
