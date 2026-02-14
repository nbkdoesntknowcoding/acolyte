"""Shared module — Cross-engine services, models, and schemas.

Public interface for AQP subsystem:
- DeviceTrustService  (from app.shared.services.device_trust_service)
- QRService           (from app.shared.services.qr_service)
- DynamicRoleService  (from app.shared.services.dynamic_role_service)
- qr_token_service    (from app.shared.services.qr_token_service) — standalone functions

Services are NOT imported at package level to avoid circular imports
with models. Import directly from service modules.
"""
