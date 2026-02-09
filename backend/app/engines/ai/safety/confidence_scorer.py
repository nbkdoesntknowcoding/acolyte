"""Multi-model ensemble confidence scoring.

CHECK-style: run same content through 2+ models, measure variance.
High variance = low confidence.

Thresholds:
  >0.95: Auto-approve (formative only)
  0.80-0.95: Needs faculty review
  <0.80: Rejected, regenerate (max 3 attempts)
"""
