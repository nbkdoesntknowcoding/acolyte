"""Central AI Engine — Public Interface.

ALL AI calls from other engines go through this interface.
ONLY this engine imports the Anthropic SDK and LangGraph.

Example usage from other engines:
    from app.engines.ai import AIGateway, AIResponse
    from app.engines.ai.gateway_deps import get_ai_gateway

Models exported for Alembic autogenerate:
    from app.engines.ai.models import PromptTemplate, AgentExecution, ...
"""

from app.engines.ai.gateway import (  # noqa: F401
    AIGateway,
    AIResponse,
    BatchRequest,
    BudgetExceededException,
    StreamChunk,
    CRITICAL_TASKS,
    MODEL_PRICING,
)
from app.engines.ai.gateway_deps import get_ai_gateway  # noqa: F401
from app.engines.ai.prompt_registry import (  # noqa: F401
    PromptNotFoundError,
    PromptRegistry,
    PromptWithMetadata,
    get_prompt_registry,
)
from app.engines.ai.tools import (  # noqa: F401
    AGENT_TOOL_MAP,
    TOOL_SERVERS,
    ToolExecutor,
    get_tools_for_agent,
)
from app.engines.ai.copilot import AcolyteCopilot, CopilotResponse  # noqa: F401
from app.engines.ai.copilot_configs import (  # noqa: F401
    COPILOT_CONFIGS,
    ROLE_TO_COPILOT,
    create_copilot,
)
from app.engines.ai.models import (  # noqa: F401
    AgentExecution,
    AgentFeedback,
    AIBudget,
    MedicalContent,
    MedicalEntity,
    MedicalEntityRelationship,
    MetacognitiveEvent,
    PromptTemplate,
    QuestionIntelligencePattern,
    SafetyCheck,
    StudentMetacognitiveProfile,
)
