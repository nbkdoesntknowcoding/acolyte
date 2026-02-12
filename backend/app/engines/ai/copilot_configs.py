"""Copilot Configurations — per-role settings for the 7 copilot agents.

Each config defines the agent_id, tool servers, bridge layer setting,
and any role-specific prompt suffix. The factory function `create_copilot()`
instantiates an AcolyteCopilot from a config name + dependencies.

Usage:
    from app.engines.ai.copilot_configs import create_copilot

    copilot = create_copilot(
        "student_copilot",
        ai_gateway=gateway,
        prompt_registry=registry,
        preservation_pipeline=pipeline,  # Only needed if bridge_layer=True
    )
"""

from dataclasses import dataclass, field
from typing import Any

from app.engines.ai.copilot import AcolyteCopilot
from app.engines.ai.gateway import AIGateway
from app.engines.ai.pipelines.cognitive_preservation import (
    CognitivePreservationPipeline,
)
from app.engines.ai.prompt_registry import PromptRegistry


# ---------------------------------------------------------------------------
# Config data class
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CopilotConfig:
    """Configuration for a single copilot agent."""

    agent_id: str
    tool_servers: list[str]
    bridge_layer_enabled: bool
    description: str
    model: str = "claude-sonnet-4-5-20250929"
    prompt_suffix: str = ""
    role_configs: dict[str, dict[str, Any]] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# The 7 copilot configurations
# ---------------------------------------------------------------------------

COPILOT_CONFIGS: dict[str, CopilotConfig] = {
    # S9: Student Copilot Chat — general assistant, redirects academic Qs
    "student_copilot": CopilotConfig(
        agent_id="student_copilot",
        tool_servers=["student_analytics"],
        bridge_layer_enabled=True,
        description=(
            "General student assistant. Answers logistical queries directly "
            "(exam schedule, attendance, progress). Redirects academic/medical "
            "questions to the Socratic Study Buddy (S1)."
        ),
    ),

    # F4: Class Prep Teaching Assistant
    "class_prep_ta": CopilotConfig(
        agent_id="class_prep_ta",
        tool_servers=["medical_knowledge"],
        bridge_layer_enabled=False,
        description=(
            "Faculty teaching assistant for class preparation. Provides "
            "key points, clinical cases, discussion questions, integration "
            "opportunities, and content retrieval for upcoming classes."
        ),
    ),

    # F8: Logbook & Data Retrieval
    "logbook_retrieval": CopilotConfig(
        agent_id="logbook_retrieval",
        tool_servers=["student_analytics", "compliance_data"],
        bridge_layer_enabled=False,
        description=(
            "Natural language interface for student logbook data and "
            "competency progress retrieval. Faculty can ask 'Show me "
            "Rahul's DOAP progress in Surgery' and get structured data."
        ),
    ),

    # F10: Faculty Compliance Manager
    "faculty_compliance_workload": CopilotConfig(
        agent_id="faculty_compliance_workload",
        tool_servers=["compliance_data"],
        bridge_layer_enabled=False,
        description=(
            "Helps faculty understand and manage NMC/NBA/NAAC compliance "
            "requirements. Tracks documentation checklists, deadline "
            "reminders, and compliance workload status."
        ),
    ),

    # F11: Research & Citation Assistant
    "research_assistant": CopilotConfig(
        agent_id="research_assistant",
        tool_servers=["medical_knowledge"],
        bridge_layer_enabled=False,
        description=(
            "Assists faculty with citation formatting, literature search, "
            "and research paper structuring. Searches the medical knowledge "
            "base for relevant references."
        ),
    ),

    # A1: Admin Copilot — single framework, multiple role configurations
    "admin_copilot": CopilotConfig(
        agent_id="admin_copilot",
        tool_servers=[],  # Admin-specific tools added in Phase 4
        bridge_layer_enabled=False,
        description=(
            "Multi-role admin assistant. Configuration varies by the "
            "admin user's sub-role (accounts, HR, IT, warden, library)."
        ),
        role_configs={
            "accounts": {
                "prompt_suffix": (
                    "You help accounting staff with fee calculations, "
                    "payment lookups, scholarship matching, and receipt "
                    "generation. Focus on financial data and fee structures."
                ),
                "extra_tools": [],
            },
            "hr": {
                "prompt_suffix": (
                    "You help HR staff with faculty qualifications, leave "
                    "tracking, promotion eligibility, and FDP tracking. "
                    "Focus on faculty data and NMC qualification rules."
                ),
                "extra_tools": [],
            },
            "it_admin": {
                "prompt_suffix": (
                    "You help IT admins with system health monitoring, "
                    "user management, data exports, and integration status. "
                    "Focus on system operations and user accounts."
                ),
                "extra_tools": [],
            },
            "warden": {
                "prompt_suffix": (
                    "You help hostel wardens with room allocation, mess "
                    "management, occupancy reports, and maintenance tickets. "
                    "Focus on hostel operations and student accommodation."
                ),
                "extra_tools": [],
            },
            "library": {
                "prompt_suffix": (
                    "You help librarians with book inventory tracking vs "
                    "NMC minimum requirements, journal subscriptions, usage "
                    "analytics, and library compliance standards."
                ),
                "extra_tools": [],
            },
        },
    ),

    # A3: Communication & Notification
    "communication": CopilotConfig(
        agent_id="communication",
        tool_servers=[],
        bridge_layer_enabled=False,
        description=(
            "Drafts circulars, notices, email templates, and SMS messages "
            "for administrative communication. Follows institutional tone "
            "and formatting standards."
        ),
    ),
}


# ---------------------------------------------------------------------------
# Copilot name → user role mapping
#
# Maps user roles to their default copilot. Used by the route handler
# to determine which copilot to use when the client doesn't specify.
# ---------------------------------------------------------------------------

ROLE_TO_COPILOT: dict[str, str] = {
    "student": "student_copilot",
    "faculty": "class_prep_ta",
    "hod": "class_prep_ta",
    "dean": "admin_copilot",
    "admin": "admin_copilot",
    "compliance_officer": "faculty_compliance_workload",
    "management": "admin_copilot",
}


# ---------------------------------------------------------------------------
# Factory function
# ---------------------------------------------------------------------------

def create_copilot(
    config_name: str,
    *,
    ai_gateway: AIGateway,
    prompt_registry: PromptRegistry,
    preservation_pipeline: CognitivePreservationPipeline | None = None,
    admin_sub_role: str | None = None,
) -> AcolyteCopilot:
    """Create any copilot from a config name.

    Args:
        config_name: Key in COPILOT_CONFIGS (e.g. "student_copilot").
        ai_gateway: The singleton AIGateway.
        prompt_registry: The singleton PromptRegistry.
        preservation_pipeline: Required if config has bridge_layer_enabled=True.
        admin_sub_role: For "admin_copilot" only — selects the role-specific
            prompt suffix (accounts, hr, it_admin, warden, library).

    Returns:
        Configured AcolyteCopilot instance.

    Raises:
        ValueError: If config_name not found or admin_sub_role invalid.
    """
    config = COPILOT_CONFIGS.get(config_name)
    if config is None:
        raise ValueError(
            f"Unknown copilot config: {config_name}. "
            f"Available: {list(COPILOT_CONFIGS.keys())}"
        )

    # Resolve admin role-specific config
    prompt_suffix = config.prompt_suffix
    tool_servers = list(config.tool_servers)

    if config.role_configs and admin_sub_role:
        role_cfg = config.role_configs.get(admin_sub_role)
        if role_cfg is None:
            raise ValueError(
                f"Unknown admin sub-role: {admin_sub_role}. "
                f"Available: {list(config.role_configs.keys())}"
            )
        prompt_suffix = role_cfg.get("prompt_suffix", prompt_suffix)
        extra = role_cfg.get("extra_tools", [])
        if extra:
            tool_servers.extend(extra)

    return AcolyteCopilot(
        agent_id=config.agent_id,
        ai_gateway=ai_gateway,
        prompt_registry=prompt_registry,
        tool_servers=tool_servers,
        bridge_layer_enabled=config.bridge_layer_enabled,
        preservation_pipeline=preservation_pipeline,
        model=config.model,
        prompt_suffix=prompt_suffix,
    )
