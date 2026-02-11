"""MCP Tool Server Registry — Section L7 of architecture document.

Agents NEVER directly query databases or call external APIs. All data
access goes through these standardized tool interfaces. This module
provides the registry and the function that wires agents to their tools.

Usage in agent code:

    tool_defs, executor = get_tools_for_agent(
        "socratic_study_buddy", db_session, college_id
    )
    # Pass tool_defs to Anthropic's tools parameter
    # Call executor(tool_name, tool_input) when Claude returns a tool_use block
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.tools.base import MCPToolServer
from app.engines.ai.tools.compliance_data import ComplianceDataServer
from app.engines.ai.tools.medical_knowledge import MedicalKnowledgeServer
from app.engines.ai.tools.student_analytics import StudentAnalyticsServer

# ---------------------------------------------------------------------------
# Tool server registry — map name → class
# ---------------------------------------------------------------------------

TOOL_SERVERS: dict[str, type[MCPToolServer]] = {
    "medical_knowledge": MedicalKnowledgeServer,
    "student_analytics": StudentAnalyticsServer,
    "compliance_data": ComplianceDataServer,
}

# ---------------------------------------------------------------------------
# Agent → tool server mapping
#
# Each agent only gets access to the tool servers it needs.
# This is a security boundary: an agent cannot use tools that
# are not in its mapping.
# ---------------------------------------------------------------------------

AGENT_TOOL_MAP: dict[str, list[str]] = {
    # LangGraph agents
    "socratic_study_buddy": ["medical_knowledge", "student_analytics"],
    "practice_question_generator": ["medical_knowledge", "student_analytics"],
    "neet_pg_exam_prep": ["medical_knowledge", "student_analytics"],
    "exam_question_generator": ["medical_knowledge"],
    "flashcard_generator": ["medical_knowledge"],
    "compliance_monitor": ["compliance_data"],
    # Copilot framework agents (S9, F4, F8, F10, F11, A1, A3)
    "student_copilot": ["student_analytics"],
    "class_prep_ta": ["medical_knowledge"],
    "logbook_retrieval": ["student_analytics", "compliance_data"],
    "faculty_compliance_workload": ["compliance_data"],
    "research_assistant": ["medical_knowledge"],
    "admin_copilot": [],       # Admin tools added in Phase 4
    "communication": [],       # Communication tools added in Phase 4
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class ToolExecutor:
    """Routes tool_use calls to the correct server and method.

    Returned by get_tools_for_agent() alongside the tool definitions.
    Agents call this when Claude returns a tool_use content block.
    """

    def __init__(self, servers: list[MCPToolServer]) -> None:
        # Build name → server lookup from all tool definitions.
        self._tool_to_server: dict[str, MCPToolServer] = {}
        for server in servers:
            for tool_def in server.get_tool_definitions():
                self._tool_to_server[tool_def["name"]] = server

    async def __call__(
        self, tool_name: str, tool_input: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a tool call. Returns structured result dict."""
        server = self._tool_to_server.get(tool_name)
        if server is None:
            return {"error": f"Unknown tool: {tool_name}"}
        return await server.execute_tool(tool_name, tool_input)

    @property
    def available_tools(self) -> list[str]:
        """List of tool names this executor can handle."""
        return list(self._tool_to_server.keys())


def get_tools_for_agent(
    agent_id: str,
    db: AsyncSession,
    college_id: UUID,
) -> tuple[list[dict[str, Any]], ToolExecutor]:
    """Get (tool_definitions, tool_executor) for a given agent.

    Returns:
        tool_definitions: List of Anthropic-compatible tool dicts,
            ready to pass to messages.create(tools=...).
        executor: Callable that routes tool_use calls to the correct
            server. Call as: result = await executor(tool_name, tool_input).

    Raises:
        ValueError: If agent_id is not in AGENT_TOOL_MAP.
    """
    server_names = AGENT_TOOL_MAP.get(agent_id)
    if server_names is None:
        raise ValueError(
            f"Unknown agent_id: {agent_id}. "
            f"Known agents: {list(AGENT_TOOL_MAP.keys())}"
        )

    # Instantiate the servers this agent needs.
    servers: list[MCPToolServer] = []
    for name in server_names:
        server_cls = TOOL_SERVERS.get(name)
        if server_cls is None:
            raise ValueError(
                f"Unknown tool server: {name}. "
                f"Known servers: {list(TOOL_SERVERS.keys())}"
            )
        servers.append(server_cls(db=db, college_id=college_id))

    # Collect all tool definitions from all servers.
    tool_definitions: list[dict[str, Any]] = []
    for server in servers:
        tool_definitions.extend(server.get_tool_definitions())

    return tool_definitions, ToolExecutor(servers)
