"""Admin Engine — Document Management Routes.

Full CRUD for documents with versioning support, tagging via JSONB,
soft-archive (is_archived), and unique tag retrieval.

Prefix: mounted by the parent router (typically /api/v1/admin/documents).
"""

import math
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import Document
from app.engines.admin.schemas import (
    DocumentCreate,
    DocumentListResponse,
    DocumentResponse,
    DocumentUpdate,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException

router = APIRouter()


# ===================================================================
# Document CRUD
# ===================================================================


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(
        None, max_length=200, description="Search by title or description"
    ),
    category: str | None = Query(None, description="Filter by category"),
    sub_category: str | None = Query(None, description="Filter by sub-category"),
    access_level: str | None = Query(
        None, description="Filter by access level (admin_only, faculty, all_staff, public)"
    ),
    academic_year: str | None = Query(
        None, description="Filter by academic year (e.g. 2025-26)"
    ),
    is_archived: bool | None = Query(
        None, description="Filter by archive status (default: show non-archived)"
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List documents with pagination, search, and filters.

    Search matches against title and description (case-insensitive).
    By default, archived documents are excluded unless is_archived=True
    is explicitly passed.
    All filters are optional and can be combined.
    """
    query = select(Document)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Document.title.ilike(search_term),
                Document.description.ilike(search_term),
            )
        )

    # Column filters
    if category is not None:
        query = query.where(Document.category == category)

    if sub_category is not None:
        query = query.where(Document.sub_category == sub_category)

    if access_level is not None:
        query = query.where(Document.access_level == access_level)

    if academic_year is not None:
        query = query.where(Document.academic_year == academic_year)

    if is_archived is not None:
        query = query.where(Document.is_archived == is_archived)
    else:
        # Default: exclude archived documents
        query = query.where(Document.is_archived.is_(False))

    # Count total matching rows
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = (
        query.order_by(Document.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        data=[DocumentResponse.model_validate(d) for d in documents],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/tags")
async def list_document_tags(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get all unique tag values across all non-archived documents.

    Queries the JSONB tags column using jsonb_array_elements_text
    to extract and deduplicate individual tag strings.
    Returns a sorted list of unique tags.
    """
    # Use jsonb_array_elements_text to unnest the tags JSONB arrays,
    # then aggregate distinct values.
    query = select(
        func.distinct(
            func.jsonb_array_elements_text(Document.tags)
        )
    ).where(
        Document.tags.isnot(None),
        Document.is_archived.is_(False),
    )

    result = await db.execute(query)
    tags = sorted([row[0] for row in result.all()])

    return {"tags": tags}


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single document by ID."""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if document is None:
        raise NotFoundException("Document", str(document_id))

    return DocumentResponse.model_validate(document)


@router.post("/", response_model=DocumentResponse, status_code=201)
async def create_document(
    data: DocumentCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Upload/create a new document record.

    Requires: admin, dean, or management role.
    The file itself should be uploaded to R2 first; this endpoint
    records the metadata and file_url reference.
    """
    document = Document(
        college_id=user.college_id,
        uploaded_by=user.user_id,
        uploaded_by_name=user.full_name,
        **data.model_dump(),
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    return DocumentResponse.model_validate(document)


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: UUID,
    data: DocumentUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update a document's metadata.

    Requires: admin, dean, or management role.
    Only provided (non-None) fields are updated.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if document is None:
        raise NotFoundException("Document", str(document_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)

    await db.commit()
    await db.refresh(document)

    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}", status_code=204)
async def archive_document(
    document_id: UUID,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Soft-archive a document by setting is_archived=True.

    Requires: admin, dean, or management role.
    Documents are never hard-deleted due to audit and compliance
    requirements. Archived documents are excluded from default listings.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()

    if document is None:
        raise NotFoundException("Document", str(document_id))

    document.is_archived = True
    await db.commit()
