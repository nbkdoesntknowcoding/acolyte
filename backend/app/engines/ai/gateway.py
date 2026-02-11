"""Central AI Gateway — Section L5 of architecture document.

Every LLM call in Acolyte goes through this class. No agent, no workflow,
no background task ever calls Anthropic directly — everything routes here.

Responsibilities:
1. Budget control per college (monthly token limits)
2. Model routing and automatic fallback (sonnet → haiku on budget warning)
3. Prompt caching (Anthropic cache_control for 90% cost reduction)
4. Execution logging (every call tracked with tokens, cost, latency)
5. Batch API routing for overnight bulk operations (50% discount)
6. Retry logic (single retry on rate limit with 2s backoff)
7. Structured output via constrained decoding (guaranteed valid JSON)
"""

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Type
from uuid import UUID, uuid4

import anthropic
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import (
    AgentExecution,
    AIBudget,
    BudgetStatus,
    ExecutionStatus,
)
from app.shared.exceptions import AcolyteException, ExternalServiceException

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Tasks that bypass budget limits — never disabled even when budget exceeded.
# Compliance monitoring, safety checks, and bridge layer checks are critical
# for regulatory requirements and medical accuracy.
CRITICAL_TASKS: frozenset[str] = frozenset({
    "compliance_monitoring",
    "safety_check",
    "bridge_layer_check",
})

# Per-million-token pricing (USD). Updated when Anthropic changes prices.
MODEL_PRICING: dict[str, dict[str, Decimal]] = {
    "claude-sonnet-4-5-20250929": {
        "input": Decimal("3.00"),
        "output": Decimal("15.00"),
        "cache_read": Decimal("0.30"),       # 90% discount on input price
        "cache_creation": Decimal("3.75"),   # 1.25x input price
    },
    "claude-haiku-4-5-20251001": {
        "input": Decimal("0.80"),
        "output": Decimal("4.00"),
        "cache_read": Decimal("0.08"),       # 90% discount on input price
        "cache_creation": Decimal("1.00"),   # 1.25x input price
    },
}

# Batch API gets 50% discount on all prices.
BATCH_DISCOUNT = Decimal("0.50")

# Model downgrade mapping (sonnet → haiku when budget in warning state).
_MODEL_DOWNGRADE: dict[str, str] = {
    "claude-sonnet-4-5-20250929": "claude-haiku-4-5-20251001",
}

_PER_MILLION = Decimal("1000000")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class AIResponse:
    """Response from a non-streaming AI call."""

    content: str
    model: str
    usage: dict[str, int]
    latency_ms: int
    execution_id: UUID


@dataclass(frozen=True, slots=True)
class StreamChunk:
    """A single chunk from a streaming AI response."""

    type: str              # "text", "thinking", "end"
    text: str = ""
    thinking: str = ""


@dataclass(slots=True)
class BatchRequest:
    """A single request for Claude Batch API submission."""

    custom_id: str
    model: str
    system_prompt: str
    user_message: str
    max_tokens: int = 4096

    def to_anthropic_request(self) -> dict[str, Any]:
        """Convert to Anthropic Batch API request format."""
        return {
            "custom_id": self.custom_id,
            "params": {
                "model": self.model,
                "max_tokens": self.max_tokens,
                "system": self.system_prompt,
                "messages": [{"role": "user", "content": self.user_message}],
            },
        }


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class BudgetExceededException(AcolyteException):
    """AI budget exceeded for this college's billing period."""

    status_code = 429
    error_code = "AI_BUDGET_EXCEEDED"

    def __init__(self, college_id: UUID):
        super().__init__(
            message="AI budget exceeded for this billing period",
            details={"college_id": str(college_id)},
        )


# ---------------------------------------------------------------------------
# AIGateway
# ---------------------------------------------------------------------------

class AIGateway:
    """Central AI Gateway — Section L5.

    Every LLM call in Acolyte goes through this class.
    """

    def __init__(self, api_key: str) -> None:
        self.client = anthropic.AsyncAnthropic(api_key=api_key)

    # ------------------------------------------------------------------
    # 1. complete — non-streaming completion
    # ------------------------------------------------------------------

    async def complete(
        self,
        db: AsyncSession,
        *,
        system_prompt: str,
        user_message: str,
        messages: list[dict[str, Any]] | None = None,
        model: str = "claude-sonnet-4-5-20250929",
        tools: list[dict[str, Any]] | None = None,
        college_id: UUID,
        user_id: UUID | None = None,
        agent_id: str = "unknown",
        task_type: str = "general",
        cache_system_prompt: bool = True,
        max_tokens: int = 4096,
        temperature: float = 1.0,
    ) -> AIResponse:
        """Non-streaming completion with budget control and audit logging.

        Steps:
        a. Check college budget → raise BudgetExceededException or downgrade
        b. Build Anthropic request with prompt caching
        c. Call API with single retry on rate limit
        d. Log AgentExecution record
        e. Update AIBudget totals and status thresholds
        """
        model_requested = model
        model = await self._check_budget(db, college_id, model, task_type)

        params = self._build_request(
            system_prompt=system_prompt,
            user_message=user_message,
            messages=messages,
            model=model,
            tools=tools,
            cache_system_prompt=cache_system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        response, latency_ms = await self._call_api(params)

        content = "".join(
            block.text for block in response.content if hasattr(block, "text")
        )
        usage = self._extract_usage(response)
        cost = self._calculate_cost(usage, model)

        execution_id = await self._log_execution(
            db,
            college_id=college_id,
            user_id=user_id,
            agent_id=agent_id,
            task_type=task_type,
            model_requested=model_requested,
            model_used=model,
            usage=usage,
            cost=cost,
            latency_ms=latency_ms,
        )

        return AIResponse(
            content=content,
            model=model,
            usage=usage,
            latency_ms=latency_ms,
            execution_id=execution_id,
        )

    # ------------------------------------------------------------------
    # 2. complete_structured — constrained decoding for guaranteed JSON
    # ------------------------------------------------------------------

    async def complete_structured(
        self,
        db: AsyncSession,
        *,
        system_prompt: str,
        user_message: str,
        output_schema: Type[BaseModel],
        model: str = "claude-sonnet-4-5-20250929",
        college_id: UUID,
        user_id: UUID | None = None,
        agent_id: str = "unknown",
        task_type: str = "general",
        cache_system_prompt: bool = True,
        max_tokens: int = 4096,
        temperature: float = 1.0,
    ) -> BaseModel:
        """Constrained decoding — GUARANTEED valid JSON matching output_schema.

        The model literally cannot produce tokens that violate the schema.
        Used by every agent that produces structured data: MCQ generation,
        compliance reports, SAF forms, classifications, safety checks.
        """
        model_requested = model
        model = await self._check_budget(db, college_id, model, task_type)

        params = self._build_request(
            system_prompt=system_prompt,
            user_message=user_message,
            model=model,
            cache_system_prompt=cache_system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        # Constrained decoding: model cannot produce invalid JSON.
        # Uses Pydantic v2's model_json_schema() to generate the JSON Schema
        # that the Anthropic API enforces during token generation.
        json_schema = output_schema.model_json_schema()
        params["output"] = {
            "format": {
                "type": "json_schema",
                "json_schema": json_schema,
            }
        }

        response, latency_ms = await self._call_api(params)

        content = "".join(
            block.text for block in response.content if hasattr(block, "text")
        )
        usage = self._extract_usage(response)
        cost = self._calculate_cost(usage, model)

        await self._log_execution(
            db,
            college_id=college_id,
            user_id=user_id,
            agent_id=agent_id,
            task_type=task_type,
            model_requested=model_requested,
            model_used=model,
            usage=usage,
            cost=cost,
            latency_ms=latency_ms,
        )

        return output_schema.model_validate_json(content)

    # ------------------------------------------------------------------
    # 3. stream — SSE streaming for real-time chat
    # ------------------------------------------------------------------

    async def stream(
        self,
        db: AsyncSession,
        *,
        system_prompt: str,
        user_message: str,
        model: str = "claude-sonnet-4-5-20250929",
        college_id: UUID,
        user_id: UUID | None = None,
        agent_id: str = "unknown",
        task_type: str = "general",
        cache_system_prompt: bool = True,
        max_tokens: int = 4096,
        temperature: float = 1.0,
    ) -> AsyncIterator[StreamChunk]:
        """SSE streaming for real-time chat interfaces.

        Used by: Socratic Study Buddy (S1), Copilot Chat (S9),
        Class Prep TA (F4).

        Yields StreamChunk objects with incremental text deltas.
        After the stream completes, logs AgentExecution with final
        token counts.
        """
        model_requested = model
        model = await self._check_budget(db, college_id, model, task_type)

        params = self._build_request(
            system_prompt=system_prompt,
            user_message=user_message,
            model=model,
            cache_system_prompt=cache_system_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        start_ns = time.monotonic_ns()
        final_message = None

        try:
            async with self.client.messages.stream(**params) as stream:
                async for text in stream.text_stream:
                    yield StreamChunk(type="text", text=text)
                final_message = await stream.get_final_message()
        except anthropic.APIError as e:
            logger.error("Anthropic streaming error: %s", e)
            raise ExternalServiceException("Anthropic", str(e))

        # Log execution after stream completes
        if final_message is not None:
            latency_ms = (time.monotonic_ns() - start_ns) // 1_000_000
            usage = self._extract_usage(final_message)
            cost = self._calculate_cost(usage, model)

            await self._log_execution(
                db,
                college_id=college_id,
                user_id=user_id,
                agent_id=agent_id,
                task_type=task_type,
                model_requested=model_requested,
                model_used=model,
                usage=usage,
                cost=cost,
                latency_ms=latency_ms,
            )

        yield StreamChunk(type="end")

    # ------------------------------------------------------------------
    # 4. batch — Claude Batch API (50% discount, 24h turnaround)
    # ------------------------------------------------------------------

    async def batch(
        self,
        db: AsyncSession,
        *,
        requests: list[BatchRequest],
        college_id: UUID,
        task_type: str = "batch_processing",
    ) -> str:
        """Claude Batch API — 50% cost discount, 24-hour turnaround.

        Used for: overnight question bank generation, bulk compliance
        reports, periodic content quality audits.

        Returns the batch_id for status polling.
        """
        try:
            result = await self.client.batches.create(
                requests=[r.to_anthropic_request() for r in requests],
            )
        except anthropic.APIError as e:
            logger.error("Anthropic batch creation error: %s", e)
            raise ExternalServiceException("Anthropic", str(e))

        logger.info(
            "Batch created: id=%s, college=%s, task=%s, requests=%d",
            result.id, college_id, task_type, len(requests),
        )

        return result.id

    # ------------------------------------------------------------------
    # 5. _calculate_cost
    # ------------------------------------------------------------------

    @staticmethod
    def _calculate_cost(
        usage: dict[str, int],
        model: str,
        is_batch: bool = False,
    ) -> Decimal:
        """Calculate cost in USD from token usage and model pricing.

        Pricing per million tokens:
        - Sonnet 4.5: $3 input, $15 output
        - Haiku 4.5: $0.80 input, $4 output
        - Cached input: 90% discount (0.1x input price)
        - Cache creation: 1.25x input price
        - Batch API: 50% discount on everything
        """
        pricing = MODEL_PRICING.get(model)
        if pricing is None:
            logger.warning("No pricing for model %s — cost will be zero", model)
            return Decimal("0")

        cost = (
            Decimal(usage["input_tokens"]) * pricing["input"] / _PER_MILLION
            + Decimal(usage["output_tokens"]) * pricing["output"] / _PER_MILLION
            + Decimal(usage["cache_read_input_tokens"])
            * pricing["cache_read"] / _PER_MILLION
            + Decimal(usage["cache_creation_input_tokens"])
            * pricing["cache_creation"] / _PER_MILLION
        )

        if is_batch:
            cost *= BATCH_DISCOUNT

        return cost

    # ------------------------------------------------------------------
    # 6. _downgrade_model
    # ------------------------------------------------------------------

    @staticmethod
    def _downgrade_model(model: str) -> str:
        """Downgrade model when budget is in warning state.

        Maps sonnet → haiku. Haiku stays haiku. Logs the downgrade.
        """
        downgraded = _MODEL_DOWNGRADE.get(model, model)
        if downgraded != model:
            logger.info("Budget warning: downgrading %s → %s", model, downgraded)
        return downgraded

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_request(
        self,
        *,
        system_prompt: str,
        user_message: str,
        messages: list[dict[str, Any]] | None = None,
        model: str,
        tools: list[dict[str, Any]] | None = None,
        cache_system_prompt: bool = True,
        max_tokens: int = 4096,
        temperature: float = 1.0,
    ) -> dict[str, Any]:
        """Build Anthropic messages.create() parameters.

        When cache_system_prompt is True and the system prompt is >1024 chars,
        wraps it with cache_control={"type": "ephemeral"} for 90% cost
        reduction on repeated system prompts within a 5-minute window.
        """
        # System prompt — use cache_control for large prompts.
        if cache_system_prompt and len(system_prompt) > 1024:
            system: str | list[dict[str, Any]] = [{
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }]
        else:
            system = system_prompt

        # Messages — append user_message to provided history, or create new.
        if messages is not None:
            msgs = list(messages)
            if user_message:
                msgs.append({"role": "user", "content": user_message})
        else:
            msgs = [{"role": "user", "content": user_message}]

        params: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": msgs,
            "temperature": temperature,
        }

        if tools:
            params["tools"] = tools

        return params

    async def _call_api(
        self, params: dict[str, Any]
    ) -> tuple[Any, int]:
        """Call Anthropic messages.create() with single retry on rate limit.

        Returns (response, latency_ms).
        """
        start_ns = time.monotonic_ns()
        try:
            response = await self.client.messages.create(**params)
        except anthropic.RateLimitError:
            logger.warning("Anthropic rate limited — retrying after 2s")
            await asyncio.sleep(2)
            response = await self.client.messages.create(**params)
        except anthropic.AuthenticationError:
            logger.error("Anthropic auth failed — check ANTHROPIC_API_KEY")
            raise ExternalServiceException("Anthropic", "Authentication failed")
        except anthropic.APIError as e:
            logger.error("Anthropic API error: %s", e)
            raise ExternalServiceException("Anthropic", str(e))

        latency_ms = (time.monotonic_ns() - start_ns) // 1_000_000
        return response, latency_ms

    @staticmethod
    def _extract_usage(response: Any) -> dict[str, int]:
        """Extract token usage dict from an Anthropic response."""
        return {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "cache_read_input_tokens": getattr(
                response.usage, "cache_read_input_tokens", 0
            ) or 0,
            "cache_creation_input_tokens": getattr(
                response.usage, "cache_creation_input_tokens", 0
            ) or 0,
        }

    async def _check_budget(
        self,
        db: AsyncSession,
        college_id: UUID,
        model: str,
        task_type: str,
    ) -> str:
        """Check college AI budget, raise or downgrade model as needed.

        Returns the (possibly downgraded) model string.
        - budget_status == "exceeded" + non-critical task → raise
        - budget_status == "exceeded" + critical task → allow (logged)
        - budget_status == "warning" → downgrade sonnet → haiku
        - No budget row → no restrictions
        """
        today = date.today()
        result = await db.execute(
            select(AIBudget).where(
                AIBudget.college_id == college_id,
                AIBudget.period_start <= today,
                AIBudget.period_end >= today,
            )
        )
        budget = result.scalar_one_or_none()

        if budget is None:
            return model

        if budget.budget_status == BudgetStatus.EXCEEDED.value:
            if task_type not in CRITICAL_TASKS:
                raise BudgetExceededException(college_id)
            logger.warning(
                "Budget exceeded for college %s but task %s is critical — allowing",
                college_id, task_type,
            )

        if budget.budget_status == BudgetStatus.WARNING.value:
            model = self._downgrade_model(model)

        return model

    async def _update_budget(
        self,
        db: AsyncSession,
        college_id: UUID,
        cost: Decimal,
        usage: dict[str, int],
    ) -> None:
        """Increment budget usage and update status thresholds."""
        today = date.today()
        result = await db.execute(
            select(AIBudget).where(
                AIBudget.college_id == college_id,
                AIBudget.period_start <= today,
                AIBudget.period_end >= today,
            )
        )
        budget = result.scalar_one_or_none()

        if budget is None:
            return

        budget.used_amount_usd = budget.used_amount_usd + cost
        budget.token_count_input = budget.token_count_input + usage["input_tokens"]
        budget.token_count_output = budget.token_count_output + usage["output_tokens"]
        budget.token_count_cached = (
            budget.token_count_cached + usage["cache_read_input_tokens"]
        )

        # Update status based on thresholds.
        if budget.used_amount_usd > budget.total_budget_usd:
            budget.budget_status = BudgetStatus.EXCEEDED.value
            budget.throttled_at = budget.throttled_at or datetime.now(timezone.utc)
        elif (
            budget.used_amount_usd
            > budget.total_budget_usd * budget.warning_threshold_pct / 100
        ):
            budget.budget_status = BudgetStatus.WARNING.value

    async def _log_execution(
        self,
        db: AsyncSession,
        *,
        college_id: UUID,
        user_id: UUID | None,
        agent_id: str,
        task_type: str,
        model_requested: str,
        model_used: str,
        usage: dict[str, int],
        cost: Decimal,
        latency_ms: int,
    ) -> UUID:
        """Create AgentExecution audit record and update budget.

        Returns the execution_id.
        """
        execution_id = uuid4()
        now = datetime.now(timezone.utc)

        execution = AgentExecution(
            id=execution_id,
            college_id=college_id,
            user_id=user_id,
            agent_id=agent_id,
            task_type=task_type,
            execution_type="single_call",
            status=ExecutionStatus.COMPLETED.value,
            model_requested=model_requested,
            model_used=model_used,
            input_tokens=usage["input_tokens"],
            output_tokens=usage["output_tokens"],
            cache_read_tokens=usage["cache_read_input_tokens"],
            cache_creation_tokens=usage["cache_creation_input_tokens"],
            total_cost_usd=cost,
            latency_ms=latency_ms,
            started_at=now,
            completed_at=now,
        )
        db.add(execution)

        await self._update_budget(db, college_id, cost, usage)
        await db.flush()

        return execution_id
