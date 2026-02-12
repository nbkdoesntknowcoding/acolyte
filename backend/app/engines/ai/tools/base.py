"""Base class for MCP tool servers — Section L7 of architecture document.

In our architecture, agents NEVER directly query databases or call external
APIs. All data access goes through standardized tool interfaces. This creates
clean separation, enables tool reuse across agents, and provides a single
point for access control and logging.

We implement the MCP PATTERN as Python classes within the FastAPI backend
that expose tools as Anthropic-compatible tool definitions. Agents call
these tools via Claude's tool_use capability, and our backend executes them.
"""

import logging
import time
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class MCPToolServer:
    """Base class for all MCP tool servers.

    Responsibilities:
    1. Enforce tenant isolation (college_id scoping)
    2. Provide Anthropic-compatible tool definitions
    3. Route tool_use calls to the correct method
    4. Log all tool executions with timing
    5. Handle errors gracefully (never expose internal DB details)
    """

    # Subclasses must set this to their server name.
    server_name: str = "base"

    def __init__(self, db: AsyncSession, college_id: UUID) -> None:
        self.db = db
        self.college_id = college_id

    def get_tool_definitions(self) -> list[dict[str, Any]]:
        """Returns Anthropic-compatible tool definitions for this server.

        Each dict matches the Anthropic tools API format:
        {"name": "...", "description": "...", "input_schema": {...}}

        Subclasses MUST override this.
        """
        raise NotImplementedError

    async def execute_tool(
        self, tool_name: str, tool_input: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a tool call and return structured results.

        Routes to the method named _tool_{tool_name}. For example,
        tool_name="search_medical_content" calls self._tool_search_medical_content().

        Subclasses should implement _tool_* methods, NOT override this.
        """
        method_name = f"_tool_{tool_name}"
        method = getattr(self, method_name, None)

        if method is None:
            logger.error(
                "Tool %s not found on %s", tool_name, self.server_name
            )
            return {
                "error": f"Unknown tool: {tool_name}",
                "server": self.server_name,
            }

        start_ns = time.monotonic_ns()
        try:
            result = await method(tool_input)
        except Exception:
            latency_ms = (time.monotonic_ns() - start_ns) // 1_000_000
            logger.exception(
                "Tool %s.%s failed after %dms",
                self.server_name, tool_name, latency_ms,
            )
            return {
                "error": f"Tool execution failed: {tool_name}",
                "server": self.server_name,
            }

        latency_ms = (time.monotonic_ns() - start_ns) // 1_000_000
        logger.info(
            "Tool %s.%s executed in %dms (college=%s)",
            self.server_name, tool_name, latency_ms, self.college_id,
        )

        return result
