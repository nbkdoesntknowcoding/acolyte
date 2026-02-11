"""AI Pipelines — Section L2 & L3 of architecture document.

Pipeline modules that process AI outputs before delivery:

- cognitive_preservation: Bridge Layer enforcement (L2)
  Every student-facing response must pass through this pipeline.
  Rejects direct answers, enforces Socratic scaffolding.

- medical_safety: Medical content validation (L3)
  Every AI-generated medical content passes through this pipeline.
  Source grounding, clinical accuracy, bias, NBME flaws, Bloom's alignment.

Usage:
    from app.engines.ai.pipelines import (
        CognitivePreservationPipeline,
        PreservationResult,
        MedicalSafetyPipeline,
        SafetyResult,
    )
"""

from app.engines.ai.pipelines.cognitive_preservation import (  # noqa: F401
    CognitivePreservationPipeline,
    DirectAnswerDetection,
    PreservationResult,
    StageResult,
)
from app.engines.ai.pipelines.medical_safety import (  # noqa: F401
    BiasDetectionCheck,
    BloomsVerificationCheck,
    ClinicalAccuracyCheck,
    ItemWritingFlawCheck,
    MedicalSafetyPipeline,
    SafetyResult,
    SourceGroundingCheck,
)
