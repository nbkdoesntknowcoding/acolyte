"""Admin Engine — Scholarship Routes.

Prefix: /api/v1/admin/scholarships
Handles scholarship scheme CRUD (global, not tenant-scoped),
student scholarship tracking (tenant-scoped), auto-matching,
and disbursement summary.

All monetary values in paisa (1 rupee = 100 paisa).
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin import models
from app.engines.admin import schemas
from app.engines.admin.services.scholarship_matcher import ScholarshipMatcherService
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_scholarship_service(
    db: AsyncSession = Depends(get_tenant_db),
) -> ScholarshipMatcherService:
    """Dependency that creates a ScholarshipMatcherService with the tenant-scoped DB session."""
    return ScholarshipMatcherService(db)


# ---------------------------------------------------------------------------
# Scholarship Schemes (global — ScholarshipScheme extends Base, not TenantModel)
# ---------------------------------------------------------------------------

@router.get(
    "/schemes",
    response_model=schemas.ScholarshipSchemeListResponse,
)
async def list_scholarship_schemes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all scholarship schemes with pagination.

    ScholarshipScheme is a global reference table (not tenant-scoped),
    so all colleges see the same schemes.

    Requires: any authenticated user.
    """
    query = select(models.ScholarshipScheme)
    count_query = select(func.count(models.ScholarshipScheme.id))

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(
        models.ScholarshipScheme.name.asc(),
    ).offset(offset).limit(page_size)

    result = await db.execute(query)
    schemes = result.scalars().all()

    return schemas.ScholarshipSchemeListResponse(
        data=[schemas.ScholarshipSchemeResponse.model_validate(s) for s in schemes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/schemes/{scheme_id}",
    response_model=schemas.ScholarshipSchemeResponse,
)
async def get_scholarship_scheme(
    scheme_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single scholarship scheme by ID.

    Requires: any authenticated user.
    """
    result = await db.execute(
        select(models.ScholarshipScheme).where(
            models.ScholarshipScheme.id == scheme_id,
        )
    )
    scheme = result.scalar_one_or_none()
    if scheme is None:
        raise NotFoundException("ScholarshipScheme", str(scheme_id))

    return schemas.ScholarshipSchemeResponse.model_validate(scheme)


@router.post(
    "/schemes",
    response_model=schemas.ScholarshipSchemeResponse,
    status_code=201,
)
async def create_scholarship_scheme(
    data: schemas.ScholarshipSchemeCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new scholarship scheme.

    Requires: admin role.
    """
    scheme = models.ScholarshipScheme(
        name=data.name,
        awarding_body=data.awarding_body,
        scheme_code=data.scheme_code,
        eligible_categories=data.eligible_categories,
        income_ceiling=data.income_ceiling,
        merit_criteria=data.merit_criteria,
        eligible_states=data.eligible_states,
        amount_per_year=data.amount_per_year,
        amount_description=data.amount_description,
        covers_components=data.covers_components,
        application_portal=data.application_portal,
        portal_url=data.portal_url,
        application_window_start=data.application_window_start,
        application_window_end=data.application_window_end,
        renewal_required=data.renewal_required,
        renewal_criteria=data.renewal_criteria,
        academic_year=data.academic_year,
    )
    db.add(scheme)
    await db.commit()
    await db.refresh(scheme)

    return schemas.ScholarshipSchemeResponse.model_validate(scheme)


@router.patch(
    "/schemes/{scheme_id}",
    response_model=schemas.ScholarshipSchemeResponse,
)
async def update_scholarship_scheme(
    scheme_id: UUID,
    data: schemas.ScholarshipSchemeCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing scholarship scheme.

    All fields from ScholarshipSchemeCreate are accepted; only non-None values
    are applied as updates.

    Requires: admin, dean, or management role.
    """
    result = await db.execute(
        select(models.ScholarshipScheme).where(
            models.ScholarshipScheme.id == scheme_id,
        )
    )
    scheme = result.scalar_one_or_none()
    if scheme is None:
        raise NotFoundException("ScholarshipScheme", str(scheme_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(scheme, field, value)

    await db.commit()
    await db.refresh(scheme)

    return schemas.ScholarshipSchemeResponse.model_validate(scheme)


# ---------------------------------------------------------------------------
# Student Scholarships (tenant-scoped)
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=schemas.StudentScholarshipListResponse,
)
async def list_student_scholarships(
    student_id: UUID | None = Query(None),
    scheme_id: UUID | None = Query(None),
    application_status: str | None = Query(
        None,
        pattern="^(matched|applied|l1_verified|l2_verified|approved|rejected|disbursed)$",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List student scholarships with optional filters and pagination.

    Requires: any authenticated user.
    """
    query = select(models.StudentScholarship)
    count_query = select(func.count(models.StudentScholarship.id))

    # Apply filters
    if student_id is not None:
        query = query.where(models.StudentScholarship.student_id == student_id)
        count_query = count_query.where(models.StudentScholarship.student_id == student_id)
    if scheme_id is not None:
        query = query.where(models.StudentScholarship.scheme_id == scheme_id)
        count_query = count_query.where(models.StudentScholarship.scheme_id == scheme_id)
    if application_status is not None:
        query = query.where(models.StudentScholarship.application_status == application_status)
        count_query = count_query.where(
            models.StudentScholarship.application_status == application_status
        )

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(
        models.StudentScholarship.created_at.desc(),
    ).offset(offset).limit(page_size)

    result = await db.execute(query)
    records = result.scalars().all()

    return schemas.StudentScholarshipListResponse(
        data=[schemas.StudentScholarshipResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/auto-match",
    status_code=200,
)
async def auto_match_students(
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
    service: ScholarshipMatcherService = Depends(_get_scholarship_service),
):
    """Auto-match all active students against all active scholarship schemes.

    Creates StudentScholarship records with status='matched' for new matches.
    Returns a summary of matches found and created.

    Requires: admin, dean, or management role.
    """
    result = await service.auto_match_all_students(user.college_id)
    await db.commit()
    return result


@router.get(
    "/matched/{student_id}",
)
async def get_matched_schemes(
    student_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    service: ScholarshipMatcherService = Depends(_get_scholarship_service),
):
    """Get all scholarship schemes a specific student is eligible for.

    Compares the student's profile against all active schemes and returns
    matching schemes with eligibility reasons.

    Requires: any authenticated user.
    """
    return await service.match_student_to_schemes(student_id)


@router.post(
    "/{scholarship_id}/update-status",
    response_model=schemas.StudentScholarshipResponse,
)
async def update_scholarship_status(
    scholarship_id: UUID,
    data: schemas.StudentScholarshipUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a student scholarship application status and related fields.

    Used to progress scholarships through the workflow:
    matched -> applied -> l1_verified -> l2_verified -> approved -> disbursed

    Requires: admin, dean, or management role.
    """
    result = await db.execute(
        select(models.StudentScholarship).where(
            models.StudentScholarship.id == scholarship_id,
        )
    )
    scholarship = result.scalar_one_or_none()
    if scholarship is None:
        raise NotFoundException("StudentScholarship", str(scholarship_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(scholarship, field, value)

    await db.commit()
    await db.refresh(scholarship)

    return schemas.StudentScholarshipResponse.model_validate(scholarship)


@router.get(
    "/disbursement-summary",
    status_code=200,
)
async def get_disbursement_summary(
    user: CurrentUser = Depends(get_current_user),
    service: ScholarshipMatcherService = Depends(_get_scholarship_service),
):
    """Get scholarship disbursement summary totals.

    Returns per-scheme breakdown of total applications, disbursed count,
    disbursed amounts, sanctioned amounts, and pending amounts.

    Requires: any authenticated user.
    """
    return await service.get_disbursement_summary()
