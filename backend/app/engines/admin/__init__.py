"""Admin Engine — Public Interface.

Other engines import ONLY from this file.
Example: from app.engines.admin import get_faculty_roster
"""

from app.engines.admin.routes import department_router, router
from app.engines.admin.service import (
    DepartmentService,
    get_faculty_count_by_department,
    get_faculty_roster,
    get_student_count,
)

__all__ = [
    "router",
    "department_router",
    "DepartmentService",
    "get_faculty_roster",
    "get_faculty_count_by_department",
    "get_student_count",
]
