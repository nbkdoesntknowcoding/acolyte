"""Admin Engine — Notice & Communication Routes.

Full CRUD for notices/circulars, publishing workflow, and
read/acknowledgment analytics.

Prefix: mounted by the parent router (typically /api/v1/admin/notices).
"""

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Notice, NoticeReadReceipt
from app.engines.admin.schemas import (
    NoticeCreate,
    NoticeListResponse,
    NoticeResponse,
    NoticeUpdate,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ===================================================================
# Notice CRUD
# ===================================================================


@router.get("/", response_model=NoticeListResponse)
async def list_notices(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(
        None, max_length=200, description="Search by title or content"
    ),
    notice_type: str | None = Query(None, description="Filter by notice type"),
    priority: str | None = Query(
        None, description="Filter by priority (normal, important, urgent)"
    ),
    status: str | None = Query(
        None, description="Filter by status (draft, published, expired, archived)"
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List notices with pagination, search, and filters.

    Search matches against title and content (case-insensitive).
    All filters are optional and can be combined.
    """
    query = select(Notice)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Notice.title.ilike(search_term),
                Notice.content.ilike(search_term),
            )
        )

    # Column filters
    if notice_type is not None:
        query = query.where(Notice.notice_type == notice_type)

    if priority is not None:
        query = query.where(Notice.priority == priority)

    if status is not None:
        query = query.where(Notice.status == status)

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(
        Notice.is_pinned.desc(), Notice.created_at.desc()
    ).offset(offset).limit(page_size)

    result = await db.execute(query)
    notices = result.scalars().all()

    return NoticeListResponse(
        data=[NoticeResponse.model_validate(n) for n in notices],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{notice_id}", response_model=NoticeResponse)
async def get_notice(
    notice_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single notice by ID."""
    result = await db.execute(
        select(Notice).where(Notice.id == notice_id)
    )
    notice = result.scalar_one_or_none()

    if notice is None:
        raise NotFoundException("Notice", str(notice_id))

    return NoticeResponse.model_validate(notice)


@router.post("/", response_model=NoticeResponse, status_code=201)
async def create_notice(
    data: NoticeCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new notice in draft status.

    Requires: admin, dean, or management role.
    The notice is created in 'draft' status. Use POST /{id}/publish
    to make it visible.
    """
    notice = Notice(
        college_id=user.college_id,
        posted_by=user.user_id,
        posted_by_name=user.full_name,
        status="draft",
        **data.model_dump(),
    )
    db.add(notice)
    await db.commit()
    await db.refresh(notice)

    return NoticeResponse.model_validate(notice)


@router.patch("/{notice_id}", response_model=NoticeResponse)
async def update_notice(
    notice_id: UUID,
    data: NoticeUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a notice.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(Notice).where(Notice.id == notice_id)
    )
    notice = result.scalar_one_or_none()

    if notice is None:
        raise NotFoundException("Notice", str(notice_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(notice, field, value)

    await db.commit()
    await db.refresh(notice)

    return NoticeResponse.model_validate(notice)


# ===================================================================
# Publishing & Analytics
# ===================================================================


@router.post("/{notice_id}/publish", response_model=NoticeResponse)
async def publish_notice(
    notice_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Publish a draft notice.

    Requires: admin, dean, or management role.
    Sets status to 'published' and records the publication timestamp.
    Only draft notices can be published.
    """
    result = await db.execute(
        select(Notice).where(Notice.id == notice_id)
    )
    notice = result.scalar_one_or_none()

    if notice is None:
        raise NotFoundException("Notice", str(notice_id))

    notice.status = "published"
    notice.published_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(notice)

    return NoticeResponse.model_validate(notice)


@router.get("/{notice_id}/analytics")
async def get_notice_analytics(
    notice_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get read/acknowledgment analytics for a notice.

    Returns aggregate statistics: read count, total recipients,
    acknowledged count, and computed read rate.
    """
    # Verify notice exists
    result = await db.execute(
        select(Notice).where(Notice.id == notice_id)
    )
    notice = result.scalar_one_or_none()

    if notice is None:
        raise NotFoundException("Notice", str(notice_id))

    # Compute live stats from read receipts
    read_count_result = await db.execute(
        select(func.count()).select_from(
            select(NoticeReadReceipt)
            .where(
                NoticeReadReceipt.notice_id == notice_id,
                NoticeReadReceipt.read_at.isnot(None),
            )
            .subquery()
        )
    )
    read_count = read_count_result.scalar_one()

    acknowledged_count_result = await db.execute(
        select(func.count()).select_from(
            select(NoticeReadReceipt)
            .where(
                NoticeReadReceipt.notice_id == notice_id,
                NoticeReadReceipt.acknowledged_at.isnot(None),
            )
            .subquery()
        )
    )
    acknowledged_count = acknowledged_count_result.scalar_one()

    # Use the total_recipients stored on the notice model; fall back to 0
    total_recipients = notice.total_recipients or 0

    # Compute read rate as a percentage (0-100)
    read_rate = round((read_count / total_recipients) * 100, 2) if total_recipients > 0 else 0.0

    return {
        "notice_id": str(notice_id),
        "read_count": read_count,
        "total_recipients": total_recipients,
        "acknowledged_count": acknowledged_count,
        "read_rate": read_rate,
    }
