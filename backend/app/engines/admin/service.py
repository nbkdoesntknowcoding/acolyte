# REFERENCE PATTERN: This is the standard CRUD pattern for all Acolyte engines.
# When building new services, copy this structure:
# - Service class takes AsyncSession
# - All queries rely on RLS (no manual college_id WHERE clauses)
# - Use structured exceptions from app.shared.exceptions
# - Return Pydantic schemas, not raw models
# - Soft delete by default (is_active=False), hard delete only for GDPR/DPDP requests

"""Admin Engine — Business Logic."""

import logging
import math
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.admin.models import Department
from app.engines.admin.schemas import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.shared.exceptions import DuplicateException, NotFoundException

logger = logging.getLogger(__name__)


class DepartmentService:
    """CRUD operations for departments.

    RLS is set on the AsyncSession before this service is called,
    so every query automatically filters by the current tenant's college_id.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, college_id: UUID, data: DepartmentCreate) -> DepartmentResponse:
        """Create a new department within the tenant.

        Args:
            college_id: The tenant's college ID (from authenticated user).
            data: Validated department creation payload.

        Raises:
            DuplicateError: If a department with the same code exists in this college.
        """
        department = Department(
            college_id=college_id,
            name=data.name,
            code=data.code.upper(),
            nmc_department_type=data.nmc_department_type.value,
            hod_id=data.hod_id,
            established_year=data.established_year,
        )
        self.db.add(department)
        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise DuplicateException("Department", "code", data.code.upper())

        await self.db.refresh(department)
        return DepartmentResponse.model_validate(department)

    async def get_by_id(self, department_id: UUID) -> DepartmentResponse:
        """Get a single department by ID. RLS auto-filters by tenant.

        Raises:
            ResourceNotFoundError: If the department does not exist (or belongs to another tenant).
        """
        result = await self.db.execute(
            select(Department).where(Department.id == department_id)
        )
        department = result.scalar_one_or_none()
        if department is None:
            raise NotFoundException("Department", str(department_id))
        return DepartmentResponse.model_validate(department)

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        nmc_type: str | None = None,
        active_only: bool = True,
    ) -> DepartmentListResponse:
        """List departments with pagination, search, and filtering.

        RLS ensures only the current tenant's departments are returned.
        """
        query = select(Department)

        if active_only:
            query = query.where(Department.is_active.is_(True))

        if nmc_type:
            query = query.where(Department.nmc_department_type == nmc_type)

        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Department.name.ilike(pattern),
                    Department.code.ilike(pattern),
                )
            )

        # Count total matching rows
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Paginate
        offset = (page - 1) * page_size
        query = query.order_by(Department.name).offset(offset).limit(page_size)
        result = await self.db.execute(query)
        departments = result.scalars().all()

        return DepartmentListResponse(
            data=[DepartmentResponse.model_validate(d) for d in departments],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, math.ceil(total / page_size)),
        )

    async def update(self, department_id: UUID, data: DepartmentUpdate) -> DepartmentResponse:
        """Update a department's fields. Only non-None fields are applied.

        Raises:
            ResourceNotFoundError: If the department does not exist.
            DuplicateError: If the updated code conflicts with an existing department.
        """
        result = await self.db.execute(
            select(Department).where(Department.id == department_id)
        )
        department = result.scalar_one_or_none()
        if department is None:
            raise NotFoundException("Department", str(department_id))

        update_data = data.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] is not None:
            update_data["code"] = update_data["code"].upper()
        if "nmc_department_type" in update_data and update_data["nmc_department_type"] is not None:
            update_data["nmc_department_type"] = update_data["nmc_department_type"].value

        for field, value in update_data.items():
            setattr(department, field, value)

        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise DuplicateException("Department", "code", update_data.get("code", ""))

        await self.db.refresh(department)
        return DepartmentResponse.model_validate(department)

    async def delete(self, department_id: UUID) -> bool:
        """Soft delete a department (sets is_active=False).

        Returns True if the department was found and deactivated.

        Raises:
            ResourceNotFoundError: If the department does not exist.
        """
        result = await self.db.execute(
            select(Department).where(Department.id == department_id)
        )
        department = result.scalar_one_or_none()
        if department is None:
            raise NotFoundException("Department", str(department_id))

        department.is_active = False
        await self.db.flush()
        return True

    async def get_by_code(self, code: str) -> DepartmentResponse | None:
        """Look up a department by its code. Returns None if not found.

        RLS auto-filters by tenant.
        """
        result = await self.db.execute(
            select(Department).where(Department.code == code.upper())
        )
        department = result.scalar_one_or_none()
        if department is None:
            return None
        return DepartmentResponse.model_validate(department)


# ---------------------------------------------------------------------------
# Public interface functions (called by other engines via admin.__init__)
# ---------------------------------------------------------------------------

async def get_faculty_roster(
    db: AsyncSession,
    college_id: UUID,
    department_id: UUID | None = None,
    status: str = "active",
) -> list[dict]:
    """Get faculty roster, optionally filtered by department.

    This is part of the public interface — called by Compliance Engine.
    RLS is already set on the session.
    """
    from app.engines.admin.models import Faculty

    query = select(Faculty).where(Faculty.status == status)
    if department_id is not None:
        query = query.where(Faculty.department_id == department_id)

    result = await db.execute(query)
    faculty_list = result.scalars().all()

    return [
        {
            "id": str(f.id),
            "name": f.name,
            "designation": f.designation,
            "department_id": str(f.department_id),
            "qualification": f.qualification,
            "specialization": f.specialization,
            "employment_type": f.employment_type,
            "date_of_joining": f.date_of_joining.isoformat() if f.date_of_joining else None,
            "retirement_date": f.retirement_date.isoformat() if f.retirement_date else None,
            "status": f.status,
            "nmc_faculty_id": f.nmc_faculty_id,
            "aebas_id": f.aebas_id,
        }
        for f in faculty_list
    ]


async def get_faculty_count_by_department(db: AsyncSession, college_id: UUID) -> dict:
    """Get faculty count by department for MSR calculation.

    Returns: {department_id_str: {"total": n, "professors": n, ...}}
    RLS is already set on the session.
    """
    from app.engines.admin.models import Faculty

    result = await db.execute(
        select(
            Faculty.department_id,
            Faculty.designation,
            func.count(Faculty.id).label("count"),
        ).where(
            Faculty.status == "active",
        ).group_by(Faculty.department_id, Faculty.designation)
    )
    rows = result.all()

    counts: dict[str, dict] = {}
    for dept_id, designation, count in rows:
        dept_key = str(dept_id)
        if dept_key not in counts:
            counts[dept_key] = {"total": 0}
        counts[dept_key][designation or "unknown"] = count
        counts[dept_key]["total"] += count

    return counts


async def get_student_count(
    db: AsyncSession,
    college_id: UUID,
    phase: str | None = None,
) -> int:
    """Get student count, optionally filtered by phase.

    RLS is already set on the session.
    """
    from app.engines.admin.models import Student

    query = select(func.count(Student.id)).where(
        Student.status.in_(["active", "enrolled"]),
    )
    if phase is not None:
        query = query.where(Student.current_phase == phase)

    result = await db.execute(query)
    return result.scalar_one()
