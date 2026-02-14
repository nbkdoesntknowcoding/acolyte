"""Admin Engine — Certificate Routes.

Full CRUD for certificates, generation via CertificateGeneratorService,
public QR verification (no auth), and revocation.

Prefix: mounted by the parent router (typically /api/v1/admin/certificates).
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Certificate
from app.engines.admin.schemas import (
    CertificateCreate,
    CertificateListResponse,
    CertificateResponse,
)
from app.engines.admin.services.certificate_generator import CertificateGeneratorService
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: get CertificateGeneratorService with tenant-scoped DB
# ---------------------------------------------------------------------------

def _get_cert_service(
    db: AsyncSession = Depends(get_tenant_db),
) -> CertificateGeneratorService:
    return CertificateGeneratorService(db)


# ---------------------------------------------------------------------------
# GET / — list certificates with pagination, search, and filters
# ---------------------------------------------------------------------------

@router.get("/", response_model=CertificateListResponse)
async def list_certificates(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None, max_length=200, description="Search by certificate_number"),
    student_id: UUID | None = Query(None, description="Filter by student"),
    certificate_type: str | None = Query(None, description="Filter by type (bonafide, migration, transfer, character, noc, fee_paid, course_completion, custom)"),
    status: str | None = Query(None, description="Filter by status (requested, generated, signed, issued, revoked)"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List certificates with pagination, search, and filters.

    Search matches against certificate_number (case-insensitive).
    All filters are optional and can be combined.
    """
    # Base query — RLS already filters by college_id
    query = select(Certificate)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            Certificate.certificate_number.ilike(search_term),
        )

    # Column filters
    if student_id is not None:
        query = query.where(Certificate.student_id == student_id)

    if certificate_type is not None:
        query = query.where(Certificate.certificate_type == certificate_type)

    if status is not None:
        query = query.where(Certificate.status == status)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Certificate.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    certificates = result.scalars().all()

    return CertificateListResponse(
        data=[CertificateResponse.model_validate(c) for c in certificates],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# GET /verify/{certificate_number} — PUBLIC endpoint (no auth required)
# ---------------------------------------------------------------------------

@router.get("/verify/{certificate_number}")
async def verify_certificate(
    certificate_number: str,
    db: AsyncSession = Depends(get_db),
):
    """Public QR verification endpoint — check if a certificate is valid.

    No authentication required. This is a public-facing verification service
    that returns limited information for privacy. Uses a non-tenant-scoped
    database session since we don't know the college_id from the certificate
    number alone.

    Note: This endpoint queries without RLS context because certificate
    verification must work for anyone scanning the QR code.
    """
    service = CertificateGeneratorService(db)
    return await service.verify_certificate(certificate_number)


# ---------------------------------------------------------------------------
# GET /{certificate_id} — get single certificate
# ---------------------------------------------------------------------------

@router.get("/{certificate_id}", response_model=CertificateResponse)
async def get_certificate(
    certificate_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single certificate by ID."""
    result = await db.execute(
        select(Certificate).where(Certificate.id == certificate_id)
    )
    certificate = result.scalar_one_or_none()

    if certificate is None:
        raise NotFoundException("Certificate", str(certificate_id))

    return CertificateResponse.model_validate(certificate)


# ---------------------------------------------------------------------------
# POST / — create certificate record (requires admin)
# ---------------------------------------------------------------------------

@router.post("/", response_model=CertificateResponse, status_code=201)
async def create_certificate(
    data: CertificateCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new certificate record (without generating the PDF).

    Requires: admin, dean, or management role.
    For full certificate generation with QR code, use POST /generate instead.
    """
    certificate = Certificate(
        college_id=user.college_id,
        **data.model_dump(),
    )
    db.add(certificate)
    await db.commit()
    await db.refresh(certificate)

    return CertificateResponse.model_validate(certificate)


# ---------------------------------------------------------------------------
# POST /generate — generate certificate with QR code (requires admin)
# ---------------------------------------------------------------------------

@router.post("/generate")
async def generate_certificate(
    data: CertificateCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    service: CertificateGeneratorService = Depends(_get_cert_service),
):
    """Generate a certificate with QR code for verification.

    Requires: admin, dean, or management role.
    Creates a Certificate record and returns all data needed for
    PDF template rendering, including QR verification URL.
    """
    return await service.generate_certificate(
        student_id=data.student_id,
        certificate_type=data.certificate_type,
        purpose=data.purpose,
        purpose_detail=data.purpose_detail,
        generated_by=user.user_id,
    )


# ---------------------------------------------------------------------------
# PATCH /{certificate_id} — update certificate status (requires admin)
# ---------------------------------------------------------------------------

@router.patch("/{certificate_id}", response_model=CertificateResponse)
async def update_certificate(
    certificate_id: UUID,
    status: str = Query(..., description="New status (requested, generated, signed, issued)"),
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a certificate's status.

    Requires: admin, dean, or management role.
    Use POST /{id}/revoke to revoke a certificate instead.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.id == certificate_id)
    )
    certificate = result.scalar_one_or_none()

    if certificate is None:
        raise NotFoundException("Certificate", str(certificate_id))

    certificate.status = status
    await db.commit()
    await db.refresh(certificate)

    return CertificateResponse.model_validate(certificate)


# ---------------------------------------------------------------------------
# POST /{certificate_id}/revoke — revoke certificate (requires admin)
# ---------------------------------------------------------------------------

@router.post("/{certificate_id}/revoke")
async def revoke_certificate(
    certificate_id: UUID,
    reason: str = Query(..., min_length=1, max_length=500, description="Reason for revocation"),
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    service: CertificateGeneratorService = Depends(_get_cert_service),
):
    """Revoke an issued certificate with a reason.

    Requires: admin, dean, or management role.
    Marks the certificate as revoked with the provided reason and
    current date. Revoked certificates show as invalid in public
    verification (GET /verify/{certificate_number}).
    """
    return await service.revoke_certificate(
        certificate_id=certificate_id,
        reason=reason,
        revoked_by=user.user_id,
    )


# ---------------------------------------------------------------------------
# DELETE /{certificate_id} — soft delete (set status="revoked")
# ---------------------------------------------------------------------------

@router.delete("/{certificate_id}", status_code=204)
async def delete_certificate(
    certificate_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-delete a certificate by setting status to 'revoked'.

    Requires: admin, dean, or management role.
    Certificates are never hard-deleted due to audit requirements.
    For a proper revocation with reason tracking, use POST /{id}/revoke instead.
    """
    result = await db.execute(
        select(Certificate).where(Certificate.id == certificate_id)
    )
    certificate = result.scalar_one_or_none()

    if certificate is None:
        raise NotFoundException("Certificate", str(certificate_id))

    certificate.status = "revoked"
    await db.commit()
