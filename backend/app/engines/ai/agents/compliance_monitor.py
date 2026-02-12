"""Compliance Monitoring Supervisor — Section C1 of architecture document.

Rule-agnostic compliance framework with three layers:

1. ComplianceDataFetcher — pluggable data source system. Jason registers
   actual SQL queries per source type. Unregistered sources return
   "not_implemented" (data gap), not errors.

2. ComplianceRulesEngine — deterministic evaluation. Loads standards from
   the ComplianceStandard table, fetches current data, compares against
   thresholds. NO LLM calls — pure computation.

3. ComplianceMonitorSupervisor — LangGraph StateGraph orchestrator.
   Calls the rules engine for data, then uses Sonnet ONLY for
   generating human-readable report summaries (never for rule evaluation).

PRINCIPLE: Every threshold, standard code, and severity mapping comes from
the database (ComplianceStandard table), never hardcoded in Python. The
engine works with zero rules loaded (gracefully returns "no standards
configured") and with 500+ rules (no code changes needed).
"""

import logging
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
from typing import Any, TypedDict
from uuid import UUID

from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.memory import MemorySaver
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.agents.compliance_schemas import (
    ComplianceEvaluation,
    DataFetchResult,
    StandardCheckResult,
)
from app.engines.ai.gateway import AIGateway
from app.engines.ai.models import AgentExecution, ExecutionStatus
from app.engines.compliance.models import (
    ComplianceAlert,
    ComplianceCheckSnapshot,
    ComplianceStandard,
)

logger = logging.getLogger(__name__)

AGENT_ID = "compliance_monitor"


# ═══════════════════════════════════════════════════════════════════════════
# 1. ComplianceDataFetcher — pluggable data source system
# ═══════════════════════════════════════════════════════════════════════════

class ComplianceDataFetcher:
    """Pluggable data fetcher system.

    Each data_source type in ComplianceStandard has a registered fetcher
    function. Jason can add new data sources by registering a new fetcher
    via the @register decorator.

    For now, all fetchers return "not_implemented" — Jason will wire them
    to actual data tables (attendance_records, faculty roster, etc.)
    after his audit identifies available data sources.
    """

    _fetchers: dict[str, Callable] = {}

    @classmethod
    def register(cls, source_type: str):
        """Decorator to register a data fetcher for a source type.

        Usage:
            @ComplianceDataFetcher.register("attendance_records")
            async def fetch_attendance(db, query_config, college_id):
                # Query attendance table, return DataFetchResult
                ...
        """
        def decorator(func: Callable) -> Callable:
            cls._fetchers[source_type] = func
            return func
        return decorator

    @classmethod
    def get_registered_sources(cls) -> list[str]:
        """Return list of all registered data source types."""
        return list(cls._fetchers.keys())

    async def fetch(
        self,
        db: AsyncSession,
        source_type: str,
        query_config: dict[str, Any],
        college_id: UUID,
    ) -> DataFetchResult:
        """Fetch current data for a compliance standard.

        Dispatches to the registered fetcher for this source_type.
        If no fetcher is registered, returns not_implemented (data gap).
        """
        fetcher = self._fetchers.get(source_type)

        if fetcher is None:
            return DataFetchResult(
                value=None,
                status="not_implemented",
                message=(
                    f"No data fetcher registered for '{source_type}'. "
                    f"Register one via @ComplianceDataFetcher.register('{source_type}')"
                ),
            )

        try:
            result = await fetcher(db, query_config, college_id)
            if not isinstance(result, DataFetchResult):
                return DataFetchResult(
                    value=result,
                    status="ok",
                    fetched_at=datetime.now(timezone.utc),
                )
            return result
        except Exception as e:
            logger.error(
                "Data fetcher '%s' failed for college %s: %s",
                source_type, college_id, e,
            )
            return DataFetchResult(
                value=None,
                status="error",
                message=f"Fetcher error: {e}",
            )


# ---------------------------------------------------------------------------
# Placeholder fetchers — Jason replaces these with actual implementations
# ---------------------------------------------------------------------------

@ComplianceDataFetcher.register("attendance_records")
async def _fetch_attendance(
    db: AsyncSession,
    query_config: dict[str, Any],
    college_id: UUID,
) -> DataFetchResult:
    """Placeholder — returns not_implemented.

    Jason will implement: query attendance table, aggregate by
    department/batch, return percentage.
    """
    return DataFetchResult(
        value=None,
        status="not_implemented",
        message="Attendance data fetcher not yet configured. "
                "See ComplianceDataFetcher.register('attendance_records')",
    )


@ComplianceDataFetcher.register("faculty_roster")
async def _fetch_faculty_roster(
    db: AsyncSession,
    query_config: dict[str, Any],
    college_id: UUID,
) -> DataFetchResult:
    """Placeholder for faculty roster queries."""
    return DataFetchResult(
        value=None,
        status="not_implemented",
        message="Faculty roster fetcher not yet configured.",
    )


@ComplianceDataFetcher.register("infrastructure_inventory")
async def _fetch_infrastructure(
    db: AsyncSession,
    query_config: dict[str, Any],
    college_id: UUID,
) -> DataFetchResult:
    """Placeholder for infrastructure data queries."""
    return DataFetchResult(
        value=None,
        status="not_implemented",
        message="Infrastructure inventory fetcher not yet configured.",
    )


@ComplianceDataFetcher.register("student_enrollment")
async def _fetch_enrollment(
    db: AsyncSession,
    query_config: dict[str, Any],
    college_id: UUID,
) -> DataFetchResult:
    """Placeholder for student enrollment queries."""
    return DataFetchResult(
        value=None,
        status="not_implemented",
        message="Student enrollment fetcher not yet configured.",
    )


# ═══════════════════════════════════════════════════════════════════════════
# 2. ComplianceRulesEngine — deterministic evaluation
# ═══════════════════════════════════════════════════════════════════════════

class ComplianceRulesEngine:
    """Rule-agnostic compliance evaluation engine.

    DETERMINISTIC — no LLM calls. Loads rules from ComplianceStandard
    table, fetches current data based on each rule's data_query_config,
    compares against thresholds, and produces results.

    Works with zero rules (returns empty evaluation) and with 500+
    rules (no code changes needed).
    """

    def __init__(self) -> None:
        self._fetcher = ComplianceDataFetcher()

    async def load_active_standards(
        self,
        db: AsyncSession,
        *,
        category: str | None = None,
        regulatory_body: str | None = None,
    ) -> list[ComplianceStandard]:
        """Load all active standards, optionally filtered."""
        today = date.today()

        query = (
            select(ComplianceStandard)
            .where(ComplianceStandard.is_active.is_(True))
            .order_by(
                ComplianceStandard.priority.asc(),
                ComplianceStandard.category,
            )
        )

        if category:
            query = query.where(ComplianceStandard.category == category)
        if regulatory_body:
            query = query.where(
                ComplianceStandard.regulatory_body == regulatory_body
            )

        # Filter by effective date range
        query = query.where(
            (ComplianceStandard.effective_from.is_(None))
            | (ComplianceStandard.effective_from <= today)
        )
        query = query.where(
            (ComplianceStandard.effective_until.is_(None))
            | (ComplianceStandard.effective_until >= today)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    async def evaluate_standard(
        self,
        db: AsyncSession,
        standard: ComplianceStandard,
        college_id: UUID,
    ) -> StandardCheckResult:
        """Evaluate a single standard against current data.

        Steps:
        1. Fetch current value from configured data source
        2. If data unavailable → status = "data_unavailable"
        3. Compare against threshold using comparison_operator
        4. Determine status: compliant, at_risk, or non_compliant
        """
        # Fetch current data
        fetch_result = await self._fetcher.fetch(
            db,
            source_type=standard.data_source,
            query_config=standard.data_query_config or {},
            college_id=college_id,
        )

        # Data unavailable — flag as data gap, don't fail
        if fetch_result.status != "ok" or fetch_result.value is None:
            return StandardCheckResult(
                standard_id=str(standard.id),
                standard_code=standard.standard_code,
                category=standard.category,
                subcategory=standard.subcategory,
                title=standard.title,
                status="data_unavailable",
                current_value=None,
                threshold_value=standard.threshold_value,
                threshold_type=standard.threshold_type,
                comparison_operator=standard.comparison_operator,
                gap_pct=None,
                severity_if_breached=standard.severity_if_breached,
                regulatory_body=standard.regulatory_body,
                recommendation=(
                    f"Data source '{standard.data_source}' is not available. "
                    f"Configure the data fetcher to enable this check."
                ),
                data_fetch_status=fetch_result.status,
                data_fetch_message=fetch_result.message,
            )

        # Compare current value against threshold
        current_str = str(fetch_result.value)
        meets_threshold = self._compare(
            fetch_result.value,
            standard.threshold_value,
            standard.comparison_operator,
            standard.threshold_type,
        )

        gap_pct = self._calculate_gap_pct(
            fetch_result.value,
            standard.threshold_value,
            standard.threshold_type,
        )

        in_buffer = self._is_in_buffer(
            fetch_result.value,
            standard.threshold_value,
            standard.buffer_warning_pct,
            standard.threshold_type,
        )

        # Determine status
        if meets_threshold and not in_buffer:
            status = "compliant"
            recommendation = None
        elif meets_threshold and in_buffer:
            status = "at_risk"
            recommendation = (
                f"Currently meeting threshold ({current_str} vs "
                f"{standard.threshold_value}) but within "
                f"{standard.buffer_warning_pct}% buffer zone. "
                f"Monitor closely."
            )
        else:
            status = "non_compliant"
            recommendation = (
                f"Below required threshold: current {current_str}, "
                f"required {standard.comparison_operator} "
                f"{standard.threshold_value}. "
                f"Gap: {abs(gap_pct or 0):.1f}%. "
                f"Severity if not addressed: {standard.severity_if_breached}."
            )

        return StandardCheckResult(
            standard_id=str(standard.id),
            standard_code=standard.standard_code,
            category=standard.category,
            subcategory=standard.subcategory,
            title=standard.title,
            status=status,
            current_value=current_str,
            threshold_value=standard.threshold_value,
            threshold_type=standard.threshold_type,
            comparison_operator=standard.comparison_operator,
            gap_pct=gap_pct,
            severity_if_breached=standard.severity_if_breached,
            regulatory_body=standard.regulatory_body,
            recommendation=recommendation,
            data_fetch_status="ok",
        )

    async def evaluate_all(
        self,
        db: AsyncSession,
        college_id: UUID,
        *,
        category: str | None = None,
        snapshot_type: str = "manual",
    ) -> ComplianceEvaluation:
        """Run all active standards for a college.

        Returns overall status, per-standard results, data gaps, and alert count.
        """
        standards = await self.load_active_standards(
            db, category=category,
        )

        if not standards:
            return ComplianceEvaluation(
                college_id=str(college_id),
                overall_status="green",
                snapshot_date=date.today(),
                snapshot_type=snapshot_type,
                standards_checked=0,
            )

        check_results: list[StandardCheckResult] = []
        data_gaps: list[StandardCheckResult] = []

        for standard in standards:
            result = await self.evaluate_standard(db, standard, college_id)
            if result.status == "data_unavailable":
                data_gaps.append(result)
            else:
                check_results.append(result)

        # Classify overall severity
        overall_status = self.classify_severity(check_results)

        compliant = sum(
            1 for r in check_results if r.status == "compliant"
        )
        at_risk = sum(
            1 for r in check_results if r.status == "at_risk"
        )
        breached = sum(
            1 for r in check_results if r.status == "non_compliant"
        )

        return ComplianceEvaluation(
            college_id=str(college_id),
            overall_status=overall_status,
            snapshot_date=date.today(),
            snapshot_type=snapshot_type,
            standards_checked=len(check_results),
            standards_compliant=compliant,
            standards_at_risk=at_risk,
            standards_breached=breached,
            check_results=check_results,
            data_gaps=data_gaps,
        )

    def classify_severity(
        self,
        check_results: list[StandardCheckResult],
    ) -> str:
        """Determine overall severity from individual check results.

        Classification:
        - All compliant, none at_risk → "green"
        - All compliant but some at_risk → "yellow"
        - Any non_compliant with severity <= warning → "orange"
        - Any non_compliant with severity > warning → "red"
        """
        if not check_results:
            return "green"

        has_non_compliant = any(
            r.status == "non_compliant" for r in check_results
        )
        has_at_risk = any(
            r.status == "at_risk" for r in check_results
        )

        if has_non_compliant:
            high_severity = {"show_cause", "seat_reduction", "closure_risk"}
            has_critical = any(
                r.status == "non_compliant"
                and r.severity_if_breached in high_severity
                for r in check_results
            )
            return "red" if has_critical else "orange"

        if has_at_risk:
            return "yellow"

        return "green"

    # ------------------------------------------------------------------
    # Threshold comparison helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _compare(
        current: Any,
        threshold_str: str,
        operator: str,
        threshold_type: str,
    ) -> bool:
        """Compare current value against threshold."""
        if threshold_type == "boolean":
            return str(current).lower() in ("true", "1", "yes")

        if threshold_type == "min_ratio":
            try:
                parts = threshold_str.split(":")
                threshold_float = float(parts[0]) / float(parts[1])
                current_float = float(current)
            except (ValueError, ZeroDivisionError):
                return False
        else:
            try:
                current_float = float(current)
                threshold_float = float(threshold_str)
            except ValueError:
                return str(current) == threshold_str

        ops = {
            "gte": current_float >= threshold_float,
            "gt": current_float > threshold_float,
            "lte": current_float <= threshold_float,
            "lt": current_float < threshold_float,
            "eq": abs(current_float - threshold_float) < 0.001,
        }
        return ops.get(operator, current_float >= threshold_float)

    @staticmethod
    def _calculate_gap_pct(
        current: Any,
        threshold_str: str,
        threshold_type: str,
    ) -> float | None:
        """Calculate percentage gap from threshold."""
        if threshold_type == "boolean":
            return None

        try:
            if threshold_type == "min_ratio":
                parts = threshold_str.split(":")
                threshold_float = float(parts[0]) / float(parts[1])
            else:
                threshold_float = float(threshold_str)

            current_float = float(current)

            if threshold_float == 0:
                return None

            return round(
                ((current_float - threshold_float) / threshold_float) * 100, 2,
            )
        except (ValueError, ZeroDivisionError):
            return None

    @staticmethod
    def _is_in_buffer(
        current: Any,
        threshold_str: str,
        buffer_pct: float,
        threshold_type: str,
    ) -> bool:
        """Check if current value is within the warning buffer zone."""
        if threshold_type == "boolean" or buffer_pct <= 0:
            return False

        try:
            if threshold_type == "min_ratio":
                parts = threshold_str.split(":")
                threshold_float = float(parts[0]) / float(parts[1])
            else:
                threshold_float = float(threshold_str)

            current_float = float(current)
            buffer_margin = threshold_float * (buffer_pct / 100.0)

            return (
                current_float >= threshold_float
                and current_float < threshold_float + buffer_margin
            )
        except (ValueError, ZeroDivisionError):
            return False


# ═══════════════════════════════════════════════════════════════════════════
# 3. ComplianceMonitorSupervisor — LangGraph orchestrator
# ═══════════════════════════════════════════════════════════════════════════

class ComplianceMonitorState(TypedDict):
    """LangGraph state for the compliance monitoring supervisor."""

    # Input
    college_id: str
    category: str | None
    snapshot_type: str

    # Processing
    check_results: list[dict]
    data_gaps: list[dict]
    alerts: list[dict]
    overall_status: str
    standards_checked: int
    standards_compliant: int
    standards_at_risk: int
    standards_breached: int

    # Trend analysis
    trend_analysis: dict

    # Report (LLM-generated)
    report_text: str

    # Output
    execution_id: str
    snapshot_id: str


# ---------------------------------------------------------------------------
# Node functions
# ---------------------------------------------------------------------------

async def collect_data(
    state: ComplianceMonitorState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 1: Run ComplianceRulesEngine.evaluate_all().

    DETERMINISTIC — no LLM. Fetches data and evaluates all standards.
    """
    college_id = UUID(state["college_id"])
    category = state.get("category")

    engine = ComplianceRulesEngine()
    evaluation = await engine.evaluate_all(
        db, college_id,
        category=category,
        snapshot_type=state.get("snapshot_type", "manual"),
    )

    return {
        "check_results": [r.model_dump() for r in evaluation.check_results],
        "data_gaps": [g.model_dump() for g in evaluation.data_gaps],
        "overall_status": evaluation.overall_status,
        "standards_checked": evaluation.standards_checked,
        "standards_compliant": evaluation.standards_compliant,
        "standards_at_risk": evaluation.standards_at_risk,
        "standards_breached": evaluation.standards_breached,
    }


async def classify_and_alert(
    state: ComplianceMonitorState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 2: Create ComplianceAlert records for non-green items.

    DETERMINISTIC — no LLM.
    """
    college_id = UUID(state["college_id"])
    execution_id = (
        UUID(state["execution_id"]) if state.get("execution_id") else None
    )

    alerts_created: list[dict] = []

    for result in state.get("check_results", []):
        status = result.get("status", "")

        if status == "compliant":
            continue

        # Map check status to alert severity
        if status == "non_compliant":
            severity_str = result.get("severity_if_breached", "warning")
            severity_map = {
                "closure_risk": "red",
                "seat_reduction": "red",
                "show_cause": "orange",
                "warning": "yellow",
                "informational": "green",
            }
            severity = severity_map.get(severity_str, "orange")
        else:  # at_risk
            severity = "yellow"

        alert = ComplianceAlert(
            college_id=college_id,
            execution_id=execution_id,
            standard_id=(
                UUID(result["standard_id"])
                if result.get("standard_id") else None
            ),
            severity=severity,
            category=result.get("category", "unknown"),
            title=result.get("title", "Compliance Issue"),
            details=(
                f"Standard {result.get('standard_code', '?')}: "
                f"Status {status}. "
                f"Current: {result.get('current_value', 'N/A')}, "
                f"Required: {result.get('threshold_value', 'N/A')}."
            ),
            current_value=result.get("current_value"),
            threshold_value=result.get("threshold_value"),
            gap_description=(
                f"{abs(result.get('gap_pct', 0)):.1f}% gap"
                if result.get("gap_pct") is not None else None
            ),
            recommended_action=result.get("recommendation"),
            status="active",
        )
        db.add(alert)
        alerts_created.append({
            "standard_code": result.get("standard_code"),
            "severity": severity,
            "status": status,
        })

    if alerts_created:
        await db.flush()

    return {"alerts": alerts_created}


async def predict_trends(
    state: ComplianceMonitorState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 3: Simple linear trend analysis on historical snapshots.

    DETERMINISTIC — no LLM. Uses basic statistics on the last 90 days
    of ComplianceCheckSnapshot data.
    """
    college_id = UUID(state["college_id"])
    since = date.today() - timedelta(days=90)

    result = await db.execute(
        select(ComplianceCheckSnapshot)
        .where(
            ComplianceCheckSnapshot.college_id == college_id,
            ComplianceCheckSnapshot.snapshot_date >= since,
        )
        .order_by(ComplianceCheckSnapshot.snapshot_date.asc())
    )
    snapshots = result.scalars().all()

    if len(snapshots) < 3:
        return {
            "trend_analysis": {
                "data_points": [],
                "trend_direction": "insufficient_data",
                "days_of_data": len(snapshots),
                "predicted_status_30d": None,
            },
        }

    data_points = []
    for snap in snapshots:
        total = snap.standards_checked or 1
        compliant = snap.standards_compliant or 0
        data_points.append({
            "snapshot_date": snap.snapshot_date.isoformat(),
            "overall_status": snap.overall_status,
            "standards_compliant": compliant,
            "standards_at_risk": snap.standards_at_risk or 0,
            "standards_breached": snap.standards_breached or 0,
            "compliance_pct": round(compliant / total * 100, 1),
        })

    # Simple trend: compare first half avg vs second half avg
    half = len(data_points) // 2
    first_half_pct = sum(
        d["compliance_pct"] for d in data_points[:half]
    ) / max(half, 1)
    second_half_pct = sum(
        d["compliance_pct"] for d in data_points[half:]
    ) / max(len(data_points) - half, 1)

    diff = second_half_pct - first_half_pct
    if diff > 2:
        trend = "improving"
    elif diff < -2:
        trend = "declining"
    else:
        trend = "stable"

    return {
        "trend_analysis": {
            "data_points": data_points[-30:],
            "trend_direction": trend,
            "days_of_data": len(data_points),
            "predicted_status_30d": None,  # Prophet Phase 2
        },
    }


async def generate_report(
    state: ComplianceMonitorState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
) -> dict:
    """Node 4: Generate human-readable executive summary via Sonnet.

    THIS is where the LLM is used. Takes all deterministic results and
    generates a natural language report. ALWAYS sets requires_human_review.
    """
    college_id = UUID(state["college_id"])

    check_results = state.get("check_results", [])
    data_gaps = state.get("data_gaps", [])
    alerts = state.get("alerts", [])
    trend = state.get("trend_analysis", {})

    if not check_results and not data_gaps:
        return {
            "report_text": (
                "No compliance standards are currently configured. "
                "Add standards via the compliance management interface."
            ),
        }

    system_prompt = (
        "You are a compliance reporting assistant for an Indian medical "
        "college. Generate a concise executive summary of the compliance "
        "check results provided. Be factual and direct.\n\n"
        "Structure your report as:\n"
        "1. Overall Status (one line)\n"
        "2. Key Findings (bullet points, max 5)\n"
        "3. Critical Actions Required (if any non-compliant items)\n"
        "4. Data Gaps (if any standards couldn't be checked)\n"
        "5. Trend (if historical data available)\n\n"
        "Keep it under 500 words. Use plain language, not jargon."
    )

    user_message = (
        f"Overall Status: {state.get('overall_status', 'unknown')}\n"
        f"Standards Checked: {state.get('standards_checked', 0)}\n"
        f"Compliant: {state.get('standards_compliant', 0)}\n"
        f"At Risk: {state.get('standards_at_risk', 0)}\n"
        f"Breached: {state.get('standards_breached', 0)}\n"
        f"Data Gaps: {len(data_gaps)}\n"
        f"Alerts Generated: {len(alerts)}\n\n"
    )

    non_compliant = [
        r for r in check_results if r.get("status") == "non_compliant"
    ]
    if non_compliant:
        user_message += "Non-Compliant Standards:\n"
        for r in non_compliant[:10]:
            user_message += (
                f"- [{r.get('standard_code')}] {r.get('title')}: "
                f"Current {r.get('current_value')}, "
                f"Required {r.get('threshold_value')} "
                f"(Severity: {r.get('severity_if_breached')})\n"
            )

    if trend.get("trend_direction") and trend["trend_direction"] != "insufficient_data":
        user_message += (
            f"\nTrend: {trend['trend_direction']} over "
            f"{trend.get('days_of_data', 0)} days of data.\n"
        )

    try:
        response = await gateway.complete(
            db,
            system_prompt=system_prompt,
            user_message=user_message,
            model="claude-sonnet-4-5-20250929",
            college_id=college_id,
            agent_id=AGENT_ID,
            task_type="compliance_monitoring",
            cache_system_prompt=True,
            max_tokens=1024,
            temperature=0.3,
        )
        return {"report_text": response.content}
    except Exception as e:
        logger.error("Report generation failed: %s", e)
        return {
            "report_text": (
                f"Report generation failed. "
                f"Overall status: {state.get('overall_status', 'unknown')}. "
                f"Standards checked: {state.get('standards_checked', 0)}. "
                f"Breached: {state.get('standards_breached', 0)}."
            ),
        }


async def save_snapshot(
    state: ComplianceMonitorState,
    *,
    db: AsyncSession,
) -> dict:
    """Node 5: Persist ComplianceCheckSnapshot with all results."""
    college_id = UUID(state["college_id"])

    snapshot = ComplianceCheckSnapshot(
        college_id=college_id,
        snapshot_date=date.today(),
        snapshot_type=state.get("snapshot_type", "manual"),
        overall_status=state.get("overall_status", "green"),
        standards_checked=state.get("standards_checked", 0),
        standards_compliant=state.get("standards_compliant", 0),
        standards_at_risk=state.get("standards_at_risk", 0),
        standards_breached=state.get("standards_breached", 0),
        check_results=state.get("check_results"),
        data_gaps=state.get("data_gaps", []),
    )
    db.add(snapshot)
    await db.flush()

    return {"snapshot_id": str(snapshot.id)}


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_compliance_graph(
    *,
    db: AsyncSession,
    gateway: AIGateway,
) -> Any:
    """Build the compliance monitoring LangGraph.

    Nodes: collect_data → classify_and_alert → predict_trends →
           generate_report → save_snapshot → END
    """
    async def _collect(state: ComplianceMonitorState) -> dict:
        return await collect_data(state, db=db)

    async def _classify(state: ComplianceMonitorState) -> dict:
        return await classify_and_alert(state, db=db)

    async def _trends(state: ComplianceMonitorState) -> dict:
        return await predict_trends(state, db=db)

    async def _report(state: ComplianceMonitorState) -> dict:
        return await generate_report(state, db=db, gateway=gateway)

    async def _save(state: ComplianceMonitorState) -> dict:
        return await save_snapshot(state, db=db)

    graph = StateGraph(ComplianceMonitorState)

    graph.add_node("collect_data", _collect)
    graph.add_node("classify_and_alert", _classify)
    graph.add_node("predict_trends", _trends)
    graph.add_node("generate_report", _report)
    graph.add_node("save_snapshot", _save)

    graph.add_edge(START, "collect_data")
    graph.add_edge("collect_data", "classify_and_alert")
    graph.add_edge("classify_and_alert", "predict_trends")
    graph.add_edge("predict_trends", "generate_report")
    graph.add_edge("generate_report", "save_snapshot")
    graph.add_edge("save_snapshot", END)

    return graph.compile(checkpointer=MemorySaver())


# ═══════════════════════════════════════════════════════════════════════════
# Public API — run_compliance_check
# ═══════════════════════════════════════════════════════════════════════════

async def run_compliance_check(
    db: AsyncSession,
    gateway: AIGateway,
    *,
    college_id: UUID,
    category: str | None = None,
    snapshot_type: str = "manual",
    user_id: UUID | None = None,
) -> ComplianceEvaluation:
    """Run a full compliance check for a college.

    Orchestrates the LangGraph supervisor:
    1. Evaluate all active standards (deterministic)
    2. Create alerts for non-compliant items
    3. Analyze trends from historical snapshots
    4. Generate executive summary (Sonnet)
    5. Save snapshot

    Returns ComplianceEvaluation with all results.
    """
    execution = AgentExecution(
        college_id=college_id,
        user_id=user_id,
        agent_id=AGENT_ID,
        task_type="compliance_monitoring",
        status=ExecutionStatus.RUNNING.value,
        model_requested="claude-sonnet-4-5-20250929",
        requires_human_review=True,
        request_summary=f"Compliance check ({snapshot_type})",
        started_at=datetime.now(timezone.utc),
    )
    db.add(execution)
    await db.flush()

    initial_state: ComplianceMonitorState = {
        "college_id": str(college_id),
        "category": category,
        "snapshot_type": snapshot_type,
        "check_results": [],
        "data_gaps": [],
        "alerts": [],
        "overall_status": "green",
        "standards_checked": 0,
        "standards_compliant": 0,
        "standards_at_risk": 0,
        "standards_breached": 0,
        "trend_analysis": {},
        "report_text": "",
        "execution_id": str(execution.id),
        "snapshot_id": "",
    }

    graph = build_compliance_graph(db=db, gateway=gateway)
    config = {"configurable": {"thread_id": f"compliance_{college_id}"}}

    try:
        final_state = await graph.ainvoke(initial_state, config=config)

        execution.status = ExecutionStatus.AWAITING_HUMAN_REVIEW.value
        execution.human_review_status = "pending"
        execution.response_summary = final_state.get("report_text", "")[:2000]
        execution.completed_at = datetime.now(timezone.utc)
        await db.flush()

        return ComplianceEvaluation(
            college_id=str(college_id),
            overall_status=final_state.get("overall_status", "green"),
            snapshot_date=date.today(),
            snapshot_type=snapshot_type,
            standards_checked=final_state.get("standards_checked", 0),
            standards_compliant=final_state.get("standards_compliant", 0),
            standards_at_risk=final_state.get("standards_at_risk", 0),
            standards_breached=final_state.get("standards_breached", 0),
            check_results=[
                StandardCheckResult(**r)
                for r in final_state.get("check_results", [])
            ],
            data_gaps=[
                StandardCheckResult(**g)
                for g in final_state.get("data_gaps", [])
            ],
            alerts_generated=len(final_state.get("alerts", [])),
        )

    except Exception as e:
        logger.error("Compliance check failed: %s", e, exc_info=True)
        execution.status = ExecutionStatus.FAILED.value
        execution.error_message = str(e)[:500]
        execution.completed_at = datetime.now(timezone.utc)
        await db.flush()
        raise
