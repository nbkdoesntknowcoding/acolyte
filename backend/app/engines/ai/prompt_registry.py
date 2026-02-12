"""Versioned Prompt Registry — Section L6 of architecture document.

Every system prompt for every agent is versioned and stored in the database.
Agents NEVER hardcode their system prompts. They always call:

    registry = get_prompt_registry()
    prompt = await registry.get(db, agent_id="socratic_study_buddy", college_id=college_id)

This enables:
- A/B testing of prompt variations
- Rollback if a prompt update degrades quality
- Per-college prompt customization (college override > default)
- Audit trail (what prompt was active when content was generated)
- Evaluation-driven iteration (test → measure → update cycle)
"""

import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import PromptTemplate
from app.shared.exceptions import NotFoundException, ValidationException

# Matches {word_characters_only} — leaves {multi word} and {{escaped}} alone.
_TEMPLATE_VAR_RE = re.compile(r"\{(\w+)\}")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class PromptWithMetadata:
    """Prompt text with version info for audit logging.

    The AI Gateway uses this to record which prompt version was used
    for each AgentExecution.
    """

    prompt_text: str
    version: int
    template_id: UUID
    agent_id: str
    metadata: dict[str, Any] | None
    variables: list[str] | None


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class PromptNotFoundError(NotFoundException):
    """No prompt found for the given agent and college."""

    def __init__(self, agent_id: str, college_id: UUID | None = None):
        detail = f"agent_id={agent_id}"
        if college_id:
            detail += f", college_id={college_id}"
        super().__init__("PromptTemplate", detail)


# ---------------------------------------------------------------------------
# PromptRegistry
# ---------------------------------------------------------------------------

class PromptRegistry:
    """Centralized prompt storage and retrieval — Section L6.

    Every system prompt for every agent is versioned and stored here.
    Agents NEVER hardcode their system prompts.
    """

    # ------------------------------------------------------------------
    # 1. get — retrieve active prompt text
    # ------------------------------------------------------------------

    async def get(
        self,
        db: AsyncSession,
        *,
        agent_id: str,
        college_id: UUID | None = None,
        version: int | None = None,
    ) -> str:
        """Get the active prompt text for an agent.

        Priority chain:
        a. If specific version requested → get that exact version
        b. If college_id provided → check for college-specific active override
        c. Fallback → default active version (college_id IS NULL)
        d. Raise PromptNotFoundError if nothing found
        """
        # Specific version requested — exact lookup.
        if version is not None:
            template = await self._get_by_version(
                db, agent_id, version, college_id
            )
            if template is not None:
                return template.prompt_text
            raise PromptNotFoundError(agent_id, college_id)

        # Priority 1: college-specific active override.
        if college_id is not None:
            override = await self._get_active(db, agent_id, college_id)
            if override is not None:
                return override.prompt_text

        # Priority 2: default active version (college_id IS NULL).
        default = await self._get_active(db, agent_id, college_id=None)
        if default is not None:
            return default.prompt_text

        raise PromptNotFoundError(agent_id, college_id)

    # ------------------------------------------------------------------
    # 2. get_with_metadata — prompt + version info for audit logging
    # ------------------------------------------------------------------

    async def get_with_metadata(
        self,
        db: AsyncSession,
        *,
        agent_id: str,
        college_id: UUID | None = None,
    ) -> PromptWithMetadata:
        """Get prompt text plus version metadata for execution logging.

        Used by the AI Gateway to record which prompt version was used.
        Same priority chain as get().
        """
        template: PromptTemplate | None = None

        # Priority 1: college-specific active override.
        if college_id is not None:
            template = await self._get_active(db, agent_id, college_id)

        # Priority 2: default active version.
        if template is None:
            template = await self._get_active(db, agent_id, college_id=None)

        if template is None:
            raise PromptNotFoundError(agent_id, college_id)

        return PromptWithMetadata(
            prompt_text=template.prompt_text,
            version=template.version,
            template_id=template.id,
            agent_id=template.agent_id,
            metadata=template.metadata_,
            variables=template.variables,
        )

    # ------------------------------------------------------------------
    # 3. render — get prompt and fill template variables
    # ------------------------------------------------------------------

    async def render(
        self,
        db: AsyncSession,
        *,
        agent_id: str,
        college_id: UUID | None = None,
        variables: dict[str, str] | None = None,
    ) -> str:
        """Get the prompt and fill in template variables.

        Uses regex replacement for {variable_name} placeholders.
        Unmatched placeholders are left as-is (safe for prompts that
        contain example {placeholders} in instruction text).

        Example:
            prompt = await registry.render(
                db,
                agent_id="socratic_study_buddy",
                college_id=college_id,
                variables={
                    "student_knowledge_level": "intermediate",
                    "retrieved_passages": "...",
                },
            )
        """
        prompt_text = await self.get(
            db, agent_id=agent_id, college_id=college_id
        )

        if not variables:
            return prompt_text

        return _render_template(prompt_text, variables)

    # ------------------------------------------------------------------
    # 4. create_version — add a new prompt version
    # ------------------------------------------------------------------

    async def create_version(
        self,
        db: AsyncSession,
        *,
        agent_id: str,
        prompt_text: str,
        variables: list[str] | None = None,
        college_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> PromptTemplate:
        """Create a new prompt version. Does NOT make it active.

        Auto-increments version number based on the highest existing
        version for this agent + college_id combination.
        Call activate() separately to make it the active version.
        """
        # Get current max version.
        max_version = await self._max_version(db, agent_id, college_id)
        new_version = max_version + 1

        template = PromptTemplate(
            id=uuid4(),
            agent_id=agent_id,
            version=new_version,
            prompt_text=prompt_text,
            variables=variables,
            metadata_=metadata,
            college_id=college_id,
            is_active=False,
        )
        db.add(template)
        await db.flush()

        return template

    # ------------------------------------------------------------------
    # 5. activate — make a specific version the active one
    # ------------------------------------------------------------------

    async def activate(
        self,
        db: AsyncSession,
        *,
        agent_id: str,
        version: int,
        college_id: UUID | None = None,
    ) -> None:
        """Deactivate all versions for this agent+college, then activate
        the specified version.
        """
        college_filter = _college_filter(college_id)

        # Deactivate all currently active versions.
        await db.execute(
            update(PromptTemplate)
            .where(
                PromptTemplate.agent_id == agent_id,
                college_filter,
                PromptTemplate.is_active.is_(True),
            )
            .values(is_active=False)
        )

        # Activate the requested version.
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.agent_id == agent_id,
                PromptTemplate.version == version,
                college_filter,
            )
        )
        template = result.scalar_one_or_none()

        if template is None:
            raise PromptNotFoundError(agent_id, college_id)

        template.is_active = True
        await db.flush()

    # ------------------------------------------------------------------
    # 6. rollback — activate the previous version
    # ------------------------------------------------------------------

    async def rollback(
        self,
        db: AsyncSession,
        *,
        agent_id: str,
        college_id: UUID | None = None,
    ) -> None:
        """Activate the previous version (current_version - 1).

        Raises ValidationException if already at version 1.
        """
        current = await self._get_active(db, agent_id, college_id)

        if current is None:
            raise PromptNotFoundError(agent_id, college_id)

        if current.version <= 1:
            raise ValidationException(
                "Cannot rollback — already at version 1"
            )

        await self.activate(
            db,
            agent_id=agent_id,
            version=current.version - 1,
            college_id=college_id,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _get_active(
        db: AsyncSession,
        agent_id: str,
        college_id: UUID | None,
    ) -> PromptTemplate | None:
        """Get the active PromptTemplate for agent + college."""
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.agent_id == agent_id,
                _college_filter(college_id),
                PromptTemplate.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_by_version(
        db: AsyncSession,
        agent_id: str,
        version: int,
        college_id: UUID | None,
    ) -> PromptTemplate | None:
        """Get a specific version of a prompt."""
        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.agent_id == agent_id,
                PromptTemplate.version == version,
                _college_filter(college_id),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def _max_version(
        db: AsyncSession,
        agent_id: str,
        college_id: UUID | None,
    ) -> int:
        """Get the highest version number for agent + college."""
        result = await db.execute(
            select(func.max(PromptTemplate.version)).where(
                PromptTemplate.agent_id == agent_id,
                _college_filter(college_id),
            )
        )
        return result.scalar() or 0


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _college_filter(college_id: UUID | None):
    """Build SQLAlchemy filter for college_id, handling NULL correctly."""
    if college_id is None:
        return PromptTemplate.college_id.is_(None)
    return PromptTemplate.college_id == college_id


def _render_template(text: str, variables: dict[str, str]) -> str:
    """Replace {variable_name} placeholders with provided values.

    Only matches single-word identifiers: {word_chars_only}.
    Leaves unmatched {placeholders} as-is, which is important because
    prompts contain example text with {source_book}, {chapter}, etc.
    that should not be substituted.
    """
    def _replacer(match: re.Match) -> str:
        key = match.group(1)
        if key in variables:
            return str(variables[key])
        return match.group(0)

    return _TEMPLATE_VAR_RE.sub(_replacer, text)


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_registry = PromptRegistry()


def get_prompt_registry() -> PromptRegistry:
    """Get the singleton PromptRegistry instance.

    Usage as FastAPI dependency:
        @router.post("/chat")
        async def chat(
            registry: PromptRegistry = Depends(get_prompt_registry),
            db: AsyncSession = Depends(get_tenant_db),
        ):
            prompt = await registry.get(db, agent_id="socratic_study_buddy")
    """
    return _registry
