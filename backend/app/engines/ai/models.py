"""Central AI Engine — SQLAlchemy Models.

11 tables powering the AI infrastructure:
1.  PromptTemplate        — Versioned prompt storage (L6)
2.  AgentExecution         — AI operation audit trail (L5)
3.  AgentFeedback          — Human corrections for improvement
4.  AIBudget               — Per-college monthly token budgets (L5)
5.  MedicalContent         — RAG knowledge base with embeddings (L1)
6.  MedicalEntity          — Knowledge graph nodes (L1 Layer 3)
7.  MedicalEntityRelationship — Knowledge graph edges (L1 Layer 3)
8.  QuestionIntelligencePattern — Faculty question patterns (L4)
9.  SafetyCheck            — Medical content validation audit (L3)
10. MetacognitiveEvent     — Raw student interaction events (S8)
11. StudentMetacognitiveProfile — Computed per-student metrics
"""

import enum
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Computed,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from pgvector.sqlalchemy import Vector

from app.shared.models import Base, TenantModel


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TaskType(str, enum.Enum):
    SOCRATIC_DIALOGUE = "socratic_dialogue"
    PRACTICE_QUESTION_GEN = "practice_question_gen"
    EXAM_QUESTION_GEN = "exam_question_gen"
    FLASHCARD_GEN = "flashcard_gen"
    RECOMMENDATION = "recommendation"
    PPT_GEN = "ppt_gen"
    COMPLIANCE_MONITORING = "compliance_monitoring"
    SAF_GENERATION = "saf_generation"
    GRADING_ASSIST = "grading_assist"
    COPILOT_QUERY = "copilot_query"
    RETRIEVAL_ROUTING = "retrieval_routing"
    SAFETY_CHECK = "safety_check"
    BRIDGE_LAYER_CHECK = "bridge_layer_check"
    CLASSIFICATION = "classification"
    BATCH_PROCESSING = "batch_processing"


class ExecutionType(str, enum.Enum):
    WORKFLOW = "workflow"
    AGENT = "agent"
    SINGLE_CALL = "single_call"


class ExecutionStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    AWAITING_HUMAN_REVIEW = "awaiting_human_review"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SafetyResult(str, enum.Enum):
    PASSED = "passed"
    FLAGGED = "flagged"
    REJECTED = "rejected"


class BridgeLayerResult(str, enum.Enum):
    PASSED = "passed"
    REGENERATED_1 = "regenerated_1"
    REGENERATED_2 = "regenerated_2"
    REGENERATED_3 = "regenerated_3"
    FALLBACK = "fallback"


class HumanReviewStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"


class FeedbackType(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"
    FLAGGED_HALLUCINATION = "flagged_hallucination"
    FLAGGED_INACCURATE = "flagged_inaccurate"
    FLAGGED_INAPPROPRIATE = "flagged_inappropriate"
    FLAGGED_ITEM_WRITING_FLAW = "flagged_item_writing_flaw"


class BudgetType(str, enum.Enum):
    MONTHLY = "monthly"


class BudgetStatus(str, enum.Enum):
    NORMAL = "normal"
    WARNING = "warning"
    EXCEEDED = "exceeded"


class SourceType(str, enum.Enum):
    TEXTBOOK = "textbook"
    GUIDELINE = "guideline"
    NMC_REGULATION = "nmc_regulation"
    LECTURE_NOTES = "lecture_notes"
    CLINICAL_PROTOCOL = "clinical_protocol"
    DRUG_DATABASE = "drug_database"
    CUSTOM_UPLOAD = "custom_upload"


class MedicalEntityType(str, enum.Enum):
    DISEASE = "disease"
    SYMPTOM = "symptom"
    DRUG = "drug"
    INVESTIGATION = "investigation"
    PROCEDURE = "procedure"
    PATHWAY = "pathway"
    CONDITION = "condition"
    COMPETENCY = "competency"
    TOPIC = "topic"
    SUBJECT = "subject"


class RelationshipType(str, enum.Enum):
    HAS_SYMPTOM = "has_symptom"
    TREATED_BY = "treated_by"
    INVESTIGATED_BY = "investigated_by"
    DIFFERENTIAL_OF = "differential_of"
    CONTRAINDICATED_IN = "contraindicated_in"
    INTERACTS_WITH = "interacts_with"
    MECHANISM = "mechanism"
    INDICATED_FOR = "indicated_for"
    COMPLICATION = "complication"
    PART_OF = "part_of"
    INTEGRATES_WITH = "integrates_with"
    COVERS = "covers"
    ASSESSED_BY = "assessed_by"
    CAUSES = "causes"
    RISK_FACTOR_FOR = "risk_factor_for"


class QuestionType(str, enum.Enum):
    MCQ = "mcq"
    SAQ = "saq"
    LAQ = "laq"
    EMQ = "emq"
    OSCE = "osce"
    VIVA = "viva"


class BloomsLevel(str, enum.Enum):
    REMEMBER = "remember"
    UNDERSTAND = "understand"
    APPLY = "apply"
    ANALYZE = "analyze"
    EVALUATE = "evaluate"
    CREATE = "create"


class VignetteStyle(str, enum.Enum):
    DETAILED_CLINICAL = "detailed_clinical"
    BRIEF_STEM = "brief_stem"
    IMAGE_BASED = "image_based"
    DATA_INTERPRETATION = "data_interpretation"


class DistractorStrategy(str, enum.Enum):
    DIFFERENTIAL_BASED = "differential_based"
    RELATED_BUT_WRONG = "related_but_wrong"
    COMMON_MISCONCEPTION = "common_misconception"
    PARTIAL_TRUTH = "partial_truth"


class SafetyCheckType(str, enum.Enum):
    SOURCE_GROUNDING = "source_grounding"
    CLINICAL_ACCURACY = "clinical_accuracy"
    ENSEMBLE_VARIANCE = "ensemble_variance"
    BIAS_DETECTION = "bias_detection"
    ITEM_WRITING_FLAW = "item_writing_flaw"
    BLOOMS_VERIFICATION = "blooms_verification"
    COGNITIVE_PRESERVATION = "cognitive_preservation"


class SafetyCheckResult(str, enum.Enum):
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"
    NEEDS_REVIEW = "needs_review"


class MetacognitiveEventType(str, enum.Enum):
    QUESTION_ANSWERED = "question_answered"
    PAGE_VIEWED = "page_viewed"
    FLASHCARD_REVIEWED = "flashcard_reviewed"
    STUDY_SESSION_STARTED = "study_session_started"
    STUDY_SESSION_ENDED = "study_session_ended"
    AI_INTERACTION = "ai_interaction"
    CONFIDENCE_RATED = "confidence_rated"
    ANSWER_CHANGED = "answer_changed"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# ---------------------------------------------------------------------------
# 1. PromptTemplate — Versioned prompt storage (L6)
#    NOT tenant-scoped. Platform-wide with optional college overrides.
# ---------------------------------------------------------------------------

class PromptTemplate(Base):
    """Versioned prompt storage for all AI agents.

    college_id = NULL → default prompt for all colleges.
    college_id = <uuid> → college-specific override.
    """
    __tablename__ = "prompt_templates"
    __table_args__ = (
        UniqueConstraint(
            "agent_id", "version", "college_id",
            name="uq_prompt_agent_version_college",
        ),
        Index(
            "ix_prompt_agent_college_active",
            "agent_id", "college_id", "is_active",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(String(100), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    prompt_text = Column(Text, nullable=False)
    variables = Column(JSONB, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    college_id = Column(
        UUID(as_uuid=True),
        ForeignKey("colleges.id"),
        nullable=True,
    )
    is_active = Column(Boolean, nullable=False, server_default="true")
    performance_metrics = Column(JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        onupdate=text("NOW()"),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# 2. AgentExecution — AI operation audit trail (L5)
#    Tenant-scoped for cost rollups.
#    NOTE: Future monthly partitioning on started_at when volume justifies it.
# ---------------------------------------------------------------------------

class AgentExecution(TenantModel):
    """Logs EVERY AI operation for observability and cost tracking."""
    __tablename__ = "agent_executions"
    __table_args__ = (
        Index(
            "ix_agent_exec_college_task_status",
            "college_id", "task_type", "status",
        ),
        Index(
            "ix_agent_exec_college_started",
            "college_id", "started_at",
        ),
        Index(
            "ix_agent_exec_agent_started",
            "agent_id", "started_at",
        ),
        Index(
            "ix_agent_exec_parent",
            "parent_execution_id",
        ),
    )

    user_id = Column(UUID(as_uuid=True), nullable=True)
    agent_id = Column(String(100), nullable=False)
    task_type = Column(String(50), nullable=False)
    execution_type = Column(String(20), nullable=True)
    status = Column(String(30), nullable=False, default=ExecutionStatus.QUEUED.value)

    prompt_template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompt_templates.id"),
        nullable=True,
    )
    prompt_version = Column(Integer, nullable=True)

    model_requested = Column(String(100), nullable=False)
    model_used = Column(String(100), nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    cache_read_tokens = Column(Integer, nullable=False, default=0)
    cache_creation_tokens = Column(Integer, nullable=False, default=0)
    total_cost_usd = Column(Numeric(10, 6), nullable=True)
    latency_ms = Column(Integer, nullable=True)

    request_summary = Column(Text, nullable=True)
    response_summary = Column(Text, nullable=True)
    tool_calls = Column(JSONB, nullable=True)

    error_message = Column(Text, nullable=True)
    error_node = Column(String(100), nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)

    safety_result = Column(String(20), nullable=True)
    bridge_layer_result = Column(String(20), nullable=True)

    requires_human_review = Column(Boolean, nullable=False, server_default="false")
    human_review_status = Column(String(20), nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    parent_execution_id = Column(
        UUID(as_uuid=True),
        ForeignKey("agent_executions.id"),
        nullable=True,
    )

    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# 3. AgentFeedback — Human corrections that improve the system
# ---------------------------------------------------------------------------

class AgentFeedback(TenantModel):
    """Human feedback on AI outputs — drives prompt improvement."""
    __tablename__ = "agent_feedback"
    __table_args__ = (
        Index("ix_agent_feedback_execution", "execution_id"),
        Index("ix_agent_feedback_college_type", "college_id", "feedback_type"),
    )

    execution_id = Column(
        UUID(as_uuid=True),
        ForeignKey("agent_executions.id"),
        nullable=False,
    )
    feedback_type = Column(String(30), nullable=False)
    original_output = Column(JSONB, nullable=True)
    corrected_output = Column(JSONB, nullable=True)
    feedback_notes = Column(Text, nullable=True)
    given_by = Column(UUID(as_uuid=True), nullable=False)
    given_at = Column(DateTime(timezone=True), nullable=False)
    used_for_improvement = Column(Boolean, nullable=False, server_default="false")


# ---------------------------------------------------------------------------
# 4. AIBudget — Per-college monthly token budget tracking (L5)
# ---------------------------------------------------------------------------

class AIBudget(TenantModel):
    """Monthly AI token budget per college."""
    __tablename__ = "ai_budgets"
    __table_args__ = (
        UniqueConstraint(
            "college_id", "period_start", "budget_type",
            name="uq_ai_budget_college_period",
        ),
    )

    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    budget_type = Column(String(20), nullable=False, default=BudgetType.MONTHLY.value)
    total_budget_usd = Column(Numeric(10, 2), nullable=False)
    used_amount_usd = Column(Numeric(10, 6), nullable=False, default=0)
    token_count_input = Column(BigInteger, nullable=False, default=0)
    token_count_output = Column(BigInteger, nullable=False, default=0)
    token_count_cached = Column(BigInteger, nullable=False, default=0)
    engine_breakdown = Column(JSONB, nullable=True)
    budget_status = Column(
        String(20), nullable=False, default=BudgetStatus.NORMAL.value,
    )
    warning_threshold_pct = Column(Integer, nullable=False, default=80)
    throttled_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# 5. MedicalContent — RAG knowledge base (L1)
#    college_id nullable: NULL = platform-wide, specific = college uploads.
#    NOT using TenantModel because college_id is optional here.
# ---------------------------------------------------------------------------

class MedicalContent(Base):
    """Medical RAG content chunks with vector embeddings.

    Platform-wide medical knowledge (college_id=NULL) and college-specific
    uploaded content (college_id=<uuid>) co-exist in this table.

    search_vector is a generated tsvector column for BM25 full-text search.
    embedding stores text-embedding-3-large vectors (1536 dimensions via
    the API dimensions parameter — Neon pgvector has 2000-dim index limit).
    """
    __tablename__ = "medical_content"
    __table_args__ = (
        Index(
            "ix_medical_content_college_entity_active",
            "college_id", "medical_entity_type", "is_active",
        ),
        Index(
            "ix_medical_content_parent_doc",
            "parent_document_id",
        ),
        # HNSW (embedding), GIN (search_vector, metadata) indexes
        # created manually in migration — Alembic doesn't auto-generate them.
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = Column(
        UUID(as_uuid=True),
        ForeignKey("colleges.id"),
        nullable=True,
    )
    source_type = Column(String(30), nullable=False)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(String(64), unique=True, nullable=False)
    embedding = Column(Vector(1536), nullable=True)
    chunk_index = Column(Integer, nullable=False)
    total_chunks = Column(Integer, nullable=False)
    parent_document_id = Column(UUID(as_uuid=True), nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    source_reference = Column(String(500), nullable=False)
    medical_entity_type = Column(String(30), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )
    # search_vector: generated tsvector column — created in migration
    # because SQLAlchemy Computed() with to_tsvector needs raw SQL in migration.


# ---------------------------------------------------------------------------
# 6. MedicalEntity — Knowledge graph nodes (L1 Layer 3)
#    NOT tenant-scoped — medical knowledge graph is platform-wide.
# ---------------------------------------------------------------------------

class MedicalEntity(Base):
    """Knowledge graph node: diseases, symptoms, drugs, procedures, etc."""
    __tablename__ = "medical_entities"
    __table_args__ = (
        UniqueConstraint("entity_type", "name", name="uq_entity_type_name"),
        Index("ix_entity_type_active", "entity_type", "is_active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(30), nullable=False)
    name = Column(String(500), nullable=False)
    aliases = Column(JSONB, nullable=True)
    properties = Column(JSONB, nullable=True)
    embedding = Column(Vector(1536), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# 7. MedicalEntityRelationship — Knowledge graph edges (L1 Layer 3)
#    NOT tenant-scoped — medical knowledge graph is platform-wide.
# ---------------------------------------------------------------------------

class MedicalEntityRelationship(Base):
    """Knowledge graph edge linking two MedicalEntity nodes."""
    __tablename__ = "medical_entity_relationships"
    __table_args__ = (
        UniqueConstraint(
            "source_entity_id", "target_entity_id", "relationship_type",
            name="uq_entity_relationship",
        ),
        Index(
            "ix_rel_source_type",
            "source_entity_id", "relationship_type",
        ),
        Index(
            "ix_rel_target_type",
            "target_entity_id", "relationship_type",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_entity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("medical_entities.id"),
        nullable=False,
    )
    target_entity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("medical_entities.id"),
        nullable=False,
    )
    relationship_type = Column(String(30), nullable=False)
    properties = Column(JSONB, nullable=True)
    confidence = Column(Float, nullable=False, default=1.0)
    source_reference = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# 8. QuestionIntelligencePattern — Faculty question patterns (L4)
#    Tenant-scoped — each college has its own question culture.
# ---------------------------------------------------------------------------

class QuestionIntelligencePattern(TenantModel):
    """Captures faculty question-writing patterns per college.

    Fed by Faculty Engine (F1) when faculty approves generated questions.
    Consumed by Student Engine (S2, S3, S4) to mirror exam style in practice.
    """
    __tablename__ = "question_intelligence_patterns"
    __table_args__ = (
        Index(
            "ix_qip_college_dept_captured",
            "college_id", "department", "captured_at",
        ),
    )

    faculty_id = Column(UUID(as_uuid=True), nullable=False)
    department = Column(String(100), nullable=False)
    question_type = Column(String(10), nullable=False)
    difficulty_rating = Column(Integer, nullable=True)
    blooms_level = Column(String(20), nullable=True)
    stem_length = Column(Integer, nullable=True)
    vignette_style = Column(String(30), nullable=True)
    distractor_strategy = Column(String(30), nullable=True)
    competency_code = Column(String(20), nullable=True)
    question_metadata = Column(JSONB, nullable=True)
    captured_at = Column(DateTime(timezone=True), nullable=False)


# ---------------------------------------------------------------------------
# 9. SafetyCheck — Medical content validation audit trail (L3)
#    Tenant-scoped.
# ---------------------------------------------------------------------------

class SafetyCheck(TenantModel):
    """Audit trail for every medical safety pipeline check."""
    __tablename__ = "safety_checks"
    __table_args__ = (
        Index("ix_safety_check_execution", "execution_id"),
        Index(
            "ix_safety_check_college_type_result",
            "college_id", "check_type", "result",
        ),
    )

    execution_id = Column(
        UUID(as_uuid=True),
        ForeignKey("agent_executions.id"),
        nullable=False,
    )
    check_type = Column(String(30), nullable=False)
    input_content_hash = Column(String(64), nullable=False)
    result = Column(String(20), nullable=False)
    confidence_score = Column(Float, nullable=True)
    details = Column(JSONB, nullable=True)
    checker_model = Column(String(100), nullable=True)
    pipeline_stage = Column(Integer, nullable=True)
    checked_at = Column(DateTime(timezone=True), nullable=False)


# ---------------------------------------------------------------------------
# 10. MetacognitiveEvent — Raw student interaction events (S8)
#     Tenant-scoped. HIGHEST-VOLUME table in the system.
#     NOTE: Future partitioning on occurred_at when volume justifies it.
# ---------------------------------------------------------------------------

class MetacognitiveEvent(TenantModel):
    """Raw student interaction events for metacognitive analytics.

    Every student action (answering a question, viewing a page, reviewing
    a flashcard, etc.) is captured here. This is the data source for
    StudentMetacognitiveProfile aggregations and the S6 Recommendation Engine.

    VOLUME WARNING: This will be the highest-volume table in the system.
    Plan monthly partitioning on occurred_at when volume justifies it.
    """
    __tablename__ = "metacognitive_events"
    __table_args__ = (
        Index(
            "ix_metacog_event_student_type_time",
            "college_id", "student_id", "event_type", "occurred_at",
        ),
        Index(
            "ix_metacog_event_student_subject_time",
            "college_id", "student_id", "subject", "occurred_at",
        ),
    )

    student_id = Column(UUID(as_uuid=True), nullable=False)
    event_type = Column(String(30), nullable=False)
    event_data = Column(JSONB, nullable=False)
    subject = Column(String(100), nullable=True)
    topic = Column(String(200), nullable=True)
    competency_code = Column(String(20), nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False)


# ---------------------------------------------------------------------------
# 11. StudentMetacognitiveProfile — Computed per-student metrics
#     Aggregated from MetacognitiveEvent. Tenant-scoped.
# ---------------------------------------------------------------------------

class StudentMetacognitiveProfile(TenantModel):
    """Computed metacognitive metrics per student per topic.

    Updated by the S8 Metacognitive Analytics Engine (Celery pipeline)
    whenever new events arrive. Consumed by S1 (Socratic Study Buddy),
    S6 (Recommendation Engine), and F7 (Student Analytics & Mentoring).
    """
    __tablename__ = "student_metacognitive_profiles"
    __table_args__ = (
        UniqueConstraint(
            "college_id", "student_id", "subject", "topic",
            name="uq_metacog_profile_student_topic",
        ),
        Index(
            "ix_metacog_profile_student_risk",
            "college_id", "student_id", "risk_level",
        ),
    )

    student_id = Column(UUID(as_uuid=True), nullable=False)
    subject = Column(String(100), nullable=False)
    topic = Column(String(200), nullable=False)
    mastery_score = Column(Float, nullable=False, default=0.0)
    confidence_calibration = Column(Float, nullable=True)
    accuracy_rate = Column(Float, nullable=False, default=0.0)
    avg_time_per_question_ms = Column(Integer, nullable=True)
    total_questions_attempted = Column(Integer, nullable=False, default=0)
    total_correct = Column(Integer, nullable=False, default=0)
    answer_change_rate = Column(Float, nullable=True)
    learning_velocity = Column(Float, nullable=True)
    last_active_at = Column(DateTime(timezone=True), nullable=True)
    forgetting_curve_params = Column(JSONB, nullable=True)
    risk_level = Column(
        String(10), nullable=False, default=RiskLevel.LOW.value,
    )
