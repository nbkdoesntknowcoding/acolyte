"""Compliance Engine — Public Interface.

Ships FIRST. 349 colleges have show-cause notices. 500+ fail MSR.
Can operate standalone via CSV imports (no other engines required).

Public interface for cross-engine imports:
    from app.engines.compliance import (
        ComplianceStandard,
        ComplianceAlert,
        ComplianceCheckSnapshot,
        SAFTemplate,
        ComplianceDocumentDraft,
    )
"""

from app.engines.compliance.models import (
    ComplianceAlert,
    ComplianceCheckSnapshot,
    ComplianceDocumentDraft,
    ComplianceSnapshot,
    ComplianceStandard,
    MSRAlert,
    NMCStandard,
    SAFSubmission,
    SAFTemplate,
)

__all__ = [
    # Compliance framework (C1)
    "ComplianceStandard",
    "ComplianceAlert",
    "ComplianceCheckSnapshot",
    # SAF auto-generation (C2)
    "SAFTemplate",
    "ComplianceDocumentDraft",
    # Existing models
    "ComplianceSnapshot",
    "NMCStandard",
    "SAFSubmission",
    "MSRAlert",
]
