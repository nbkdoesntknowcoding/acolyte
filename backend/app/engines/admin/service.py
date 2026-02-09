"""Admin Engine — Business Logic."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


async def get_faculty_roster(db: AsyncSession, college_id: UUID, department_id: UUID = None) -> list:
    """Get faculty roster, optionally filtered by department.

    This is part of the public interface — called by Compliance Engine.
    """
    return []


async def get_faculty_count_by_department(db: AsyncSession, college_id: UUID) -> dict:
    """Get faculty count by department for MSR calculation.

    Returns: {department_id: FacultyCount}
    """
    return {}


async def get_student_count(db: AsyncSession, college_id: UUID, phase: str = None) -> int:
    """Get student count, optionally filtered by phase."""
    return 0
