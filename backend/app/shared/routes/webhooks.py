"""SMS gateway webhook routes — public endpoints for incoming SMS.

Endpoints:
- POST /api/v1/webhooks/sms/incoming  — SMS gateway callback (NO AUTH, validated by secret)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.core.database import get_db
from app.engines.integration.sms import get_sms_gateway
from app.shared.services.device_trust_service import DeviceTrustService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks - SMS"])


@router.post("/sms/incoming")
async def handle_incoming_sms(
    request: Request,
    secret: str = Query(..., description="Webhook validation secret"),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_db),
):
    """Process incoming SMS from the gateway provider.

    This is a public endpoint (no Clerk auth) — validated only by the
    shared webhook secret. The SMS gateway (MSG91/Kaleyra) calls this
    when a user sends an SMS to our virtual number.

    Must respond quickly — gateways timeout after a few seconds.
    """
    if secret != settings.MSG91_WEBHOOK_SECRET:
        raise HTTPException(403, "Invalid webhook secret")

    payload = await request.json()
    sms_gateway = get_sms_gateway()
    incoming = sms_gateway.parse_incoming_webhook(payload)

    service = DeviceTrustService(db, sms_gateway)
    verified = await service.process_incoming_sms(
        sender=incoming.sender,
        message=incoming.message,
        gateway_message_id=incoming.gateway_message_id,
    )

    return {"status": "ok", "verified": verified}
