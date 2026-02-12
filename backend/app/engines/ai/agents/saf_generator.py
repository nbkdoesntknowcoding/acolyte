"""SAF Auto-Generation — Section C2 of architecture document.

Template-driven document generator for compliance forms (SAF-AI, AII, AIII,
NAAC SSR, NBA SAR, etc.). The form structure (sections, fields, data
mappings) comes from SAFTemplate records in the database — NEVER hardcoded.

Jason will create the actual SAF templates after his NMC audit. This
framework can generate ANY compliance document from a template.

Architecture:
1. Load SAFTemplate with all sections and field definitions
2. For each section, for each field:
   a. If field.data_source is configured → use ComplianceDataFetcher
   b. If field.requires_narrative → use Sonnet to generate text from data
   c. If field has no data source → mark as "MANUAL_ENTRY_REQUIRED"
3. Compile all sections into document structure
4. Generate document summary (Sonnet)
5. Identify all data gaps
6. Set requires_human_review = True (always for compliance docs)
7. Return draft with auto-filled + manual-entry fields clearly marked

PRINCIPLE: Every field definition, section structure, and narrative prompt
comes from the template — never hardcoded. The engine works with any
template structure.
"""

import logging
from datetime import datetime, timezone
from typing import Any, TypedDict
from uuid import UUID

from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.memory import MemorySaver
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.agents.compliance_monitor import ComplianceDataFetcher
from app.engines.ai.agents.saf_schemas import (
    ComplianceDocumentResult,
    FilledField,
    FilledSection,
)
from app.engines.ai.gateway import AIGateway
from app.engines.ai.models import AgentExecution, ExecutionStatus
from app.engines.compliance.models import (
    ComplianceDocumentDraft,
    SAFTemplate,
)

logger = logging.getLogger(__name__)

AGENT_ID = "saf_generator"


# ═══════════════════════════════════════════════════════════════════════════
# SAFGenerator — template-driven document generation
# ═══════════════════════════════════════════════════════════════════════════

class SAFGenerator:
    """Template-driven document generator for compliance forms.

    The form structure (sections, fields, data mappings) comes from
    SAFTemplate records in the database — NOT hardcoded.

    Jason will create the actual SAF templates after his NMC audit.
    This framework can generate ANY compliance document from a template.
    """

    def __init__(
        self,
        gateway: AIGateway,
        fetcher: ComplianceDataFetcher | None = None,
    ) -> None:
        self._gateway = gateway
        self._fetcher = fetcher or ComplianceDataFetcher()

    async def generate_document(
        self,
        db: AsyncSession,
        *,
        college_id: UUID,
        template_id: UUID,
        parameters: dict[str, Any] | None = None,
        requested_by: UUID,
        academic_year: str | None = None,
    ) -> ComplianceDocumentResult:
        """Generate a compliance document from a template.

        Steps:
        1. Load SAFTemplate with all sections and field definitions
        2. For each section, fill fields from data sources or mark as manual
        3. Generate narrative text for narrative fields (Sonnet)
        4. Compile all sections into document structure
        5. Calculate auto-fill percentage and identify data gaps

        Returns ComplianceDocumentResult with all filled and unfilled fields.
        """
        # Load template
        result = await db.execute(
            select(SAFTemplate).where(SAFTemplate.id == template_id),
        )
        template = result.scalars().first()

        if not template:
            raise ValueError(f"Template {template_id} not found")

        if not template.is_active:
            raise ValueError(
                f"Template {template.template_code} is deactivated"
            )

        params = parameters or {}

        # Process each section
        filled_sections: list[FilledSection] = []
        all_data_gaps: list[dict[str, Any]] = []
        total_fields = 0
        auto_filled = 0
        manual_required = 0
        narrative_count = 0

        sections = template.sections or []
        for section_def in sorted(sections, key=lambda s: s.get("order", 0)):
            filled = await self._fill_section(
                db,
                section_def=section_def,
                college_id=college_id,
                parameters=params,
            )
            filled_sections.append(filled)

            total_fields += len(filled.fields)
            auto_filled += filled.auto_filled_count
            manual_required += filled.manual_required_count
            narrative_count += filled.narrative_count

            # Collect data gaps
            for field in filled.fields:
                if field.source == "manual_entry_required":
                    all_data_gaps.append({
                        "section_code": section_def.get("section_code"),
                        "field_code": field.field_code,
                        "label": field.label,
                        "field_type": field.field_type,
                        "help_text": field.error_message,
                    })

        # Generate narratives via LLM
        narrative_sections: dict[str, str] = {}
        for section in filled_sections:
            for field in section.fields:
                if field.source == "narrative_generated" and field.value:
                    narrative_sections[field.field_code] = str(field.value)

        # Calculate auto-fill percentage
        auto_fill_pct = (
            round(auto_filled / total_fields * 100, 1)
            if total_fields > 0 else 0.0
        )

        # Build filled_data dict keyed by field_code
        filled_data: dict[str, Any] = {}
        for section in filled_sections:
            for field in section.fields:
                if field.value is not None:
                    filled_data[field.field_code] = field.value

        # Create the draft record
        draft = ComplianceDocumentDraft(
            college_id=college_id,
            template_id=template_id,
            academic_year=academic_year,
            status="draft",
            filled_data=filled_data,
            data_gaps=all_data_gaps if all_data_gaps else None,
            auto_fill_percentage=auto_fill_pct,
            narrative_sections=narrative_sections if narrative_sections else None,
            generated_by=requested_by,
            generated_at=datetime.now(timezone.utc),
        )
        db.add(draft)
        await db.flush()

        return ComplianceDocumentResult(
            draft_id=str(draft.id),
            template_code=template.template_code,
            template_title=template.title,
            academic_year=academic_year,
            status="draft",
            sections=filled_sections,
            auto_fill_percentage=auto_fill_pct,
            total_fields=total_fields,
            auto_filled_fields=auto_filled,
            manual_required_fields=manual_required,
            narrative_fields=narrative_count,
            data_gaps=all_data_gaps,
        )

    async def _fill_section(
        self,
        db: AsyncSession,
        *,
        section_def: dict[str, Any],
        college_id: UUID,
        parameters: dict[str, Any],
    ) -> FilledSection:
        """Fill a single template section using configured data sources."""
        section_code = section_def.get("section_code", "?")
        title = section_def.get("title", "Untitled")
        order = section_def.get("order", 0)
        fields_def = section_def.get("fields", [])

        filled_fields: list[FilledField] = []
        auto_count = 0
        manual_count = 0
        narrative_count = 0

        for field_def in fields_def:
            filled = await self._fill_field(
                db,
                field_def=field_def,
                college_id=college_id,
                parameters=parameters,
            )
            filled_fields.append(filled)

            if filled.source == "auto_filled":
                auto_count += 1
            elif filled.source == "narrative_generated":
                auto_count += 1
                narrative_count += 1
            elif filled.source == "manual_entry_required":
                manual_count += 1

        return FilledSection(
            section_code=section_code,
            title=title,
            order=order,
            fields=filled_fields,
            auto_filled_count=auto_count,
            manual_required_count=manual_count,
            narrative_count=narrative_count,
        )

    async def _fill_field(
        self,
        db: AsyncSession,
        *,
        field_def: dict[str, Any],
        college_id: UUID,
        parameters: dict[str, Any],
    ) -> FilledField:
        """Fill a single field using its configured data source."""
        field_code = field_def.get("field_code", "?")
        label = field_def.get("label", "")
        field_type = field_def.get("field_type", "text")
        data_source = field_def.get("data_source")
        query_config = field_def.get("data_query_config") or {}
        requires_narrative = field_def.get("requires_narrative", False)
        narrative_prompt = field_def.get("narrative_prompt")

        # No data source configured — mark for manual entry
        if not data_source and not requires_narrative:
            return FilledField(
                field_code=field_code,
                label=label,
                field_type=field_type,
                value=None,
                source="manual_entry_required",
                error_message=field_def.get(
                    "help_text", "No data source configured — manual entry required",
                ),
            )

        # Narrative-only field (no data source, but AI generates text)
        if requires_narrative and not data_source:
            if narrative_prompt:
                try:
                    text = await self._generate_narrative(
                        db,
                        data_points=parameters,
                        narrative_prompt=narrative_prompt,
                        college_id=college_id,
                    )
                    return FilledField(
                        field_code=field_code,
                        label=label,
                        field_type=field_type,
                        value=text,
                        source="narrative_generated",
                    )
                except Exception as e:
                    logger.warning(
                        "Narrative generation failed for %s: %s",
                        field_code, e,
                    )
            return FilledField(
                field_code=field_code,
                label=label,
                field_type=field_type,
                value=None,
                source="manual_entry_required",
                error_message="Narrative generation requires data — "
                              "fill related fields first",
            )

        # Has a data source — try to fetch
        # Merge parameters into query config
        merged_config = {**query_config, **parameters}

        fetch_result = await self._fetcher.fetch(
            db,
            source_type=data_source.split(".")[0] if "." in data_source else data_source,
            query_config=merged_config,
            college_id=college_id,
        )

        if fetch_result.status == "ok" and fetch_result.value is not None:
            value = fetch_result.value

            # If field also requires narrative, generate it from the data
            if requires_narrative and narrative_prompt:
                try:
                    narrative = await self._generate_narrative(
                        db,
                        data_points={"value": value, "field": label, **parameters},
                        narrative_prompt=narrative_prompt,
                        college_id=college_id,
                    )
                    return FilledField(
                        field_code=field_code,
                        label=label,
                        field_type=field_type,
                        value=narrative,
                        source="narrative_generated",
                        data_source_used=data_source,
                    )
                except Exception as e:
                    logger.warning(
                        "Narrative generation failed for %s, "
                        "falling back to raw data: %s",
                        field_code, e,
                    )

            return FilledField(
                field_code=field_code,
                label=label,
                field_type=field_type,
                value=value,
                source="auto_filled",
                data_source_used=data_source,
            )

        # Data source failed — mark for manual entry
        return FilledField(
            field_code=field_code,
            label=label,
            field_type=field_type,
            value=None,
            source="manual_entry_required",
            data_source_used=data_source,
            error_message=(
                f"Data source '{data_source}' returned "
                f"{fetch_result.status}: {fetch_result.message}"
            ),
        )

    async def _generate_narrative(
        self,
        db: AsyncSession,
        *,
        data_points: dict[str, Any],
        narrative_prompt: str,
        college_id: UUID,
    ) -> str:
        """Generate professional narrative text from data.

        Uses Sonnet with the narrative_prompt from the template.
        The prompt is defined by Jason in the template — never hardcoded.
        """
        system_prompt = (
            "You are a compliance document writer for an Indian medical "
            "college. Generate professional, factual narrative text for "
            "regulatory compliance forms (NMC SAF, NAAC SSR, NBA SAR). "
            "Write in formal third-person prose. Be precise with numbers "
            "and facts. Do not include information not present in the data."
        )

        # Build user message from template's narrative_prompt + data
        data_summary = "\n".join(
            f"- {k}: {v}" for k, v in data_points.items()
            if v is not None
        )
        user_message = (
            f"Instruction: {narrative_prompt}\n\n"
            f"Available data:\n{data_summary}\n\n"
            f"Generate the narrative text. Keep it concise and factual."
        )

        response = await self._gateway.complete(
            db,
            system_prompt=system_prompt,
            user_message=user_message,
            model="claude-sonnet-4-5-20250929",
            college_id=college_id,
            agent_id=AGENT_ID,
            task_type="saf_generation",
            cache_system_prompt=True,
            max_tokens=1024,
            temperature=0.3,
        )

        return response.content


# ═══════════════════════════════════════════════════════════════════════════
# LangGraph Supervisor — orchestrates the full generation pipeline
# ═══════════════════════════════════════════════════════════════════════════

class SAFGeneratorState(TypedDict):
    """LangGraph state for the SAF generation supervisor."""

    # Input
    college_id: str
    template_id: str
    academic_year: str | None
    parameters: dict
    requested_by: str

    # Processing
    template_code: str
    template_title: str
    sections: list[dict]
    filled_data: dict
    data_gaps: list[dict]
    narrative_sections: dict
    auto_fill_percentage: float
    total_fields: int
    auto_filled_fields: int
    manual_required_fields: int

    # Report
    document_summary: str

    # Output
    execution_id: str
    draft_id: str


async def fill_template(
    state: SAFGeneratorState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
) -> dict:
    """Node 1: Load template and fill all fields.

    Uses SAFGenerator to process each section and field.
    Data fetching is deterministic; narrative generation uses Sonnet.
    """
    college_id = UUID(state["college_id"])
    template_id = UUID(state["template_id"])

    generator = SAFGenerator(gateway)
    result = await generator.generate_document(
        db,
        college_id=college_id,
        template_id=template_id,
        parameters=state.get("parameters", {}),
        requested_by=UUID(state["requested_by"]),
        academic_year=state.get("academic_year"),
    )

    return {
        "template_code": result.template_code,
        "template_title": result.template_title,
        "sections": [s.model_dump() for s in result.sections],
        "filled_data": {
            f.field_code: f.value
            for section in result.sections
            for f in section.fields
            if f.value is not None
        },
        "data_gaps": result.data_gaps,
        "narrative_sections": {
            f.field_code: str(f.value)
            for section in result.sections
            for f in section.fields
            if f.source == "narrative_generated" and f.value
        },
        "auto_fill_percentage": result.auto_fill_percentage,
        "total_fields": result.total_fields,
        "auto_filled_fields": result.auto_filled_fields,
        "manual_required_fields": result.manual_required_fields,
        "draft_id": result.draft_id,
    }


async def generate_summary(
    state: SAFGeneratorState,
    *,
    db: AsyncSession,
    gateway: AIGateway,
) -> dict:
    """Node 2: Generate a document summary via Sonnet.

    Creates a brief executive summary of the generated document,
    highlighting auto-fill coverage and data gaps.
    """
    college_id = UUID(state["college_id"])

    system_prompt = (
        "You are a compliance document assistant. Generate a brief "
        "executive summary (3-5 sentences) of the generated compliance "
        "document. Highlight: (1) what was auto-filled, (2) what needs "
        "manual entry, (3) any data gaps that need attention."
    )

    user_message = (
        f"Document: {state.get('template_title', 'Compliance Form')}\n"
        f"Template: {state.get('template_code', '?')}\n"
        f"Academic Year: {state.get('academic_year', 'Not specified')}\n\n"
        f"Auto-fill: {state.get('auto_fill_percentage', 0):.1f}%\n"
        f"Total fields: {state.get('total_fields', 0)}\n"
        f"Auto-filled: {state.get('auto_filled_fields', 0)}\n"
        f"Manual required: {state.get('manual_required_fields', 0)}\n"
        f"Data gaps: {len(state.get('data_gaps', []))}\n"
    )

    gaps = state.get("data_gaps", [])
    if gaps:
        user_message += "\nFields needing manual entry:\n"
        for gap in gaps[:15]:
            user_message += f"- [{gap.get('field_code')}] {gap.get('label')}\n"

    try:
        response = await gateway.complete(
            db,
            system_prompt=system_prompt,
            user_message=user_message,
            model="claude-sonnet-4-5-20250929",
            college_id=college_id,
            agent_id=AGENT_ID,
            task_type="saf_generation",
            max_tokens=512,
            temperature=0.3,
        )
        return {"document_summary": response.content}
    except Exception as e:
        logger.error("Summary generation failed: %s", e)
        return {
            "document_summary": (
                f"Document generated with {state.get('auto_fill_percentage', 0):.1f}% "
                f"auto-fill coverage. {state.get('manual_required_fields', 0)} fields "
                f"require manual entry."
            ),
        }


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_saf_graph(
    *,
    db: AsyncSession,
    gateway: AIGateway,
) -> Any:
    """Build the SAF generation LangGraph.

    Nodes: fill_template → generate_summary → END
    """
    async def _fill(state: SAFGeneratorState) -> dict:
        return await fill_template(state, db=db, gateway=gateway)

    async def _summary(state: SAFGeneratorState) -> dict:
        return await generate_summary(state, db=db, gateway=gateway)

    graph = StateGraph(SAFGeneratorState)

    graph.add_node("fill_template", _fill)
    graph.add_node("generate_summary", _summary)

    graph.add_edge(START, "fill_template")
    graph.add_edge("fill_template", "generate_summary")
    graph.add_edge("generate_summary", END)

    return graph.compile(checkpointer=MemorySaver())


# ═══════════════════════════════════════════════════════════════════════════
# Public API — run_saf_generation
# ═══════════════════════════════════════════════════════════════════════════

async def run_saf_generation(
    db: AsyncSession,
    gateway: AIGateway,
    *,
    college_id: UUID,
    template_id: UUID,
    academic_year: str | None = None,
    parameters: dict[str, Any] | None = None,
    requested_by: UUID,
) -> ComplianceDocumentResult:
    """Generate a compliance document from a template.

    Orchestrates the LangGraph supervisor:
    1. Fill all template fields (data + narrative)
    2. Generate executive summary
    3. Save draft record

    Returns ComplianceDocumentResult with all results.
    """
    execution = AgentExecution(
        college_id=college_id,
        user_id=requested_by,
        agent_id=AGENT_ID,
        task_type="saf_generation",
        status=ExecutionStatus.RUNNING.value,
        model_requested="claude-sonnet-4-5-20250929",
        requires_human_review=True,
        request_summary=(
            f"SAF generation (template={template_id}, "
            f"year={academic_year or 'N/A'})"
        ),
        started_at=datetime.now(timezone.utc),
    )
    db.add(execution)
    await db.flush()

    initial_state: SAFGeneratorState = {
        "college_id": str(college_id),
        "template_id": str(template_id),
        "academic_year": academic_year,
        "parameters": parameters or {},
        "requested_by": str(requested_by),
        "template_code": "",
        "template_title": "",
        "sections": [],
        "filled_data": {},
        "data_gaps": [],
        "narrative_sections": {},
        "auto_fill_percentage": 0.0,
        "total_fields": 0,
        "auto_filled_fields": 0,
        "manual_required_fields": 0,
        "document_summary": "",
        "execution_id": str(execution.id),
        "draft_id": "",
    }

    graph = build_saf_graph(db=db, gateway=gateway)
    config = {"configurable": {"thread_id": f"saf_{college_id}_{template_id}"}}

    try:
        final_state = await graph.ainvoke(initial_state, config=config)

        # Update execution status
        execution.status = ExecutionStatus.AWAITING_HUMAN_REVIEW.value
        execution.human_review_status = "pending"
        execution.response_summary = final_state.get("document_summary", "")[:2000]
        execution.completed_at = datetime.now(timezone.utc)

        # Update draft with execution_id
        draft_id = final_state.get("draft_id")
        if draft_id:
            draft_result = await db.execute(
                select(ComplianceDocumentDraft).where(
                    ComplianceDocumentDraft.id == UUID(draft_id),
                )
            )
            draft = draft_result.scalars().first()
            if draft:
                draft.execution_id = execution.id

        await db.flush()

        # Reconstruct result from final state
        sections = []
        for s in final_state.get("sections", []):
            sections.append(FilledSection(**s))

        return ComplianceDocumentResult(
            draft_id=final_state.get("draft_id", ""),
            template_code=final_state.get("template_code", ""),
            template_title=final_state.get("template_title", ""),
            academic_year=academic_year,
            status="draft",
            sections=sections,
            auto_fill_percentage=final_state.get("auto_fill_percentage", 0.0),
            total_fields=final_state.get("total_fields", 0),
            auto_filled_fields=final_state.get("auto_filled_fields", 0),
            manual_required_fields=final_state.get("manual_required_fields", 0),
            narrative_fields=sum(s.narrative_count for s in sections),
            data_gaps=final_state.get("data_gaps", []),
            execution_id=str(execution.id),
        )

    except Exception as e:
        logger.error("SAF generation failed: %s", e, exc_info=True)
        execution.status = ExecutionStatus.FAILED.value
        execution.error_message = str(e)[:500]
        execution.completed_at = datetime.now(timezone.utc)
        await db.flush()
        raise
