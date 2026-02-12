"""Admin Engine — Public Interface.

Other engines import ONLY from this file.
Example: from app.engines.admin import get_faculty_roster
"""

from app.engines.admin.routes import admin_router
from app.engines.admin.service import (
    DepartmentService,
    get_faculty_count_by_department,
    get_faculty_roster,
    get_student_count,
)
from app.engines.admin.services import (
    CertificateGeneratorService,
    DashboardAggregatorService,
    FeeCalculatorService,
    MSRCheckerService,
    PayrollProcessorService,
    ReceiptGeneratorService,
    ScholarshipMatcherService,
)

__all__ = [
    # Router
    "admin_router",
    # Services
    "DepartmentService",
    "CertificateGeneratorService",
    "DashboardAggregatorService",
    "FeeCalculatorService",
    "MSRCheckerService",
    "PayrollProcessorService",
    "ReceiptGeneratorService",
    "ScholarshipMatcherService",
    # Public interface (called by other engines)
    "get_faculty_roster",
    "get_faculty_count_by_department",
    "get_student_count",
]
