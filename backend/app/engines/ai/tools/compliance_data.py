"""ComplianceDataServer — attendance, faculty MSR, compliance alerts.

Used by: C1 (Compliance Monitoring Supervisor), C5 (Discrepancy Detection),
C6 (Audit Officer Agent).

NOTE: These are stubs that return placeholder data. The real implementations
will call into the Compliance Engine's existing data layer when it's built.
The tool INTERFACES are final — only internals will change.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.tools.base import MCPToolServer


class ComplianceDataServer(MCPToolServer):
    """Attendance data, faculty MSR status, compliance alerts."""

    server_name = "compliance_data"

    def get_tool_definitions(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "get_attendance_summary",
                "description": (
                    "Get attendance statistics for a department or the entire "
                    "college, compared against NMC 75% threshold. Returns "
                    "aggregated attendance rates by faculty/student category "
                    "and flags any below-threshold records.\n\nReturns: "
                    "Attendance percentages with NMC compliance status."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "department_id": {
                            "type": "string",
                            "description": (
                                "Optional: UUID of specific department. "
                                "Omit for college-wide summary."
                            ),
                        },
                        "period": {
                            "type": "string",
                            "enum": [
                                "current_month",
                                "last_month",
                                "current_semester",
                            ],
                            "description": (
                                "Time period for attendance data "
                                "(default: current_month)"
                            ),
                        },
                        "person_type": {
                            "type": "string",
                            "enum": ["faculty", "student", "all"],
                            "description": (
                                "Filter by person type (default: all)"
                            ),
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            },
            {
                "name": "get_faculty_msr_status",
                "description": (
                    "Get faculty counts versus NMC Minimum Standard "
                    "Requirements (MSR 2023) per department. Returns "
                    "required vs actual faculty counts by designation "
                    "(Professor, Associate Professor, Assistant Professor) "
                    "and flags departments that are below MSR.\n\nReturns: "
                    "Department-wise MSR compliance with shortfall details."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "department_id": {
                            "type": "string",
                            "description": (
                                "Optional: UUID of specific department. "
                                "Omit for all departments."
                            ),
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            },
            {
                "name": "get_compliance_alerts",
                "description": (
                    "Get current active compliance alerts for the college. "
                    "Includes faculty MSR breaches, attendance shortfalls, "
                    "upcoming faculty retirements, and inspection readiness "
                    "warnings.\n\nReturns: List of alerts with severity, "
                    "description, and recommended actions."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "severity": {
                            "type": "string",
                            "enum": ["critical", "warning", "info", "all"],
                            "description": (
                                "Filter by alert severity (default: all)"
                            ),
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            },
        ]

    # ------------------------------------------------------------------
    # Tool implementations (stubs — will call Compliance Engine later)
    # ------------------------------------------------------------------

    async def _tool_get_attendance_summary(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Stub: returns placeholder attendance data.

        Will be replaced with real queries against attendance_records
        table when the Integration Engine (AEBAS) is built.
        """
        department_id = params.get("department_id")
        period = params.get("period", "current_month")
        person_type = params.get("person_type", "all")

        # TODO: Replace with real queries from compliance/integration engine.
        return {
            "college_id": str(self.college_id),
            "department_id": department_id,
            "period": period,
            "person_type": person_type,
            "summary": {
                "total_expected_days": 0,
                "total_present_days": 0,
                "attendance_rate": 0.0,
                "nmc_threshold": 0.75,
                "compliant": True,
            },
            "below_threshold": [],
            "note": (
                "Stub data — real implementation will query "
                "attendance_records via Integration Engine."
            ),
        }

    async def _tool_get_faculty_msr_status(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Stub: returns placeholder MSR compliance data.

        Will be replaced with real queries joining departments,
        faculty, and nmc_msr_thresholds tables.
        """
        department_id = params.get("department_id")

        # TODO: Replace with real queries from admin/compliance engine.
        return {
            "college_id": str(self.college_id),
            "department_id": department_id,
            "departments": [],
            "total_shortfall": 0,
            "note": (
                "Stub data — real implementation will query faculty "
                "roster against NMC MSR 2023 thresholds."
            ),
        }

    async def _tool_get_compliance_alerts(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Stub: returns placeholder compliance alerts.

        Will be replaced with real queries against msr_alerts,
        compliance_snapshots, and derived alerting logic.
        """
        severity = params.get("severity", "all")

        # TODO: Replace with real queries from compliance engine.
        return {
            "college_id": str(self.college_id),
            "severity_filter": severity,
            "alerts": [],
            "total_alerts": 0,
            "note": (
                "Stub data — real implementation will query "
                "msr_alerts and compliance_snapshots."
            ),
        }
