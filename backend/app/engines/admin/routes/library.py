"""Admin Engine — Library Management Routes.

Prefix: /api/v1/admin/library
Full CRUD for books, journals, and issuance tracking.
Includes overdue detection, fine calculation, and copy management.
"""

import math
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_tenant_db, require_role
from app.engines.admin.models import LibraryBook, LibraryIssuance, LibraryJournal
from app.engines.admin.schemas import (
    LibraryBookCreate,
    LibraryBookListResponse,
    LibraryBookResponse,
    LibraryBookUpdate,
    LibraryIssuanceCreate,
    LibraryIssuanceListResponse,
    LibraryIssuanceResponse,
    LibraryJournalCreate,
    LibraryJournalListResponse,
    LibraryJournalResponse,
)
from app.middleware.clerk_auth import CurrentUser, UserRole
from app.shared.exceptions import NotFoundException, ValidationException

router = APIRouter()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Fine rate: Rs 2 per day overdue (stored as paisa: 200 paisa = Rs 2)
_FINE_PER_DAY_PAISA = 200


# ---------------------------------------------------------------------------
# Inline schemas — Update models and request/response for issue/return
# ---------------------------------------------------------------------------

class LibraryJournalUpdate(BaseModel):
    name: str | None = None
    publisher: str | None = None
    issn: str | None = None
    journal_type: str | None = None
    indexed_in: list | None = None
    subscription_status: str | None = None
    subscription_start: date | None = None
    subscription_end: date | None = None
    annual_cost: int | None = None
    is_online: bool | None = None
    access_url: str | None = None


class IssueBookRequest(BaseModel):
    """Body for issuing a book to a borrower."""
    book_id: UUID
    borrower_id: UUID
    borrower_type: str | None = Field(
        default=None,
        description="Type of borrower: student, faculty, staff",
    )
    issued_date: date | None = Field(
        default=None,
        description="Issue date. Defaults to today if omitted.",
    )
    due_date: date = Field(..., description="Due date for returning the book")


class ReturnBookRequest(BaseModel):
    """Body for returning a book."""
    issuance_id: UUID = Field(..., description="ID of the issuance record to return")
    returned_date: date | None = Field(
        default=None,
        description="Date of return. Defaults to today if omitted.",
    )


class ReturnBookResponse(BaseModel):
    issuance: LibraryIssuanceResponse
    fine_amount: int = Field(description="Calculated fine in paisa (0 if returned on time)")
    overdue_days: int = Field(description="Number of days overdue (0 if on time)")


# ===================================================================
# Books
# ===================================================================


@router.get("/books", response_model=LibraryBookListResponse)
async def list_books(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(
        None,
        max_length=200,
        description="Search by title, author, or ISBN",
    ),
    department_id: UUID | None = Query(None, description="Filter by department"),
    subject: str | None = Query(None, description="Filter by subject"),
    status_filter: str | None = Query(
        None,
        alias="status",
        description="Filter by book status (available, out_of_stock, archived)",
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List library books with pagination, search, and filters.

    Search matches against title, author, and ISBN (case-insensitive).
    All filters are optional and combinable.
    """
    query = select(LibraryBook)

    # Search across title, author, isbn
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                LibraryBook.title.ilike(pattern),
                LibraryBook.author.ilike(pattern),
                LibraryBook.isbn.ilike(pattern),
            )
        )

    # Filters
    if department_id is not None:
        query = query.where(LibraryBook.department_id == department_id)
    if subject is not None:
        query = query.where(LibraryBook.subject == subject)
    if status_filter is not None:
        query = query.where(LibraryBook.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(LibraryBook.title.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    books = result.scalars().all()

    return LibraryBookListResponse(
        data=[LibraryBookResponse.model_validate(b) for b in books],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/books/{book_id}", response_model=LibraryBookResponse)
async def get_book(
    book_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Get a single library book by ID."""
    result = await db.execute(
        select(LibraryBook).where(LibraryBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise NotFoundException("LibraryBook", str(book_id))
    return LibraryBookResponse.model_validate(book)


@router.post("/books", response_model=LibraryBookResponse, status_code=201)
async def create_book(
    data: LibraryBookCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new library book record.

    Requires: admin, dean, or management role.
    Sets available_copies equal to total_copies on creation.
    """
    book = LibraryBook(
        college_id=user.college_id,
        available_copies=data.total_copies,
        **data.model_dump(exclude_unset=True),
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return LibraryBookResponse.model_validate(book)


@router.patch("/books/{book_id}", response_model=LibraryBookResponse)
async def update_book(
    book_id: UUID,
    data: LibraryBookUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing library book record.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(LibraryBook).where(LibraryBook.id == book_id)
    )
    book = result.scalar_one_or_none()
    if book is None:
        raise NotFoundException("LibraryBook", str(book_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(book, field, value)

    await db.commit()
    await db.refresh(book)
    return LibraryBookResponse.model_validate(book)


# ===================================================================
# Journals
# ===================================================================


@router.get("/journals", response_model=LibraryJournalListResponse)
async def list_journals(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    journal_type: str | None = Query(None, description="Filter by journal type (national, international, etc.)"),
    subscription_status: str | None = Query(None, description="Filter by subscription status (active, expired, cancelled)"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List library journals with pagination and filters."""
    query = select(LibraryJournal)

    if journal_type is not None:
        query = query.where(LibraryJournal.journal_type == journal_type)
    if subscription_status is not None:
        query = query.where(LibraryJournal.subscription_status == subscription_status)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(LibraryJournal.name.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    journals = result.scalars().all()

    return LibraryJournalListResponse(
        data=[LibraryJournalResponse.model_validate(j) for j in journals],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/journals", response_model=LibraryJournalResponse, status_code=201)
async def create_journal(
    data: LibraryJournalCreate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Create a new library journal subscription record.

    Requires: admin, dean, or management role.
    """
    journal = LibraryJournal(
        college_id=user.college_id,
        **data.model_dump(exclude_unset=True),
    )
    db.add(journal)
    await db.commit()
    await db.refresh(journal)
    return LibraryJournalResponse.model_validate(journal)


@router.patch("/journals/{journal_id}", response_model=LibraryJournalResponse)
async def update_journal(
    journal_id: UUID,
    data: LibraryJournalUpdate,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Update an existing library journal record.

    Requires: admin, dean, or management role.
    Only fields present in the request body are updated.
    """
    result = await db.execute(
        select(LibraryJournal).where(LibraryJournal.id == journal_id)
    )
    journal = result.scalar_one_or_none()
    if journal is None:
        raise NotFoundException("LibraryJournal", str(journal_id))

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(journal, field, value)

    await db.commit()
    await db.refresh(journal)
    return LibraryJournalResponse.model_validate(journal)


# ===================================================================
# Issuances — Issue & Return
# ===================================================================


@router.get("/issuances", response_model=LibraryIssuanceListResponse)
async def list_issuances(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    book_id: UUID | None = Query(None, description="Filter by book"),
    borrower_id: UUID | None = Query(None, description="Filter by borrower"),
    status_filter: str | None = Query(
        None,
        alias="status",
        description="Filter by issuance status (issued, returned, lost)",
    ),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List book issuances with pagination and filters."""
    query = select(LibraryIssuance)

    if book_id is not None:
        query = query.where(LibraryIssuance.book_id == book_id)
    if borrower_id is not None:
        query = query.where(LibraryIssuance.borrower_id == borrower_id)
    if status_filter is not None:
        query = query.where(LibraryIssuance.status == status_filter)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(LibraryIssuance.issued_date.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    issuances = result.scalars().all()

    return LibraryIssuanceListResponse(
        data=[LibraryIssuanceResponse.model_validate(i) for i in issuances],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/issue-book", response_model=LibraryIssuanceResponse, status_code=201)
async def issue_book(
    data: IssueBookRequest,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT, UserRole.FACULTY)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Issue a book to a borrower.

    - Verifies the book exists and has available copies.
    - Decrements available_copies on the book.
    - Creates a new LibraryIssuance record with status "issued".

    Requires: admin, dean, management, or faculty role.
    """
    # Verify book exists and has available copies
    book_result = await db.execute(
        select(LibraryBook).where(LibraryBook.id == data.book_id)
    )
    book = book_result.scalar_one_or_none()
    if book is None:
        raise NotFoundException("LibraryBook", str(data.book_id))

    if (book.available_copies or 0) <= 0:
        raise ValidationException(
            message=f"Book '{book.title}' has no available copies "
                    f"(total: {book.total_copies}, available: {book.available_copies})",
        )

    # Validate due_date is after issued_date
    issued = data.issued_date or date.today()
    if data.due_date <= issued:
        raise ValidationException(
            message="Due date must be after the issued date",
        )

    # Create issuance
    issuance = LibraryIssuance(
        college_id=user.college_id,
        book_id=data.book_id,
        borrower_id=data.borrower_id,
        borrower_type=data.borrower_type,
        issued_date=issued,
        due_date=data.due_date,
        status="issued",
    )
    db.add(issuance)

    # Decrement available copies
    book.available_copies = max(0, (book.available_copies or 0) - 1)
    if book.available_copies == 0:
        book.status = "out_of_stock"

    await db.commit()
    await db.refresh(issuance)
    return LibraryIssuanceResponse.model_validate(issuance)


@router.post("/return-book", response_model=ReturnBookResponse)
async def return_book(
    data: ReturnBookRequest,
    user: CurrentUser = Depends(
        require_role(UserRole.ADMIN, UserRole.DEAN, UserRole.MANAGEMENT, UserRole.FACULTY)
    ),
    db: AsyncSession = Depends(get_tenant_db),
):
    """Return a previously issued book.

    - Sets the returned_date on the issuance record.
    - Calculates fine based on overdue days (Rs 2/day).
    - Increments available_copies on the book.
    - Updates issuance status to "returned".

    Requires: admin, dean, management, or faculty role.
    """
    # Fetch issuance
    issuance_result = await db.execute(
        select(LibraryIssuance).where(LibraryIssuance.id == data.issuance_id)
    )
    issuance = issuance_result.scalar_one_or_none()
    if issuance is None:
        raise NotFoundException("LibraryIssuance", str(data.issuance_id))

    if issuance.status != "issued":
        raise ValidationException(
            message=f"Issuance {data.issuance_id} is not currently issued "
                    f"(status: {issuance.status}). Cannot return.",
        )

    # Determine return date
    returned = data.returned_date or date.today()

    # Calculate fine
    overdue_days = 0
    fine_amount = 0
    if returned > issuance.due_date:
        overdue_days = (returned - issuance.due_date).days
        fine_amount = overdue_days * _FINE_PER_DAY_PAISA

    # Update issuance
    issuance.returned_date = returned
    issuance.fine_amount = fine_amount
    issuance.status = "returned"

    # Increment book available copies
    book_result = await db.execute(
        select(LibraryBook).where(LibraryBook.id == issuance.book_id)
    )
    book = book_result.scalar_one_or_none()
    if book is not None:
        book.available_copies = (book.available_copies or 0) + 1
        if book.status == "out_of_stock" and book.available_copies > 0:
            book.status = "available"

    await db.commit()
    await db.refresh(issuance)

    return ReturnBookResponse(
        issuance=LibraryIssuanceResponse.model_validate(issuance),
        fine_amount=fine_amount,
        overdue_days=overdue_days,
    )


# ===================================================================
# Overdue Issuances
# ===================================================================


@router.get("/overdue", response_model=LibraryIssuanceListResponse)
async def list_overdue_issuances(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_db),
):
    """List all overdue book issuances.

    Returns issuances where status is "issued" and due_date is before today.
    Ordered by due_date ascending (most overdue first).
    """
    today = date.today()

    query = select(LibraryIssuance).where(
        LibraryIssuance.status == "issued",
        LibraryIssuance.due_date < today,
    )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate — most overdue first
    offset = (page - 1) * page_size
    query = query.order_by(LibraryIssuance.due_date.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    issuances = result.scalars().all()

    return LibraryIssuanceListResponse(
        data=[LibraryIssuanceResponse.model_validate(i) for i in issuances],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )
