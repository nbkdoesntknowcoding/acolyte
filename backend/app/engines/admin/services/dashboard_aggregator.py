"""Dashboard Aggregator Service — stats and analytics for admin dashboard.

Aggregates data from multiple models for dashboard widgets.
"""

import logging
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.admin.models import (
    Certificate,
    Department,
    Faculty,
    FeePayment,
    FeeStructure,
    Grievance,
    LeaveRequest,
    Notice,
    Student,
    WorkflowInstance,
)
from app.shared.models import AuditLog

logger = logging.getLogger(__name__)


class DashboardAggregatorService:
    """Aggregate dashboard statistics and metrics."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_dashboard_stats(self) -> dict:
        """Get all overview stats for admin dashboard.

        Returns student/faculty counts, fee collection, pending approvals, etc.
        """
        # Student counts by status
        student_result = await self.db.execute(
            select(
                func.count(Student.id).label("total"),
                func.sum(case((Student.status == "active", 1), else_=0)).label("active"),
                func.sum(case((Student.status.in_(["applied", "documents_submitted", "under_verification", "fee_pending"]), 1), else_=0)).label("admission_pipeline"),
                func.sum(case((Student.status == "graduated", 1), else_=0)).label("graduated"),
            ).select_from(Student)
        )
        student_stats = student_result.one()

        # Faculty counts
        faculty_result = await self.db.execute(
            select(
                func.count(Faculty.id).label("total"),
                func.sum(case((Faculty.status == "active", 1), else_=0)).label("active"),
                func.sum(case((Faculty.status == "on_leave", 1), else_=0)).label("on_leave"),
            ).select_from(Faculty)
        )
        faculty_stats = faculty_result.one()

        # Department count
        dept_count_result = await self.db.execute(
            select(func.count(Department.id)).where(Department.is_active.is_(True))
        )
        dept_count = dept_count_result.scalar_one()

        # Fee collection this academic year (current)
        current_year = self._current_academic_year()
        fee_result = await self.db.execute(
            select(
                func.coalesce(func.sum(FeePayment.amount), 0).label("collected"),
                func.count(FeePayment.id).label("payment_count"),
            ).where(
                FeePayment.academic_year == current_year,
                FeePayment.status.in_(["captured", "settled"]),
            )
        )
        fee_stats = fee_result.one()

        # Pending workflow approvals
        pending_result = await self.db.execute(
            select(func.count(WorkflowInstance.id)).where(
                WorkflowInstance.status.in_(["pending", "in_progress"]),
            )
        )
        pending_approvals = pending_result.scalar_one()

        # Pending leave requests
        leave_pending_result = await self.db.execute(
            select(func.count(LeaveRequest.id)).where(
                LeaveRequest.status == "pending",
            )
        )
        pending_leaves = leave_pending_result.scalar_one()

        # Active grievances
        grievance_result = await self.db.execute(
            select(func.count(Grievance.id)).where(
                Grievance.status.in_(["filed", "acknowledged", "under_review"]),
            )
        )
        active_grievances = grievance_result.scalar_one()

        return {
            "students": {
                "total": student_stats.total or 0,
                "active": student_stats.active or 0,
                "admission_pipeline": student_stats.admission_pipeline or 0,
                "graduated": student_stats.graduated or 0,
            },
            "faculty": {
                "total": faculty_stats.total or 0,
                "active": faculty_stats.active or 0,
                "on_leave": faculty_stats.on_leave or 0,
            },
            "departments": dept_count,
            "fee_collection": {
                "academic_year": current_year,
                "total_collected": fee_stats.collected,
                "payment_count": fee_stats.payment_count,
            },
            "pending_approvals": pending_approvals,
            "pending_leaves": pending_leaves,
            "active_grievances": active_grievances,
        }

    async def get_fee_collection_trend(
        self,
        academic_year: str | None = None,
    ) -> list[dict]:
        """Monthly fee collection trend data for charts.

        Returns [{month, year, amount, count}] for the given academic year.
        """
        if academic_year is None:
            academic_year = self._current_academic_year()

        result = await self.db.execute(
            select(
                func.extract("month", FeePayment.payment_date).label("month"),
                func.extract("year", FeePayment.payment_date).label("year"),
                func.coalesce(func.sum(FeePayment.amount), 0).label("amount"),
                func.count(FeePayment.id).label("count"),
            ).where(
                FeePayment.academic_year == academic_year,
                FeePayment.status.in_(["captured", "settled"]),
                FeePayment.payment_date.isnot(None),
            ).group_by(
                func.extract("year", FeePayment.payment_date),
                func.extract("month", FeePayment.payment_date),
            ).order_by(
                func.extract("year", FeePayment.payment_date),
                func.extract("month", FeePayment.payment_date),
            )
        )
        rows = result.all()

        return [
            {
                "month": int(row.month),
                "year": int(row.year),
                "amount": row.amount,
                "count": row.count,
            }
            for row in rows
        ]

    async def get_recent_activity(self, limit: int = 20) -> list[dict]:
        """Recent activity feed from audit log.

        Returns most recent create/update/delete actions across all entities.
        """
        result = await self.db.execute(
            select(AuditLog).order_by(
                AuditLog.created_at.desc()
            ).limit(limit)
        )
        activities = result.scalars().all()

        return [
            {
                "id": str(a.id),
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_id": str(a.entity_id) if a.entity_id else None,
                "user_id": str(a.user_id) if a.user_id else None,
                "changes": a.changes,
                "ip_address": a.ip_address,
                "timestamp": a.created_at.isoformat() if a.created_at else None,
            }
            for a in activities
        ]

    async def get_pending_approvals(
        self,
        user_id: UUID | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Get pending workflow approvals, optionally filtered to a specific approver.

        Returns list of pending workflow instances with details.
        """
        query = select(WorkflowInstance).where(
            WorkflowInstance.status.in_(["pending", "in_progress"]),
        )

        if user_id is not None:
            query = query.where(WorkflowInstance.current_approver_id == user_id)

        query = query.order_by(
            case(
                (WorkflowInstance.priority == "urgent", 0),
                (WorkflowInstance.priority == "high", 1),
                (WorkflowInstance.priority == "normal", 2),
                (WorkflowInstance.priority == "low", 3),
                else_=4,
            ),
            WorkflowInstance.created_at.asc(),
        ).limit(limit)

        result = await self.db.execute(query)
        instances = result.scalars().all()

        return [
            {
                "id": str(w.id),
                "workflow_type": w.workflow_type,
                "title": w.title,
                "description": w.description,
                "requested_by_name": w.requested_by_name,
                "current_step": w.current_step,
                "priority": w.priority,
                "due_date": w.due_date.isoformat() if w.due_date else None,
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "status": w.status,
            }
            for w in instances
        ]

    async def get_student_distribution(self) -> dict:
        """Student distribution by phase, batch, and quota."""
        # By phase
        phase_result = await self.db.execute(
            select(
                Student.current_phase,
                func.count(Student.id),
            ).where(
                Student.status.in_(["active", "enrolled"]),
            ).group_by(Student.current_phase)
        )
        by_phase = {row[0] or "Unassigned": row[1] for row in phase_result.all()}

        # By quota
        quota_result = await self.db.execute(
            select(
                Student.admission_quota,
                func.count(Student.id),
            ).where(
                Student.status.in_(["active", "enrolled"]),
            ).group_by(Student.admission_quota)
        )
        by_quota = {row[0] or "Unknown": row[1] for row in quota_result.all()}

        # By gender
        gender_result = await self.db.execute(
            select(
                Student.gender,
                func.count(Student.id),
            ).where(
                Student.status.in_(["active", "enrolled"]),
            ).group_by(Student.gender)
        )
        by_gender = {row[0] or "Not specified": row[1] for row in gender_result.all()}

        return {
            "by_phase": by_phase,
            "by_quota": by_quota,
            "by_gender": by_gender,
        }

    async def get_faculty_distribution(self) -> dict:
        """Faculty distribution by department, designation, employment type."""
        # By department
        dept_result = await self.db.execute(
            select(
                Department.name,
                func.count(Faculty.id),
            ).join(
                Department, Faculty.department_id == Department.id
            ).where(
                Faculty.status == "active",
            ).group_by(Department.name)
        )
        by_department = {row[0]: row[1] for row in dept_result.all()}

        # By designation
        desig_result = await self.db.execute(
            select(
                Faculty.designation,
                func.count(Faculty.id),
            ).where(
                Faculty.status == "active",
            ).group_by(Faculty.designation)
        )
        by_designation = {row[0] or "Unknown": row[1] for row in desig_result.all()}

        return {
            "by_department": by_department,
            "by_designation": by_designation,
        }

    @staticmethod
    def _current_academic_year() -> str:
        """Determine current academic year string (e.g., '2025-26').

        Academic year starts in June/July — if before July, use previous year.
        """
        today = date.today()
        if today.month >= 7:
            return f"{today.year}-{str(today.year + 1)[2:]}"
        else:
            return f"{today.year - 1}-{str(today.year)[2:]}"
