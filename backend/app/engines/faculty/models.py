"""Faculty Engine — SQLAlchemy Models."""

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.shared.models import Base, TenantModel


class Competency(Base):
    """NMC CBME competency definitions. NOT tenant-scoped (shared reference)."""
    __tablename__ = "competencies"

    id = Column(UUID(as_uuid=True), primary_key=True)
    code = Column(String(20), unique=True, nullable=False)  # "PH 1.5", "AN 2.3"
    subject = Column(String(100), nullable=False)
    topic = Column(String(255))
    description = Column(Text, nullable=False)

    # NMC Classification
    level = Column(String(5), nullable=False)  # K, KH, S, SH, P
    is_certifiable = Column(Boolean, default=False)
    min_performances = Column(Integer)

    # Bloom's Taxonomy
    blooms_level = Column(String(20))
    domain = Column(String(20))  # Cognitive, Psychomotor, Affective

    # Integration Mappings
    horizontal_integrations = Column(JSONB, default=[])
    vertical_integrations = Column(JSONB, default=[])

    # Phase
    mbbs_phase = Column(String(10))  # "Phase I", "Phase II", "Phase III"
    is_aetcom = Column(Boolean, default=False)


class LogbookEntry(TenantModel):
    """Student competency logbook entries — the CBME tracking core."""
    __tablename__ = "logbook_entries"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    competency_id = Column(UUID(as_uuid=True), ForeignKey("competencies.id"), nullable=False)

    date = Column(Date, nullable=False)
    activity_type = Column(String(20))  # "observation", "assist", "perform"
    performance_count = Column(Integer, default=1)
    clinical_setting = Column(String(100))
    patient_consent_obtained = Column(Boolean)

    evidence_url = Column(String(500))
    notes = Column(Text)

    verified_by = Column(UUID(as_uuid=True), ForeignKey("faculty.id"))
    verified_at = Column(DateTime(timezone=True))
    verification_method = Column(String(20))  # "manual", "qr_code", "batch"

    created_offline = Column(Boolean, default=False)
    synced_at = Column(DateTime(timezone=True))


class QuestionBankItem(TenantModel):
    """Institutional question bank with psychometrics."""
    __tablename__ = "question_bank_items"

    question_type = Column(String(20), nullable=False)  # "MCQ", "SAQ", "LAQ", "EMQ", "OSCE"
    competency_id = Column(UUID(as_uuid=True), ForeignKey("competencies.id"))
    subject = Column(String(100), nullable=False)
    topic = Column(String(255))
    organ_system = Column(String(100))

    blooms_level = Column(String(20), nullable=False)
    difficulty_rating = Column(Integer)

    stem = Column(Text, nullable=False)
    lead_in = Column(Text)
    options = Column(JSONB)  # [{text, is_correct, explanation}]
    correct_answer = Column(Text)

    rubric = Column(JSONB)
    total_marks = Column(Integer)

    source = Column(String(20), default="human")
    created_by = Column(UUID(as_uuid=True))

    status = Column(String(20), default="draft")
    version = Column(Integer, default=1)

    # Psychometric Data
    times_used = Column(Integer, default=0)
    difficulty_index = Column(Float)
    discrimination_index = Column(Float)
    point_biserial = Column(Float)
    non_functional_distractors = Column(Integer)

    is_aetcom = Column(Boolean, default=False)
    nmc_compliant = Column(Boolean, default=True)


class ClinicalRotation(TenantModel):
    """Student clinical posting/rotation schedule."""
    __tablename__ = "clinical_rotations"

    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"))

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    required_hours = Column(Integer)
    completed_hours = Column(Integer, default=0)

    posting_assessment_score = Column(Float)
    assessed_by = Column(UUID(as_uuid=True), ForeignKey("faculty.id"))
    assessed_at = Column(DateTime(timezone=True))

    status = Column(String(20), default="scheduled")


class LessonPlan(TenantModel):
    """AI-generated or manually created lesson plans."""
    __tablename__ = "lesson_plans"

    faculty_id = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    topic = Column(String(255), nullable=False)
    competency_codes = Column(JSONB, default=[])

    teaching_hours = Column(Integer)
    blooms_levels = Column(JSONB, default=[])
    teaching_methods = Column(JSONB, default=[])
    learning_objectives = Column(JSONB, default=[])
    assessment_methods = Column(JSONB, default=[])
    integration_tags = Column(JSONB, default=[])

    content = Column(JSONB)  # Full lesson plan content
    source = Column(String(20), default="human")  # "human", "ai_generated"
    status = Column(String(20), default="draft")


class Assessment(TenantModel):
    """Exam lifecycle management."""
    __tablename__ = "assessments"

    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("faculty.id"), nullable=False)

    title = Column(String(255), nullable=False)
    assessment_type = Column(String(30))  # "internal_assessment", "university_exam", "formative"
    subject = Column(String(100), nullable=False)

    blueprint = Column(JSONB)  # Competency mapping, Bloom's distribution
    question_ids = Column(JSONB, default=[])

    status = Column(String(20), default="draft")  # draft → reviewed → approved → conducted → analyzed
    reviewed_by = Column(UUID(as_uuid=True))
    approved_by = Column(UUID(as_uuid=True))
    conducted_at = Column(DateTime(timezone=True))
