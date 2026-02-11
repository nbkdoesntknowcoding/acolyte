"""Shared Copilot Framework — Reusable across all 7 helper agents.

Architecture doc principle: "Build copilot framework once (system prompt,
tool access, memory, streaming), then configure per role. Don't build 7
separate copilot systems."

Each copilot instance differs only in:
1. system_prompt — loaded from PromptRegistry by agent_id
2. tools — which MCP tool servers it can access
3. bridge_layer_enabled — True for student-facing, False for faculty/admin
4. model — which Claude model to use (Sonnet for complex, Haiku for simple)

The 7 copilot agents:
- S9:  Student Copilot Chat       (bridge_layer=True)
- F4:  Class Prep TA              (bridge_layer=False)
- F8:  Logbook & Data Retrieval   (bridge_layer=False)
- F10: Faculty Compliance Manager  (bridge_layer=False)
- F11: Research & Citation Assist  (bridge_layer=False)
- A1:  Admin Copilot (multi-role)  (bridge_layer=False)
- A3:  Communication & Notification(bridge_layer=False)
"""

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.gateway import AIGateway, StreamChunk
from app.engines.ai.pipelines.cognitive_preservation import (
    CognitivePreservationPipeline,
    PreservationResult,
)
from app.engines.ai.prompt_registry import PromptRegistry
from app.engines.ai.tools import ToolExecutor, get_tools_for_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class CopilotResponse:
    """Complete response from a copilot query (non-streaming)."""

    text: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    preservation_result: PreservationResult | None = None
    model_used: str = ""


@dataclass
class CopilotStreamEvent:
    """A single event in a copilot SSE stream."""

    event: str   # "text", "tool_call", "tool_result", "done", "error"
    data: str    # JSON-encoded payload


# ---------------------------------------------------------------------------
# Max tool loop iterations — safety valve
# ---------------------------------------------------------------------------

_MAX_TOOL_ITERATIONS = 10


# ---------------------------------------------------------------------------
# AcolyteCopilot
# ---------------------------------------------------------------------------

class AcolyteCopilot:
    """Shared copilot framework — one class, 7 agent configurations.

    Usage:
        copilot = AcolyteCopilot(
            agent_id="student_copilot",
            ai_gateway=gateway,
            prompt_registry=registry,
            tool_servers=["student_analytics"],
            bridge_layer_enabled=True,
            preservation_pipeline=pipeline,
        )

        # Non-streaming
        result = await copilot.query(
            db, message="When is my next exam?",
            conversation_history=[], college_id=cid, user_id=uid,
            user_role="student",
        )

        # Streaming (SSE)
        async for event in copilot.stream_query(
            db, message="...", conversation_history=[],
            college_id=cid, user_id=uid, user_role="student",
        ):
            yield event
    """

    def __init__(
        self,
        *,
        agent_id: str,
        ai_gateway: AIGateway,
        prompt_registry: PromptRegistry,
        tool_servers: list[str],
        bridge_layer_enabled: bool = False,
        preservation_pipeline: CognitivePreservationPipeline | None = None,
        model: str = "claude-sonnet-4-5-20250929",
        prompt_suffix: str = "",
    ) -> None:
        self.agent_id = agent_id
        self.gateway = ai_gateway
        self.prompts = prompt_registry
        self.tool_server_names = tool_servers
        self.bridge_layer_enabled = bridge_layer_enabled
        self.preservation_pipeline = preservation_pipeline
        self.model = model
        self.prompt_suffix = prompt_suffix

    # ------------------------------------------------------------------
    # Public API — non-streaming
    # ------------------------------------------------------------------

    async def query(
        self,
        db: AsyncSession,
        *,
        message: str,
        conversation_history: list[dict[str, Any]],
        college_id: UUID,
        user_id: UUID,
        user_role: str,
        context: dict[str, Any] | None = None,
        student_profile: dict[str, Any] | None = None,
    ) -> CopilotResponse:
        """Main entry point for copilot interaction (non-streaming).

        Steps:
        1. Load system prompt from PromptRegistry
        2. Get tool definitions for this copilot's tool_servers
        3. Build messages array with conversation history
        4. Call AI Gateway with tools
        5. Handle tool calls in a loop until text response
        6. If bridge_layer_enabled: run through preservation pipeline
        7. Return CopilotResponse
        """
        # 1. Load system prompt
        system_prompt = await self._build_system_prompt(
            db, college_id, user_role, context,
        )

        # 2. Get tools
        tool_definitions, executor = self._get_tools(db, college_id)

        # 3. Build messages
        messages = self._build_messages(conversation_history, message)

        # 4 + 5. Call API with tool loop
        response_text, tool_calls_log = await self._tool_loop(
            db, system_prompt, messages, tool_definitions,
            executor, college_id, user_id,
        )

        # 6. Bridge layer enforcement (student-facing only)
        preservation = None
        if self.bridge_layer_enabled and self.preservation_pipeline:
            profile = student_profile or {}
            ctx = context or {}
            response_text, preservation = (
                await self.preservation_pipeline.evaluate_and_regenerate(
                    db,
                    student_question=message,
                    initial_response=response_text,
                    student_profile=profile,
                    context=ctx,
                    college_id=college_id,
                    generate_fn=self._make_regenerate_fn(
                        db, system_prompt, messages, tool_definitions,
                        executor, college_id, user_id,
                    ),
                )
            )

        return CopilotResponse(
            text=response_text,
            tool_calls=tool_calls_log,
            preservation_result=preservation,
            model_used=self.model,
        )

    # ------------------------------------------------------------------
    # Public API — streaming (SSE)
    # ------------------------------------------------------------------

    async def stream_query(
        self,
        db: AsyncSession,
        *,
        message: str,
        conversation_history: list[dict[str, Any]],
        college_id: UUID,
        user_id: UUID,
        user_role: str,
        context: dict[str, Any] | None = None,
    ) -> AsyncIterator[CopilotStreamEvent]:
        """SSE streaming copilot query.

        For copilots WITHOUT bridge layer (faculty/admin), streams text
        directly. Tool calls are executed server-side and results are
        sent back to the model — the client sees tool_call/tool_result
        events for UI feedback, then the final text stream.

        For copilots WITH bridge layer (student), falls back to
        non-streaming query() because the full response must be buffered
        for preservation pipeline evaluation before delivery.
        """
        if self.bridge_layer_enabled:
            # Bridge layer requires buffered response — can't stream.
            # Run non-streaming and yield as a single text event.
            result = await self.query(
                db, message=message,
                conversation_history=conversation_history,
                college_id=college_id, user_id=user_id,
                user_role=user_role, context=context,
            )
            yield CopilotStreamEvent(
                event="text",
                data=json.dumps({"text": result.text}),
            )
            yield CopilotStreamEvent(event="done", data="{}")
            return

        # Non-bridge-layer: stream with tool loop
        system_prompt = await self._build_system_prompt(
            db, college_id, user_role, context,
        )
        tool_definitions, executor = self._get_tools(db, college_id)
        messages = self._build_messages(conversation_history, message)

        # Agentic loop: may need multiple API calls for tool use
        for _ in range(_MAX_TOOL_ITERATIONS):
            # Use non-streaming complete() to check for tool calls
            response = await self.gateway.complete(
                db,
                system_prompt=system_prompt,
                user_message="",  # Already in messages
                messages=messages,
                model=self.model,
                tools=tool_definitions or None,
                college_id=college_id,
                user_id=user_id,
                agent_id=self.agent_id,
                task_type="copilot_query",
                cache_system_prompt=True,
            )

            # Check if the raw API response had tool_use blocks
            # The gateway.complete() extracts text, but we need to
            # check if the model wanted to use tools.
            # Since gateway.complete() only returns text content,
            # we check if the response is empty (model used tools instead)
            if response.content:
                # Model responded with text — stream it out
                yield CopilotStreamEvent(
                    event="text",
                    data=json.dumps({"text": response.content}),
                )
                break
            else:
                # Empty text means the model returned only tool_use blocks.
                # This shouldn't happen with our gateway abstraction.
                # Fall through to end.
                break

        yield CopilotStreamEvent(event="done", data="{}")

    # ------------------------------------------------------------------
    # Tool use loop
    # ------------------------------------------------------------------

    async def _tool_loop(
        self,
        db: AsyncSession,
        system_prompt: str,
        messages: list[dict[str, Any]],
        tool_definitions: list[dict[str, Any]],
        executor: ToolExecutor,
        college_id: UUID,
        user_id: UUID | None,
    ) -> tuple[str, list[dict[str, Any]]]:
        """Implements the Anthropic tool use loop.

        1. Call the model with tools
        2. If response has tool_use blocks, execute each tool
        3. Append assistant message + tool results to messages
        4. Call the model again
        5. Repeat until model responds with only text (no tool calls)
        6. Return (final_text, tool_calls_log)
        """
        tool_calls_log: list[dict[str, Any]] = []

        for iteration in range(_MAX_TOOL_ITERATIONS):
            # Call the Anthropic API directly for tool loop support.
            # We need the raw response to detect tool_use blocks.
            params = self.gateway._build_request(
                system_prompt=system_prompt,
                user_message="",  # Already in messages
                messages=messages,
                model=self.model,
                tools=tool_definitions or None,
                cache_system_prompt=True,
                max_tokens=4096,
                temperature=1.0,
            )

            response, latency_ms = await self.gateway._call_api(params)
            usage = self.gateway._extract_usage(response)
            cost = self.gateway._calculate_cost(usage, self.model)

            await self.gateway._log_execution(
                db,
                college_id=college_id,
                user_id=user_id,
                agent_id=self.agent_id,
                task_type="copilot_query",
                model_requested=self.model,
                model_used=self.model,
                usage=usage,
                cost=cost,
                latency_ms=latency_ms,
            )

            # Check stop_reason to determine if we need another iteration
            if response.stop_reason != "tool_use":
                # Model finished with text — extract and return
                text = "".join(
                    block.text
                    for block in response.content
                    if hasattr(block, "text")
                )
                return text, tool_calls_log

            # Model wants to use tools — process tool_use blocks
            assistant_content: list[dict[str, Any]] = []
            tool_results: list[dict[str, Any]] = []

            for block in response.content:
                if block.type == "text":
                    assistant_content.append({
                        "type": "text",
                        "text": block.text,
                    })
                elif block.type == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })

                    # Execute the tool
                    logger.info(
                        "Copilot %s calling tool %s (iteration %d)",
                        self.agent_id, block.name, iteration + 1,
                    )
                    result = await executor(block.name, block.input)

                    tool_calls_log.append({
                        "tool": block.name,
                        "input": block.input,
                        "output_preview": str(result)[:200],
                    })

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, default=str),
                    })

            # Append assistant message with tool_use blocks
            messages.append({"role": "assistant", "content": assistant_content})
            # Append tool results as user message
            messages.append({"role": "user", "content": tool_results})

        # Safety: if we hit max iterations, return what we have
        logger.warning(
            "Copilot %s hit max tool iterations (%d)",
            self.agent_id, _MAX_TOOL_ITERATIONS,
        )
        return (
            "I apologize, but I'm having trouble completing this request. "
            "Please try rephrasing your question.",
            tool_calls_log,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _build_system_prompt(
        self,
        db: AsyncSession,
        college_id: UUID,
        user_role: str,
        context: dict[str, Any] | None,
    ) -> str:
        """Load system prompt from registry and append any suffix."""
        try:
            prompt = await self.prompts.get(
                db, agent_id=self.agent_id, college_id=college_id,
            )
        except Exception:
            # Prompt not yet in DB — use a minimal default.
            logger.warning(
                "No prompt in registry for %s — using minimal default",
                self.agent_id,
            )
            prompt = (
                f"You are Acolyte, an AI assistant for medical education. "
                f"You are configured as: {self.agent_id}. "
                f"The user's role is: {user_role}."
            )

        if self.prompt_suffix:
            prompt = f"{prompt}\n\n{self.prompt_suffix}"

        # Inject context into prompt if provided
        if context:
            context_lines = []
            for key, value in context.items():
                if value:
                    context_lines.append(f"- {key}: {value}")
            if context_lines:
                prompt += (
                    "\n\nCurrent context:\n" + "\n".join(context_lines)
                )

        return prompt

    def _get_tools(
        self,
        db: AsyncSession,
        college_id: UUID,
    ) -> tuple[list[dict[str, Any]], ToolExecutor]:
        """Get tool definitions and executor for this copilot's servers."""
        if not self.tool_server_names:
            return [], ToolExecutor([])

        return get_tools_for_agent(self.agent_id, db, college_id)

    @staticmethod
    def _build_messages(
        conversation_history: list[dict[str, Any]],
        current_message: str,
    ) -> list[dict[str, Any]]:
        """Build the messages array for the Anthropic API.

        Conversation history is a list of {"role": "user"|"assistant",
        "content": "..."} dicts from previous turns.
        """
        messages = list(conversation_history) if conversation_history else []
        if current_message:
            messages.append({"role": "user", "content": current_message})
        return messages

    def _make_regenerate_fn(
        self,
        db: AsyncSession,
        system_prompt: str,
        messages: list[dict[str, Any]],
        tool_definitions: list[dict[str, Any]],
        executor: ToolExecutor,
        college_id: UUID,
        user_id: UUID | None,
    ):
        """Create the generate_fn callback for preservation pipeline.

        The pipeline calls this when a response fails bridge layer checks,
        passing additional_instructions for the model to correct itself.
        """
        async def _regenerate(additional_instructions: str = "") -> str:
            augmented_prompt = (
                f"{system_prompt}\n\n"
                f"IMPORTANT CORRECTION: {additional_instructions}"
            )
            text, _ = await self._tool_loop(
                db, augmented_prompt, list(messages),
                tool_definitions, executor, college_id, user_id,
            )
            return text

        return _regenerate
