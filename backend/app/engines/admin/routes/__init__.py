"""Admin Engine — Route aggregation.

Combines all sub-routers into a single admin_router for main.py registration.
Each sub-router handles its own prefix under /api/v1/admin/...
"""

from fastapi import APIRouter

from app.engines.admin.routes.admissions import router as admissions_router
from app.engines.admin.routes.alumni import router as alumni_router
from app.engines.admin.routes.calendar import router as calendar_router
from app.engines.admin.routes.certificates import router as certificates_router
from app.engines.admin.routes.dashboard import router as dashboard_router
from app.engines.admin.routes.departments import router as departments_router
from app.engines.admin.routes.documents import router as documents_router
from app.engines.admin.routes.executive import router as executive_router
from app.engines.admin.routes.faculty import router as faculty_router
from app.engines.admin.routes.fees import router as fees_router
from app.engines.admin.routes.grievances import router as grievances_router
from app.engines.admin.routes.hostel import router as hostel_router
from app.engines.admin.routes.infrastructure import router as infrastructure_router
from app.engines.admin.routes.leave import router as leave_router
from app.engines.admin.routes.library import router as library_router
from app.engines.admin.routes.notices import router as notices_router
from app.engines.admin.routes.payroll import router as payroll_router
from app.engines.admin.routes.recruitment import router as recruitment_router
from app.engines.admin.routes.rotations import router as rotations_router
from app.engines.admin.routes.scholarships import router as scholarships_router
from app.engines.admin.routes.settings import router as settings_router
from app.engines.admin.routes.students import router as students_router
from app.engines.admin.routes.timetable import router as timetable_router
from app.engines.admin.routes.transport import router as transport_router
from app.engines.admin.routes.workflows import router as workflows_router

# Master admin router — all sub-routers mounted here
admin_router = APIRouter()

admin_router.include_router(dashboard_router, prefix="/dashboard", tags=["Admin - Dashboard"])
admin_router.include_router(students_router, prefix="/students", tags=["Admin - Students"])
admin_router.include_router(admissions_router, prefix="/admissions", tags=["Admin - Admissions"])
admin_router.include_router(departments_router, prefix="/departments", tags=["Admin - Departments"])
admin_router.include_router(faculty_router, prefix="/faculty", tags=["Admin - Faculty"])
admin_router.include_router(fees_router, prefix="/fees", tags=["Admin - Fees"])
admin_router.include_router(scholarships_router, prefix="/scholarships", tags=["Admin - Scholarships"])
admin_router.include_router(payroll_router, prefix="/payroll", tags=["Admin - Payroll"])
admin_router.include_router(leave_router, prefix="/leave", tags=["Admin - Leave"])
admin_router.include_router(recruitment_router, prefix="/recruitment", tags=["Admin - Recruitment"])
admin_router.include_router(certificates_router, prefix="/certificates", tags=["Admin - Certificates"])
admin_router.include_router(alumni_router, prefix="/alumni", tags=["Admin - Alumni"])
admin_router.include_router(hostel_router, prefix="/hostel", tags=["Admin - Hostel"])
admin_router.include_router(transport_router, prefix="/transport", tags=["Admin - Transport"])
admin_router.include_router(library_router, prefix="/library", tags=["Admin - Library"])
admin_router.include_router(infrastructure_router, prefix="/infrastructure", tags=["Admin - Infrastructure"])
admin_router.include_router(notices_router, prefix="/notices", tags=["Admin - Notices"])
admin_router.include_router(grievances_router, prefix="/grievances", tags=["Admin - Grievances"])
admin_router.include_router(workflows_router, prefix="/workflows", tags=["Admin - Workflows"])
admin_router.include_router(documents_router, prefix="/documents", tags=["Admin - Documents"])
admin_router.include_router(calendar_router, prefix="/calendar", tags=["Admin - Calendar"])
admin_router.include_router(timetable_router, prefix="/timetable", tags=["Admin - Timetable"])
admin_router.include_router(rotations_router, prefix="/rotations", tags=["Admin - Rotations"])
admin_router.include_router(executive_router, prefix="/executive", tags=["Admin - Executive"])
admin_router.include_router(settings_router, prefix="/settings", tags=["Admin - Settings"])
