# CLAUDE CODE BUILD PROMPTS: AQP (QR Engine + Device Trust + Dynamic Roles)

**How to use:** Execute each prompt sequentially in Claude Code. Each prompt is self-contained but builds on the previous. Do NOT skip prompts. If any step fails, fix it before moving to the next.

**Prerequisites:** Admin Engine backend is already built (28 models, 100+ endpoints, 7 services, tests passing). The existing monorepo structure at `backend/app/` with `engines/`, `middleware/`, `core/`, `shared/` directories must be present.

---

## PROMPT 0: SHARED INFRASTRUCTURE SETUP (Configuration + Secrets + Base Models Split)

```
Read the file `AQP_COMPLETE_ARCHITECTURE.md` in the repo. It is the single source of truth for everything you build.

TASK: Set up the shared infrastructure that all 3 systems (Device Trust, QR Engine, Dynamic Roles) depend on.

STEP 0A: Add new environment variables to `backend/app/config.py` (extend existing Pydantic BaseSettings):
- DEVICE_TRUST_SECRET: str  # HS256 key for device trust JWTs (min 32 chars)
- QR_TOKEN_SECRET: str  # HS256 key for QR identity tokens (min 32 chars)  
- QR_ACTION_POINT_SECRET: str  # HMAC key for Mode B action point signatures
- SMS_GATEWAY_PROVIDER: str = "msg91"  # "msg91" | "kaleyra" | "mock"
- MSG91_API_KEY: str = ""
- MSG91_SENDER_ID: str = "ACOLYT"  # 6-char DLT sender ID
- MSG91_VIRTUAL_NUMBER: str = ""  # Virtual mobile number for incoming SMS
- MSG91_DLT_TEMPLATE_ID: str = ""
- MSG91_WEBHOOK_SECRET: str = ""  # Shared secret for webhook validation
- KALEYRA_API_KEY: str = ""  # Fallback gateway
- KALEYRA_SID: str = ""
- DEVICE_TOKEN_EXPIRY_DAYS: int = 180
- QR_IDENTITY_TOKEN_EXPIRY_SECONDS: int = 300
- QR_IDENTITY_REFRESH_SECONDS: int = 60
- DEVICE_RESET_FLAG_THRESHOLD: int = 3  # Flag after N resets in 30 days

STEP 0B: Refactor shared models directory. Currently `backend/app/shared/models.py` has Base and TenantModel. Split into:
- `backend/app/shared/models/__init__.py` — re-export Base, TenantModel so existing imports don't break
- `backend/app/shared/models/base.py` — move Base and TenantModel here
- Ensure ALL existing engine imports like `from app.shared.models import Base, TenantModel` still work via __init__.py re-exports

STEP 0C: Create the security chain module at `backend/app/middleware/security_chain.py`:
- Define `SecurityLevel` IntEnum with levels 0-5: PUBLIC, AUTHENTICATED, DEVICE_VERIFIED, QR_SECURED, ELEVATED, STRICT
- Create `require_security(level: SecurityLevel)` decorator for FastAPI route handlers
- Level 0: No checks (public endpoints)
- Level 1: Verify request.state.user exists (Clerk JWT validated by existing middleware)
- Level 2: Level 1 + validate `X-Device-Trust-Token` header. Decode HS256 JWT with DEVICE_TRUST_SECRET. Verify user_id in token matches request.state.user.id. Query DeviceTrust table to confirm status="active". Set request.state.device = DeviceTrust record.
- Level 3: Level 2 + validate `X-QR-Token` header. Decode HS256 JWT with QR_TOKEN_SECRET. Verify typ="identity_qr". Verify device fingerprint prefix matches. Set request.state.qr_data = decoded payload.
- Level 4: Level 3 + require `X-GPS-Latitude` and `X-GPS-Longitude` headers. Parse as floats. Set request.state.gps = {"lat": float, "lng": float}.
- Level 5: Level 4 + require `X-Biometric-Token` header. Set request.state.biometric_confirmed = True.
- Each level raises HTTPException(401 or 403) with descriptive error message if validation fails.

STEP 0D: Create directory structure:
```
mkdir -p backend/app/shared/models
mkdir -p backend/app/shared/services
mkdir -p backend/app/shared/schemas
mkdir -p backend/app/shared/routes
mkdir -p backend/app/shared/tasks
mkdir -p backend/app/engines/integration/sms
```

STEP 0E: Create `backend/app/shared/services/__init__.py` and `backend/app/shared/routes/__init__.py` (empty __init__ files).

Verify: All existing tests still pass after the models refactor. Run `pytest tests/ -v --tb=short`.

CRITICAL RULES:
- Async everywhere: `async def` on all service methods and route handlers
- SQLAlchemy async sessions with asyncpg
- All timestamps are timezone-aware (DateTime(timezone=True))
- No raw SQL strings — use SQLAlchemy ORM/text()
- Pydantic v2 schemas (model_config = ConfigDict(...))
```

---

## PROMPT 1: DEVICE TRUST — Models + Migration

```
Read Section 5 of `AQP_COMPLETE_ARCHITECTURE.md` — the complete database schema for device_trust.py.

TASK: Create the Device Trust database models and run migration.

STEP 1A: Create `backend/app/shared/models/device_trust.py` with these 3 model classes:

1. `DeviceTrust(Base)` — NOT tenant-scoped (platform-level, no college_id):
   - All columns from the architecture doc Section 5, device_trust.py
   - id: UUID primary key with default uuid4
   - user_id: UUID, not null, indexed
   - Device identification: device_fingerprint (String 64), platform (String 10), device_id (String 100), device_model (String 100), device_manufacturer (String 100), os_version (String 20), app_version (String 20), screen_width (Integer), screen_height (Integer), ram_mb (Integer), sim_operator (String 50), sim_country (String 5)
   - Phone verification: claimed_phone (String 15, not null), verified_phone (String 15), phone_verified_at (DateTime tz), verification_code_hash (String 64), verification_code_expires_at (DateTime tz), sms_verified (Boolean default False), sms_gateway_message_id (String 100)
   - Trust token: device_trust_token_hash (String 64), token_issued_at (DateTime tz), token_expires_at (DateTime tz)
   - Status: status (String 30, default "pending_sms_verification", indexed). Values: "pending_sms_verification", "active", "revoked", "expired", "transferred", "verification_failed", "suspended"
   - Revocation: revoked_at, revoked_by (UUID), revoke_reason (String 100)
   - Activity: last_active_at, total_qr_scans (Integer default 0), last_qr_scan_at
   - Timestamps: created_at, updated_at with server_default=text("NOW()")
   - CRITICAL INDEX: Unique partial index on (user_id) WHERE status='active' — enforces ONE active device per user
   - INDEX: (claimed_phone, status) for fast SMS webhook matching

2. `DeviceTransferRequest(Base)` — NOT tenant-scoped:
   - id, user_id, old_device_trust_id (FK→device_trusts), transfer_code_hash (String 64), expires_at, status (default "pending"), new_device_trust_id (FK→device_trusts), completed_at, created_at

3. `DeviceResetLog(Base)` — NOT tenant-scoped, append-only audit:
   - id, user_id (indexed), device_trust_id (FK→device_trusts), reset_by (UUID), reset_reason (String 100), admin_notes (Text), reset_at with server_default

STEP 1B: Update `backend/app/shared/models/__init__.py` to export all new models:
```python
from .base import Base, TenantModel
from .device_trust import DeviceTrust, DeviceTransferRequest, DeviceResetLog
```

STEP 1C: Run Alembic migration:
```bash
cd backend
alembic revision --autogenerate -m "device_trust_tables"
```
Review the generated migration. Ensure:
- The unique partial index on device_trusts is correctly generated
- All foreign keys reference device_trusts.id
- No RLS policies needed (these are platform-level tables, not tenant-scoped)

Apply: `alembic upgrade head`

STEP 1D: Verify migration succeeded by running:
```python
# Quick check
from app.shared.models import DeviceTrust, DeviceTransferRequest, DeviceResetLog
assert DeviceTrust.__tablename__ == "device_trusts"
```

Do NOT add RLS policies to these tables. They are platform-level.
```

---

## PROMPT 2: DEVICE TRUST — Token Service + Fingerprint Computation

```
Read Section 2.3 of `AQP_COMPLETE_ARCHITECTURE.md` — QR Token Service.

TASK: Create the cryptographic services for device trust and QR tokens.

STEP 2A: Create `backend/app/shared/services/qr_token_service.py`:

1. `compute_device_fingerprint(device_info: dict) -> str`:
   - Concatenate: device_id + platform + device_model + screen_width + screen_height
   - Join with "|" separator
   - Return SHA-256 hex digest (64 chars)
   - Deliberately EXCLUDE: app_version, os_version, sim_operator (these change)

2. `create_device_trust_token(user_id: str, device_trust_id: str, device_fingerprint: str) -> str`:
   - HS256 JWT signed with settings.DEVICE_TRUST_SECRET
   - Payload: sub=user_id, did=device_trust_id, dfp=device_fingerprint[:16], typ="device_trust", iat=now, exp=now+DEVICE_TOKEN_EXPIRY_DAYS days
   - Use PyJWT library

3. `validate_device_trust_token(token: str) -> Optional[dict]`:
   - Decode with HS256, verify signature and expiry
   - Require claims: sub, did, dfp, typ, exp
   - Return decoded payload or None on any error

4. `create_qr_identity_token(user_id: str, device_fingerprint: str, college_id: str, user_type: str) -> str`:
   - HS256 JWT signed with settings.QR_TOKEN_SECRET
   - Payload: sub=user_id, typ="identity_qr", dfp=device_fingerprint[:16], col=college_id[:8], utp=user_type[:3], iat=now, exp=now+QR_IDENTITY_TOKEN_EXPIRY_SECONDS
   - Short-lived (5 min default)

5. `validate_qr_identity_token(token: str) -> Optional[dict]`:
   - Decode with HS256, verify signature and expiry
   - Require typ="identity_qr"
   - Return decoded payload or None

6. `create_action_point_signature(action_point_id: str, action_type: str, location_code: str, college_id: str, rotation_key: str) -> str`:
   - HMAC-SHA256 using settings.QR_ACTION_POINT_SECRET
   - Message: "{action_point_id}:{action_type}:{location_code}:{college_id}:{rotation_key}"
   - Return first 32 chars of hex digest (for shorter QR codes)

7. `hash_verification_code(code: str) -> str`:
   - SHA-256 hash of the code string
   - Used to store verification codes securely (never store plaintext)

8. `generate_verification_code(length: int = 6) -> str`:
   - Use `secrets.randbelow(10**length)` zero-padded to `length` digits
   - Cryptographically secure random

9. `generate_transfer_code(length: int = 8) -> str`:
   - Same as above but 8 digits

Add proper type hints. Use `from __future__ import annotations`. Import `jwt` (PyJWT), `hashlib`, `hmac`, `secrets`, `datetime`.

STEP 2B: Add `PyJWT>=2.8.0` to `backend/requirements.txt` if not already present.

STEP 2C: Write unit tests in `backend/tests/shared/test_qr_token_service.py`:
- test_compute_fingerprint_deterministic (same input = same output)
- test_compute_fingerprint_different_devices (different input = different output)
- test_device_trust_token_roundtrip (create → validate → decoded matches)
- test_device_trust_token_expired (create with -1 day expiry → validate returns None)
- test_qr_identity_token_roundtrip
- test_qr_identity_token_wrong_secret (tampered → validate returns None)
- test_action_point_signature_deterministic
- test_action_point_signature_different_inputs
- test_verification_code_length
- test_verification_code_randomness (generate 100 codes, all different)

Run tests: `pytest backend/tests/shared/test_qr_token_service.py -v`
```

---

## PROMPT 3: SMS GATEWAY — Abstract + MSG91 + Mock Implementations

```
Read Section 8 of `AQP_COMPLETE_ARCHITECTURE.md` — SMS Gateway Integration.

TASK: Create the SMS gateway abstraction with MSG91 production and mock development implementations.

STEP 3A: Create `backend/app/engines/integration/sms/__init__.py` with a factory function:
```python
def get_sms_gateway() -> SMSGateway:
    if settings.SMS_GATEWAY_PROVIDER == "msg91":
        return MSG91Gateway()
    elif settings.SMS_GATEWAY_PROVIDER == "kaleyra":
        return KaleyraGateway()
    else:
        return MockSMSGateway()
```

STEP 3B: Create `backend/app/engines/integration/sms/base.py`:
- Define `IncomingSMS` dataclass: sender (str), message (str), received_at (str), gateway_message_id (str)
- Define abstract `SMSGateway` class with:
  - `async send_otp(phone: str, otp: str, template_id: str) -> str` — returns message ID
  - `get_virtual_number() -> str` — returns the virtual number for incoming SMS
  - `parse_incoming_webhook(payload: dict) -> IncomingSMS` — parse gateway-specific format

STEP 3C: Create `backend/app/engines/integration/sms/msg91.py`:
- Implements `MSG91Gateway(SMSGateway)`
- `send_otp`: POST to `https://api.msg91.com/api/v5/flow/` with authkey, template_id, recipients
- `get_virtual_number`: returns settings.MSG91_VIRTUAL_NUMBER
- `parse_incoming_webhook`: parse MSG91's format — normalize sender to +91XXXXXXXXXX format:
  - If sender starts with "91" and is 12 digits → prepend "+"
  - If sender is 10 digits → prepend "+91"
  - If sender already starts with "+91" → use as-is
- Use `httpx.AsyncClient` for HTTP calls

STEP 3D: Create `backend/app/engines/integration/sms/kaleyra.py`:
- Implements `KaleyraGateway(SMSGateway)` as fallback
- `send_otp`: POST to `https://api.kaleyra.io/v1/{sid}/messages` with api-key header
- Similar phone normalization
- Use httpx

STEP 3E: Create `backend/app/engines/integration/sms/mock.py`:
- Implements `MockSMSGateway(SMSGateway)` for development/testing
- `send_otp`: logs to console and stores in an in-memory dict `pending_verifications[phone] = otp`, returns "mock_msg_id"
- `get_virtual_number`: returns "+919999999999"
- `parse_incoming_webhook`: accepts payload as-is, normalizes sender
- Add class method `simulate_incoming_sms(sender: str, code: str)` that returns a properly formatted IncomingSMS (used in tests)

STEP 3F: Add `httpx>=0.27.0` to requirements.txt if not present.

STEP 3G: Write tests in `backend/tests/integration/test_sms_gateway.py`:
- test_mock_gateway_send_otp_stores_in_memory
- test_mock_gateway_simulate_incoming
- test_msg91_phone_normalization (10-digit, 12-digit with 91, with +91)
- test_factory_returns_mock_for_test_env (set SMS_GATEWAY_PROVIDER="mock")
```

---

## PROMPT 4: DEVICE TRUST — Service Layer (Registration + Verification + Revocation)

```
Read Sections 2.1 and 2.4 of `AQP_COMPLETE_ARCHITECTURE.md`.

TASK: Create the complete Device Trust service with all business logic.

Create `backend/app/shared/services/device_trust_service.py`:

CLASS: `DeviceTrustService`
Constructor takes: `db: AsyncSession`, `event_bus: EventBus`, `sms_gateway: SMSGateway`

METHOD 1: `async register_device(user_id: UUID, phone_number: str, device_info: dict) -> DeviceRegistrationResponse`
- Verify phone_number matches user's profile (query Student or Faculty table for user_id, check phone field)
- Check no active DeviceTrust exists for user_id (SELECT WHERE user_id=X AND status='active')
- If active device exists → raise HTTPException(409, "Account already registered to another device. Transfer or admin-reset required.")
- Compute device_fingerprint using qr_token_service.compute_device_fingerprint(device_info)
- Generate 6-digit verification_code using qr_token_service.generate_verification_code()
- Create DeviceTrust record: status="pending_sms_verification", all device_info fields, claimed_phone=phone_number, verification_code_hash=hash(code), verification_code_expires_at=now+10min
- Commit to DB
- Return: { verification_id: str, sms_target_number: str, sms_body_template: "ACOLYTE VERIFY {code}", verification_code: str, expires_in_seconds: 600 }

METHOD 2: `async process_incoming_sms(incoming: IncomingSMS) -> bool`
- Parse message body — extract code from "ACOLYTE VERIFY {code}" format
- If parse fails → return False
- Query DeviceTrust: claimed_phone matches sender, verification_code_hash matches hash(code), status="pending_sms_verification", created_at within 10 minutes
- If no match → log failed attempt, return False
- If match → update record: status="active", verified_phone=sender, phone_verified_at=now, sms_verified=True, sms_gateway_message_id=incoming.gateway_message_id
- Generate device_trust_token via create_device_trust_token()
- Store token_hash = hash(token), token_issued_at=now, token_expires_at=now+180days
- Publish event "device.registered" with user_id, device_model, platform
- Return True

METHOD 3: `async check_registration_status(user_id: UUID, verification_id: UUID) -> dict`
- Query DeviceTrust by id=verification_id AND user_id
- If status == "active": return { status: "active", device_trust_token: regenerate_token(), token_expires_at: ... }
- If status == "pending_sms_verification": return { status: "pending", message: "Waiting for SMS verification" }
- If status == "verification_failed": return { status: "failed", message: "Verification failed" }
- If not found: raise HTTPException(404)

METHOD 4: `async validate_device(user_id: UUID, device_token: str) -> Optional[DeviceTrust]`
- Decode token using validate_device_trust_token()
- If invalid → return None
- Verify token.sub matches user_id
- Query DeviceTrust by id=token.did, status="active"
- If found → update last_active_at=now, return record
- If not found → return None

METHOD 5: `async initiate_transfer(user_id: UUID) -> TransferResponse`
- Query active DeviceTrust for user_id
- If no active device → raise HTTPException(404, "No active device to transfer from")
- Generate 8-digit transfer_code
- Create DeviceTransferRequest: user_id, old_device_trust_id, transfer_code_hash=hash(code), expires_at=now+15min
- Return { transfer_code: str, expires_in: 900 }

METHOD 6: `async complete_transfer(user_id: UUID, transfer_code: str, new_device_info: dict) -> dict`
- Query DeviceTransferRequest: user_id, transfer_code_hash matches, status="pending", expires_at > now
- If not found → raise HTTPException(400, "Invalid or expired transfer code")
- Revoke old device: status="transferred", revoked_at=now
- Mark transfer request: status="completed", completed_at=now
- Start new device registration (call register_device with new_device_info)
- Publish event "device.transferred"
- Return new registration response

METHOD 7: `async revoke_device(user_id: UUID, reason: str, admin_id: UUID = None) -> None`
- Query active DeviceTrust for user_id
- If not found → raise HTTPException(404)
- Update: status="revoked", revoked_at=now, revoked_by=admin_id, revoke_reason=reason
- If admin_id: Create DeviceResetLog record
- Publish event "device.revoked"

METHOD 8: `async get_flagged_users(threshold: int = 3, period_days: int = 30) -> list[dict]`
- Query DeviceResetLog: group by user_id, count where reset_at > now-period_days
- Return users with count >= threshold

Write Pydantic schemas in `backend/app/shared/schemas/device.py`:
- DeviceInfo: platform, device_id, device_model, device_manufacturer, os_version, app_version, screen_width, screen_height, ram_mb, sim_operator, sim_country
- RegisterDeviceRequest: phone_number (validated +91XXXXXXXXXX or 10-digit), device_info: DeviceInfo
- RegisterDeviceResponse: verification_id, sms_target_number, sms_body_template, verification_code, expires_in_seconds
- DeviceStatusResponse: status, device_trust_token (optional), token_expires_at (optional), message (optional)
- TransferInitiateResponse: transfer_code, expires_in
- TransferCompleteRequest: transfer_code, device_info: DeviceInfo
- DeviceResetRequest: reason, admin_notes (optional)
- DeviceTrustResponse: id, user_id, device_model, platform, status, verified_phone, last_active_at, total_qr_scans, created_at
- FlaggedUserResponse: user_id, reset_count, last_reset_at

Run tests: write and run `backend/tests/shared/test_device_trust_service.py` covering all 8 methods. Use mock SMS gateway.
```

---

## PROMPT 5: DEVICE TRUST — API Routes

```
TASK: Create all Device Trust API routes.

STEP 5A: Create `backend/app/shared/routes/device.py`:

Router prefix: `/api/v1/device`, tags=["device-trust"]

Endpoints (all require SecurityLevel.AUTHENTICATED unless noted):

1. `POST /register` — Initiate device registration
   - Body: RegisterDeviceRequest
   - Calls device_trust_service.register_device()
   - Returns RegisterDeviceResponse

2. `POST /resend-sms` — Resend verification SMS (if user didn't send from phone)
   - Body: { verification_id: UUID }
   - Regenerates verification code, updates DeviceTrust record
   - Returns new RegisterDeviceResponse with fresh code

3. `GET /status` — Poll for registration status
   - Query param: verification_id: UUID
   - Calls device_trust_service.check_registration_status()
   - Returns DeviceStatusResponse

4. `POST /transfer/initiate` — Start device transfer (requires SecurityLevel.DEVICE_VERIFIED — must be on OLD device)
   - Calls device_trust_service.initiate_transfer()
   - Returns TransferInitiateResponse

5. `POST /transfer/complete` — Complete transfer on new device (SecurityLevel.AUTHENTICATED — new device not yet verified)
   - Body: TransferCompleteRequest
   - Calls device_trust_service.complete_transfer()
   - Returns RegisterDeviceResponse (for new SMS verification)

6. `DELETE /revoke` — Self-revoke current device (SecurityLevel.DEVICE_VERIFIED)
   - Calls device_trust_service.revoke_device(reason="self_revoked")

STEP 5B: Create `backend/app/shared/routes/webhooks.py`:

Router prefix: `/api/v1/webhooks`, tags=["webhooks"]

1. `POST /sms/incoming` — SMS gateway webhook (NO AUTH — public endpoint, validated by secret)
   - Query param: secret: str — must match settings.MSG91_WEBHOOK_SECRET
   - If secret doesn't match → 403
   - Parse payload via sms_gateway.parse_incoming_webhook()
   - Call device_trust_service.process_incoming_sms()
   - Return 200 OK (gateway expects fast response)

STEP 5C: Create admin device management routes at `backend/app/engines/admin/routes/devices.py`:

Router prefix: `/api/v1/admin/devices`, tags=["admin-devices"]
All require SecurityLevel.AUTHENTICATED + admin role check

1. `GET /` — List all registered devices with pagination and filters
   - Filters: status, platform, search (user name/phone)
   - Returns paginated DeviceTrustResponse list

2. `GET /{user_id}` — Get device info for specific user
   - Returns DeviceTrustResponse or 404

3. `POST /{user_id}/reset` — Admin-initiated device reset
   - Body: DeviceResetRequest
   - Calls device_trust_service.revoke_device(admin_id=current_user.id)
   - Creates DeviceResetLog entry
   - Returns success message

4. `GET /flagged` — Users with suspicious number of resets
   - Query params: threshold (default 3), period_days (default 30)
   - Calls device_trust_service.get_flagged_users()
   - Returns list of FlaggedUserResponse

5. `GET /stats` — Device registration statistics
   - Returns: total_registered, active_count, revoked_count, pending_count, by_platform (android/ios counts), registrations_this_week

STEP 5D: Register ALL new routes in `backend/app/main.py`:
```python
from app.shared.routes.device import router as device_router
from app.shared.routes.webhooks import router as webhooks_router
from app.engines.admin.routes.devices import router as admin_devices_router

app.include_router(device_router)
app.include_router(webhooks_router)
app.include_router(admin_devices_router)
```

STEP 5E: Write integration tests in `backend/tests/api/test_device_api.py`:
- test_register_device_returns_verification_code
- test_register_device_duplicate_active_rejected
- test_status_poll_pending_before_sms
- test_sms_webhook_activates_device
- test_status_poll_active_after_sms_returns_token
- test_admin_reset_revokes_device
- test_admin_reset_creates_audit_log
- test_flagged_users_threshold

Run ALL tests: `pytest backend/tests/ -v --tb=short`
```

---

## PROMPT 6: QR ENGINE — Models + Migration

```
Read Section 5 of `AQP_COMPLETE_ARCHITECTURE.md` — QR models (qr.py).

TASK: Create QR database models and run migration.

STEP 6A: Create `backend/app/shared/models/qr.py` with 2 model classes:

1. `QRActionPoint(TenantModel)` — tenant-scoped (each college configures its own action points):
   - All columns from architecture doc Section 5, qr.py
   - name (String 255, not null), description (Text)
   - action_type (String 30, not null, indexed) — the 14 types from the spec
   - location_code (String 50, not null) — unique within college
   - qr_mode (String 10, not null) — "mode_a" or "mode_b"
   - Physical location: building, floor, gps_latitude, gps_longitude, geo_radius_meters (default 100)
   - QR config: qr_rotation_minutes (default 0), qr_secret (String 64)
   - Duplicate: duplicate_window_minutes (default 30)
   - Linked entity: linked_entity_type, linked_entity_id
   - Security: security_level (default "standard") — "standard", "elevated", "strict"
   - Scanner: scanner_device_trust_id (FK→device_trusts)
   - Hours: active_hours_start (String 5), active_hours_end (String 5), active_days (JSONB default [0,1,2,3,4,5])
   - metadata (JSONB default {})
   - is_active (Boolean default True)
   - UniqueConstraint on (college_id, location_code)
   - Index on (college_id, action_type)

2. `QRScanLog(TenantModel)` — tenant-scoped, append-only:
   - All columns from architecture doc
   - Who: user_id (UUID, not null, indexed), user_type (String 10), device_trust_id (FK→device_trusts)
   - What: action_type (String 30, not null, indexed), action_point_id (FK→qr_action_points), qr_mode (String 10)
   - Context: entity_type (String 30), entity_id (UUID), metadata (JSONB default {})
   - Location: scan_latitude, scan_longitude, geo_validated (Boolean)
   - Validation: device_validated (Boolean, not null, default False), biometric_confirmed (Boolean default False), validation_result (String 20, not null), rejection_reason (Text)
   - Timestamp: scanned_at with server_default=text("NOW()")
   - Composite indexes: (college_id, user_id, action_type, scanned_at), (college_id, action_point_id, scanned_at)

STEP 6B: Update `backend/app/shared/models/__init__.py`:
```python
from .qr import QRActionPoint, QRScanLog
```

STEP 6C: Run migration:
```bash
alembic revision --autogenerate -m "qr_engine_tables"
```
Review migration. Ensure:
- QRActionPoint gets RLS policy (it's TenantModel)
- QRScanLog gets RLS policy
- Unique constraint on (college_id, location_code) is present
- All indexes are created
- FK to device_trusts is correct

Apply: `alembic upgrade head`
```

---

## PROMPT 7: QR ENGINE — Core Service + Action Handler Registry

```
Read Section 3.2 of `AQP_COMPLETE_ARCHITECTURE.md` — QR Service scan processing pipeline.

TASK: Create the core QR processing service.

Create `backend/app/shared/services/qr_service.py`:

CLASS: `QRService`
Constructor: `db: AsyncSession`, `event_bus: EventBus`
Has `_action_handlers: dict[str, Callable] = {}` for handler registry.

METHOD: `register_handler(action_type: str, handler: Callable)`
- Stores handler in _action_handlers dict
- Used by engines at app startup

METHOD: `async generate_identity_qr(user_id: UUID, college_id: UUID) -> dict`
- Query active DeviceTrust for user_id
- If no active device → raise HTTPException(403, "No registered device")
- Call create_qr_identity_token(user_id, device_fingerprint, college_id, user_type)
- Return { token: str, expires_in: QR_IDENTITY_TOKEN_EXPIRY_SECONDS, refresh_in: QR_IDENTITY_REFRESH_SECONDS }

METHOD: `async process_mode_a_scan(scanner_user_id, scanner_device, scanned_qr_data, action_point_id, gps=None) -> ScanResult`
- Full pipeline from architecture doc Section 3.2:
  1. Decode QR JWT → validate_qr_identity_token()
  2. Extract target_user_id from token
  3. Verify device trust is active for target user
  4. Verify fingerprint prefix matches
  5. Get action point config
  6. GPS validation (Haversine) if action point requires it
  7. Duplicate check (query QRScanLog for same user+action_type within duplicate_window_minutes)
  8. Execute registered action handler
  9. Create QRScanLog record
  10. Publish event via event bus
  11. Return ScanResult

METHOD: `async process_mode_b_scan(user_id, user_device, scanned_qr_data, gps=None) -> ScanResult`
- Parse acolyte:// URL format
- Validate HMAC signature against action point's secret
- Check rotation key is current (if rotating QR)
- Same steps 5-11 as Mode A

METHOD: `_validate_geo(user_gps, target_lat, target_lng, radius_meters) -> bool`
- Haversine distance formula
- Returns True if distance <= radius_meters

METHOD: `_parse_action_qr(qr_data: str) -> Optional[dict]`
- Parse `acolyte://v1/{action}?ap={id}&lc={code}&c={college}&sig={sig}&r={rotation}` format
- Use urllib.parse
- Return dict with action_type, action_point_id, location_code, college_id, entity_id, signature, rotation_key

METHOD: `async _check_duplicate(user_id, action_type, window_minutes) -> bool`
- If window_minutes == 0: return False
- Query QRScanLog: user_id, action_type, validation_result="success", scanned_at > now-window_minutes
- Return True if any found

METHOD: `async _log_failed_scan(user_id, qr_mode, result, reason) -> ScanResult`
- Create QRScanLog with validation_result=result, rejection_reason=reason
- Return ScanResult(success=False, message=reason)

Create `backend/app/shared/schemas/qr.py` with Pydantic schemas:
- ScanResult: success (bool), action_type (str, optional), message (str), data (dict, optional)
- GPSCoordinates: lat (float), lng (float)
- ModeAScanRequest: scanned_qr_data (str), action_point_id (UUID), gps (GPSCoordinates, optional)
- ModeBScanRequest: scanned_qr_data (str), gps (GPSCoordinates, optional)
- ModeBConfirmRequest: scan_log_id (UUID), selected_entity_id (UUID) — for library return book selection
- IdentityQRResponse: token (str), expires_in (int), refresh_in (int)
- QRActionPointCreate: name, description, action_type, location_code, qr_mode, building, floor, gps_latitude, gps_longitude, geo_radius_meters, qr_rotation_minutes, duplicate_window_minutes, linked_entity_type, linked_entity_id, security_level, active_hours_start, active_hours_end, active_days, metadata
- QRActionPointUpdate: all fields Optional
- QRActionPointResponse: all fields + id, college_id, is_active, created_at
- QRScanLogResponse: all fields + id, scanned_at
- ScanLogFilterParams: user_id, action_type, validation_result, date_from, date_to, page, page_size

Write tests: `backend/tests/shared/test_qr_service.py`
- test_generate_identity_qr_active_device
- test_generate_identity_qr_no_device_raises
- test_mode_a_scan_valid
- test_mode_a_scan_expired_token
- test_mode_a_scan_device_mismatch
- test_mode_a_scan_duplicate_blocked
- test_mode_b_scan_valid_signature
- test_mode_b_scan_tampered_rejected
- test_geo_validation_within_radius
- test_geo_validation_outside_radius
- test_parse_action_qr_valid
- test_parse_action_qr_invalid

Run: `pytest backend/tests/shared/test_qr_service.py -v`
```

---

## PROMPT 8: QR ENGINE — Action Handlers (Admin + Faculty Engines)

```
Read Section 3.3 of `AQP_COMPLETE_ARCHITECTURE.md` — Action Handlers.

TASK: Create action handlers in each engine and register them at app startup.

STEP 8A: Create `backend/app/engines/admin/services/qr_handlers.py` with these async handler functions:

1. `handle_mess_entry(user_id, action_point, device_trust, gps, db)` → dict
   - Determine meal by hour (breakfast <10, lunch <15, snacks <18, dinner else)
   - Check duplicate: query QRScanLog for same user + "mess_entry" + same date + same meal
   - If duplicate → return status "duplicate" with message
   - Return status "success" with meal name and metadata

2. `handle_library_checkout(user_id, action_point, device_trust, gps, db, entity_id=None)` → dict
   - Get book by entity_id
   - Check available_copies > 0
   - Check student active issuances < 3
   - Create LibraryIssuance (issued_date=today, due_date=today+14, status="issued")
   - Decrement book.available_copies
   - Return success with book title and due date

3. `handle_library_return(user_id, action_point, device_trust, gps, db)` → dict
   - Query active issuances for user
   - If none → return status "none"
   - Return status "select_book" with list of active issuances (for UI selection)

4. `handle_hostel_checkin(user_id, action_point, device_trust, gps, db)` → dict
   - Check last scan for user today: if last was "entry" → this is "exit", else "entry"
   - If entry after 10pm or before 5am → curfew_violation = True, publish warning event
   - Return success with direction and curfew status

5. `handle_equipment_checkout(user_id, action_point, device_trust, gps, db, entity_id=None)` → dict
   - Similar to library checkout but for equipment (InfrastructureEquipment model)
   - No max limit, but check equipment.status == "available"

6. `register_admin_qr_handlers(qr_service: QRService)` → registers all handlers above

STEP 8B: Create `backend/app/engines/faculty/services/qr_handlers.py`:

1. `handle_attendance_mark(user_id, action_point, device_trust, gps, db)` → dict
   - Extract class_session_id, subject from action_point.metadata
   - Return success with subject name and gps_validated flag

2. `handle_clinical_posting(user_id, action_point, device_trust, gps, db)` → dict
   - Query ClinicalRotation for user in the department linked to action_point
   - If no active rotation → return error
   - Return success with department name, hours_completed, hours_required

3. `handle_event_checkin(user_id, action_point, device_trust, gps, db)` → dict
   - Log attendance for CME/FDP/conference event
   - Return success

4. `handle_exam_hall_entry(user_id, action_point, device_trust, gps, db)` → dict
   - Verify student is registered for the exam linked to action_point
   - This handler requires STRICT security level (biometric confirmed)
   - Return success with seat number

5. `register_faculty_qr_handlers(qr_service: QRService)` → registers all handlers

STEP 8C: In `backend/app/main.py`, at startup:
```python
@app.on_event("startup")
async def register_qr_handlers():
    from app.engines.admin.services.qr_handlers import register_admin_qr_handlers
    from app.engines.faculty.services.qr_handlers import register_faculty_qr_handlers
    qr_service = get_qr_service()
    register_admin_qr_handlers(qr_service)
    register_faculty_qr_handlers(qr_service)
```

STEP 8D: Write tests for handlers:
- test_mess_entry_breakfast_before_10am
- test_mess_entry_lunch_between_10_15
- test_mess_entry_duplicate_same_meal_rejected
- test_library_checkout_success
- test_library_checkout_no_copies_fails
- test_library_checkout_max_3_books
- test_hostel_entry_after_curfew_flagged
- test_attendance_mark_with_gps
- test_clinical_posting_no_active_rotation

Run: `pytest backend/tests/ -v --tb=short`
```

---

## PROMPT 9: QR ENGINE — API Routes

```
TASK: Create all QR API routes.

STEP 9A: Create `backend/app/shared/routes/qr.py`:

Router prefix: `/api/v1/qr`, tags=["qr"]

1. `GET /identity` — Get identity QR token (SecurityLevel.DEVICE_VERIFIED)
   - Calls qr_service.generate_identity_qr()
   - Returns IdentityQRResponse

2. `GET /identity/refresh` — Force refresh QR token (SecurityLevel.DEVICE_VERIFIED)
   - Same as above but forces new token generation

3. `POST /scan/mode-a` — Scanner reads someone's QR (SecurityLevel.DEVICE_VERIFIED)
   - Body: ModeAScanRequest
   - Calls qr_service.process_mode_a_scan()
   - Returns ScanResult

4. `POST /scan/mode-b` — User scans location QR (SecurityLevel.DEVICE_VERIFIED)
   - Body: ModeBScanRequest
   - Calls qr_service.process_mode_b_scan()
   - Returns ScanResult

5. `POST /scan/mode-b/confirm` — Confirm action for multi-step flows (SecurityLevel.DEVICE_VERIFIED)
   - Body: ModeBConfirmRequest (scan_log_id + selected_entity_id)
   - Used for: library return (select which book), equipment return
   - Returns ScanResult

6. `GET /history` — Current user's scan history (SecurityLevel.AUTHENTICATED)
   - Query params: action_type, date_from, date_to, page, page_size
   - Returns paginated QRScanLogResponse list

7. `GET /history/meals` — Filtered mess scan history
8. `GET /history/library` — Filtered library scan history
9. `GET /history/attendance` — Filtered attendance scan history

STEP 9B: Create `backend/app/engines/admin/routes/qr_admin.py`:

Router prefix: `/api/v1/admin/qr`, tags=["admin-qr"]
All require admin role

1. `GET /action-points` — List all action points with filters (action_type, building, is_active)
2. `POST /action-points` — Create action point. Auto-generate qr_secret using secrets.token_hex(32).
3. `PUT /action-points/{id}` — Update action point
4. `DELETE /action-points/{id}` — Soft-deactivate (set is_active=False)
5. `GET /action-points/{id}/generate` — Generate printable QR for Mode B action point
   - Returns: { qr_data: str, qr_image_base64: str } using qrcode Python library
6. `GET /action-points/{id}/stats` — Scan statistics for this point (total scans, success rate, by date)
7. `GET /scan-logs` — All scan logs with filters (user_id, action_type, validation_result, date range, pagination)
8. `GET /scan-logs/summary` — Daily scan counts by action type for last 30 days
9. `GET /scan-logs/anomalies` — Failed scans grouped by failure reason
10. `GET /scan-logs/export` — Export as CSV (returns StreamingResponse)

STEP 9C: Create public routes at `backend/app/shared/routes/public.py`:

Router prefix: `/api/v1/public`, tags=["public"]
NO AUTH required.

1. `GET /verify/{certificate_number}` — Certificate verification via QR
   - Query certificates table by certificate_number
   - Return: { valid: bool, certificate_type, student_name, college_name, issue_date, status }

STEP 9D: Add `qrcode>=7.4` and `Pillow>=10.0` to requirements.txt (for QR image generation).

STEP 9E: Register all new routes in main.py.

STEP 9F: Write integration tests for QR API routes.

Run: `pytest backend/tests/ -v --tb=short`
```

---

## PROMPT 10: DYNAMIC ROLES — Models + Migration

```
Read Section 5 of `AQP_COMPLETE_ARCHITECTURE.md` — dynamic_roles.py and committee.py.

TASK: Create Dynamic Role Assignment and Committee models, run migration.

STEP 10A: Create `backend/app/shared/models/dynamic_roles.py`:

1. `DynamicRoleAssignment(TenantModel)`:
   - user_id (UUID, not null, indexed), user_type (String 20), user_name (String 255)
   - role_type (String 50, not null, indexed)
   - context_type (String 30, not null), context_id (UUID, not null), context_name (String 255)
   - valid_from (Date, not null), valid_until (Date, nullable)
   - is_active (Boolean default True), auto_deactivate (Boolean default True)
   - assigned_by (UUID), assigned_by_name (String 255), assignment_order_url (String 500), notes (Text)
   - permissions (JSONB default [])
   - Indexes: (college_id, user_id, is_active), (college_id, context_type, context_id)
   - UniqueConstraint: (college_id, user_id, role_type, context_id)

STEP 10B: Create `backend/app/shared/models/committee.py`:

1. `CommitteeMeeting(TenantModel)`:
   - committee_id (UUID, not null, indexed), title, description
   - meeting_date (DateTime tz, not null), location
   - agenda (JSONB default []), minutes_text, minutes_file_url, minutes_filed_by, minutes_filed_at
   - attendees (JSONB default []), quorum_met (Boolean)
   - status (String 20, default "scheduled")

2. `CommitteeActionItem(TenantModel)`:
   - committee_id (UUID, not null, indexed), meeting_id (FK→committee_meetings)
   - title, description, assigned_to (UUID), assigned_to_name, due_date, status, completed_at, notes

STEP 10C: Update `backend/app/shared/models/__init__.py` to export all new models.

STEP 10D: Run migration: `alembic revision --autogenerate -m "dynamic_roles_committee_tables"`
- Add RLS policies for all 3 new tables (they're TenantModel)
- Apply: `alembic upgrade head`
```

---

## PROMPT 11: DYNAMIC ROLES — Service + Routes

```
TASK: Create the Dynamic Role service, committee service, and all API routes.

STEP 11A: Create `backend/app/shared/services/dynamic_role_service.py`:

CLASS: `DynamicRoleService(db, event_bus)`

1. `async get_user_roles(user_id: UUID, college_id: UUID) -> list[DynamicRoleAssignment]`
   - Query active assignments for user where is_active=True AND (valid_until IS NULL OR valid_until >= today)
   - Return sorted by context_type, context_name

2. `async get_user_committee_roles(user_id: UUID, college_id: UUID) -> list[DynamicRoleAssignment]`
   - Filtered to context_type="committee" only

3. `async assign_role(data: RoleAssignmentCreate, assigned_by: UUID) -> DynamicRoleAssignment`
   - Check no duplicate active assignment (same user + role_type + context_id)
   - Create record
   - Determine permissions based on role_type (committee_chair gets all, member gets view-only, etc.)
   - Publish "role.assigned" event

4. `async revoke_role(assignment_id: UUID, revoked_by: UUID, reason: str) -> None`
   - Set is_active=False
   - Publish "role.revoked" event

5. `async get_expiring_roles(days: int = 30) -> list[DynamicRoleAssignment]`
   - WHERE valid_until BETWEEN today AND today+days AND is_active=True

STEP 11B: Create committee service methods (can be in same file or separate):
- `get_committee_detail(committee_id, user_id)` — verify user is member, return committee info
- `get_committee_grievances(committee_id, user_id)` — cases assigned to this committee
- `get_committee_meetings(committee_id, user_id)` — meetings list
- `create_committee_meeting(committee_id, data, user_id)` — requires chair/secretary permission
- `file_meeting_minutes(meeting_id, minutes_data, user_id)` — requires secretary/chair permission
- `get_committee_action_items(committee_id, user_id)`
- `update_action_item(item_id, data, user_id)`

STEP 11C: Create Pydantic schemas in `backend/app/shared/schemas/roles.py`:
- RoleAssignmentCreate, RoleAssignmentUpdate, RoleAssignmentResponse
- MeetingCreate, MeetingResponse, MinutesUpload
- ActionItemCreate, ActionItemUpdate, ActionItemResponse
- UserRolesResponse (list of roles with permissions)

STEP 11D: Create `backend/app/shared/routes/me.py`:

Router prefix: `/api/v1/me`, tags=["me"]

1. `GET /roles` — All active dynamic role assignments for current user
2. `GET /committees` — Committee roles only

STEP 11E: Create committee routes (under shared since any user type can be a committee member):

Router prefix: `/api/v1/committees`, tags=["committees"]

All endpoints check: user must have active DynamicRoleAssignment where context_type="committee" and context_id matches.

1. `GET /{id}` — Committee detail
2. `GET /{id}/grievances` — Cases assigned to committee
3. `GET /{id}/meetings` — Meeting list
4. `POST /{id}/meetings` — Schedule meeting (chair/secretary only)
5. `GET /{id}/meetings/{mid}` — Meeting detail with minutes
6. `POST /{id}/meetings/{mid}/minutes` — Upload minutes (secretary/chair only)
7. `GET /{id}/documents` — Committee documents
8. `GET /{id}/action-items` — Action items
9. `PUT /{id}/action-items/{aid}` — Update action item status

STEP 11F: Create admin role management routes at `backend/app/engines/admin/routes/role_assignments.py`:

Router prefix: `/api/v1/admin/role-assignments`, tags=["admin-roles"]

1. `GET /` — List all role assignments with filters
2. `POST /` — Create assignment
3. `PUT /{id}` — Update
4. `DELETE /{id}` — Revoke
5. `GET /expiring` — Assignments expiring within 30 days

STEP 11G: Register all routes in main.py.

STEP 11H: Write tests covering:
- test_get_user_roles_returns_active_only
- test_assign_role_prevents_duplicate
- test_revoke_role_sets_inactive
- test_committee_member_can_view_grievances
- test_non_member_blocked_from_committee
- test_chair_can_schedule_meeting
- test_member_cannot_schedule_meeting
- test_auto_deactivate_expired_roles

Run: `pytest backend/tests/ -v --tb=short`
```

---

## PROMPT 12: CELERY TASKS + EVENT BUS WIRING

```
TASK: Create all background tasks and wire event publishing.

STEP 12A: Create `backend/app/shared/tasks/device_tasks.py`:

1. `check_expired_device_tokens` — Celery beat: daily at 2:00 AM IST
   - UPDATE device_trusts SET status='expired' WHERE token_expires_at < NOW() AND status='active'
   - Log count of expired tokens

2. `flag_suspicious_device_resets` — Celery beat: daily at 3:00 AM IST
   - Query device_reset_logs grouped by user_id, count where reset_at > 30 days ago
   - For each user with count >= DEVICE_RESET_FLAG_THRESHOLD:
     - Publish "device.suspicious_resets" event
     - Log warning

3. `cleanup_expired_transfer_requests` — Celery beat: hourly
   - UPDATE device_transfer_requests SET status='expired' WHERE expires_at < NOW() AND status='pending'

STEP 12B: Create `backend/app/shared/tasks/qr_tasks.py`:

1. `rotate_action_point_qrs` — Celery beat: every 1 minute
   - Query QRActionPoints where qr_rotation_minutes > 0 and is_active=True
   - For each, generate new QR data with current timestamp as rotation_key
   - Update qr_secret field (or a separate cached value in Redis)

2. `generate_qr_daily_report` — Celery beat: daily at midnight
   - Aggregate QRScanLog: group by (action_type, date), count success/failure
   - Store in Redis hash or a summary table

STEP 12C: Create `backend/app/shared/tasks/role_tasks.py`:

1. `check_expiring_roles` — Celery beat: daily at 8:00 AM IST
   - Query DynamicRoleAssignment where valid_until BETWEEN today AND today+7 AND is_active=True
   - For each, publish "role.expiring" event

2. `auto_deactivate_expired_roles` — Celery beat: daily at 1:00 AM IST
   - UPDATE dynamic_role_assignments SET is_active=False WHERE auto_deactivate=True AND valid_until < today AND is_active=True
   - Log count deactivated

STEP 12D: Register all beat tasks in `backend/app/core/celery_app.py`:
```python
app.conf.beat_schedule = {
    # ... existing tasks ...
    "check-expired-device-tokens": {
        "task": "app.shared.tasks.device_tasks.check_expired_device_tokens",
        "schedule": crontab(hour=2, minute=0),  # 2:00 AM IST daily
    },
    "flag-suspicious-resets": {
        "task": "app.shared.tasks.device_tasks.flag_suspicious_device_resets",
        "schedule": crontab(hour=3, minute=0),
    },
    "cleanup-transfer-requests": {
        "task": "app.shared.tasks.device_tasks.cleanup_expired_transfer_requests",
        "schedule": crontab(minute=0),  # Every hour
    },
    "rotate-qr-codes": {
        "task": "app.shared.tasks.qr_tasks.rotate_action_point_qrs",
        "schedule": 60.0,  # Every 60 seconds
    },
    "qr-daily-report": {
        "task": "app.shared.tasks.qr_tasks.generate_qr_daily_report",
        "schedule": crontab(hour=0, minute=5),  # 12:05 AM
    },
    "check-expiring-roles": {
        "task": "app.shared.tasks.role_tasks.check_expiring_roles",
        "schedule": crontab(hour=8, minute=0),
    },
    "auto-deactivate-expired-roles": {
        "task": "app.shared.tasks.role_tasks.auto_deactivate_expired_roles",
        "schedule": crontab(hour=1, minute=0),
    },
}
```

STEP 12E: Wire event publishing in all services:
- Verify device_trust_service publishes: device.registered, device.revoked, device.transferred
- Verify qr_service publishes: qr.{action_type} for every successful scan
- Verify dynamic_role_service publishes: role.assigned, role.revoked

Use the existing Redis Pub/Sub event bus pattern from `backend/app/core/events.py`.

Write tests for each Celery task.
Run: `pytest backend/tests/ -v --tb=short`
```

---

## PROMPT 13: SEED DATA

```
TASK: Create seed data for QR action points and dynamic role examples.

Create `backend/scripts/seed_qr_and_roles.py`:

SECTION 1 — QR Action Points (for sample college):
Create these action points with sensible defaults:

1. mess_main_entrance — action_type: "mess_entry", qr_mode: "mode_a", building: "Hostel Block", geo_radius: 50m, duplicate_window: 30min, security: "standard"
2. mess_pg_entrance — same as above, different location
3. library_entrance — action_type: "library_visit", qr_mode: "mode_a", building: "Library"
4. library_desk_1 — action_type: "library_checkout", qr_mode: "mode_b", building: "Library", static QR
5. library_return_desk — action_type: "library_return", qr_mode: "mode_b"
6. anatomy_lecture_hall — action_type: "attendance_mark", qr_mode: "mode_b", rotation: 5min, security: "elevated" (GPS), building: "Academic Block"
7. physiology_lecture_hall — same pattern
8. biochemistry_lecture_hall — same pattern
9. hostel_boys_gate — action_type: "hostel_checkin", qr_mode: "mode_a", security: "standard"
10. hostel_girls_gate — same
11. medicine_ward — action_type: "clinical_posting", qr_mode: "mode_b", building: "Hospital", security: "elevated"
12. surgery_ward — same
13. ob_gyn_ward — same
14. pediatrics_ward — same
15. exam_hall_1 — action_type: "exam_hall_entry", qr_mode: "mode_a", security: "strict" (biometric)

SECTION 2 — Dynamic Role Assignments (sample):
Create these sample assignments:

1. Student ID 1 → committee_member on "Anti-Ragging Committee", valid Aug 2025 - Jul 2026
   permissions: ["view_cases", "view_minutes", "view_documents"]
2. Faculty ID 1 → committee_chair on "Anti-Ragging Committee", same validity
   permissions: ["view_cases", "update_status", "resolve_case", "file_minutes", "schedule_meeting", "manage_members"]
3. Student ID 2 → class_representative for Batch 2024 Phase I
   permissions: ["view_notices", "submit_feedback", "represent_batch"]
4. Faculty ID 2 → exam_invigilator for upcoming exam
   valid_from: today, valid_until: today+7
   permissions: ["access_exam_hall", "verify_students", "report_incidents"]

SECTION 3 — Committee Meetings (sample):
1. Anti-Ragging Committee meeting scheduled for next week
   agenda: ["Review reported incidents", "Discuss awareness campaign", "Plan fresher orientation safety measures"]
2. One past meeting with minutes filed

Run the seed script:
```bash
cd backend
python scripts/seed_qr_and_roles.py
```

Verify data:
- 15 QR action points created
- 4 dynamic role assignments created
- 2 committee meetings created
```

---

## PROMPT 14: END-TO-END INTEGRATION TESTS

```
TASK: Write comprehensive end-to-end integration tests that test the full flow.

Create `backend/tests/e2e/test_qr_full_flow.py`:

TEST 1: `test_full_device_registration_and_mess_scan`
- Create a test student in the DB
- POST /api/v1/device/register with student's phone and device info
- Assert response has verification_code and sms_target_number
- Simulate incoming SMS webhook: POST /api/v1/webhooks/sms/incoming with correct sender/code
- Poll GET /api/v1/device/status — assert status="active" and token received
- Use the device_trust_token to call GET /api/v1/qr/identity — get QR token
- Simulate Mode A scan at mess: POST /api/v1/qr/scan/mode-a with the identity token
- Assert scan result is success with meal type
- Verify QRScanLog record exists in DB
- Verify duplicate scan within 30 min is rejected

TEST 2: `test_full_library_checkout_and_return`
- Register device (use helper from Test 1)
- Create a test book with available_copies=2
- Simulate Mode B scan at library desk: POST /api/v1/qr/scan/mode-b with book QR
- Assert checkout success, book.available_copies now 1
- Simulate scan at return desk: POST /api/v1/qr/scan/mode-b
- Assert response has "select_book" with the checked out book listed
- Confirm return: POST /api/v1/qr/scan/mode-b/confirm with selected book
- Assert book.available_copies back to 2

TEST 3: `test_device_transfer_flow`
- Register device A for student
- Generate identity QR — works
- Initiate transfer: POST /api/v1/device/transfer/initiate
- Complete transfer with device B info: POST /api/v1/device/transfer/complete
- Verify old device trust is status="transferred"
- Complete SMS verification for device B
- Generate identity QR on device B — works
- Attempt identity QR on device A token — should fail (revoked)

TEST 4: `test_dynamic_role_committee_access`
- Create student + committee + assign student as member
- GET /api/v1/me/roles — should include committee role
- GET /api/v1/committees/{id}/grievances — should succeed
- Revoke the role assignment
- GET /api/v1/committees/{id}/grievances — should now return 403

TEST 5: `test_security_levels`
- Level 1 route without Clerk JWT → 401
- Level 2 route without device token → 403
- Level 2 route with expired device token → 403
- Level 4 route without GPS headers → 403
- Level 5 route without biometric header → 403

Run: `pytest backend/tests/e2e/ -v --tb=long`
Then: `pytest backend/tests/ -v --tb=short` (full suite)
```

---

## PROMPT 15: FINAL WIRING + HEALTH CHECKS + OPENAPI

```
TASK: Final wiring, verification, and documentation.

STEP 15A: Update `backend/app/main.py` to include ALL new routes:
```python
# Platform-level routes (shared)
from app.shared.routes.device import router as device_router
from app.shared.routes.qr import router as qr_router
from app.shared.routes.me import router as me_router
from app.shared.routes.webhooks import router as webhooks_router
from app.shared.routes.public import router as public_router

# Admin-level routes (new)
from app.engines.admin.routes.devices import router as admin_devices_router
from app.engines.admin.routes.qr_admin import router as admin_qr_router
from app.engines.admin.routes.role_assignments import router as admin_roles_router

# Committee routes (shared — any user type)
from app.shared.routes.committees import router as committees_router

# Include all
app.include_router(device_router)
app.include_router(qr_router)
app.include_router(me_router)
app.include_router(webhooks_router)
app.include_router(public_router)
app.include_router(admin_devices_router)
app.include_router(admin_qr_router)
app.include_router(admin_roles_router)
app.include_router(committees_router)
```

STEP 15B: Add health check for new subsystems:
Update existing `/health` endpoint to include:
```json
{
  "status": "healthy",
  "subsystems": {
    "database": "ok",
    "redis": "ok",
    "device_trust": "ok",      // Check DeviceTrust table is queryable
    "qr_engine": "ok",         // Check QRActionPoint table is queryable
    "sms_gateway": "ok"        // Check gateway is configured (not connectivity — that's a ping)
  }
}
```

STEP 15C: Verify OpenAPI spec is complete:
- Run the server: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Check http://localhost:8000/docs — all new endpoints should appear with proper tags
- Verify: device-trust, qr, me, webhooks, public, admin-devices, admin-qr, admin-roles, committees

STEP 15D: Generate a route count summary:
```bash
grep -r "router\." backend/app/shared/routes/ backend/app/engines/admin/routes/devices.py backend/app/engines/admin/routes/qr_admin.py backend/app/engines/admin/routes/role_assignments.py | grep -E "@router\.(get|post|put|delete)" | wc -l
```
Expected: ~50+ new endpoints across all route files.

STEP 15E: Run the complete test suite:
```bash
cd backend
pytest tests/ -v --tb=short --co  # Count tests first
pytest tests/ -v --tb=short       # Run all
```
All tests must pass. Fix any failures before considering this complete.

STEP 15F: Update the `__init__.py` public interfaces for engines:
- `app/engines/admin/__init__.py` should expose: qr handler registration function, device admin service
- `app/engines/faculty/__init__.py` should expose: qr handler registration function
- `app/shared/__init__.py` should expose: QRService, DeviceTrustService, DynamicRoleService

Print final summary:
- Total new models: 7 (DeviceTrust, DeviceTransferRequest, DeviceResetLog, QRActionPoint, QRScanLog, DynamicRoleAssignment, CommitteeMeeting, CommitteeActionItem)
- Total new services: 4 (DeviceTrustService, QRService, QRTokenService, DynamicRoleService)
- Total new API endpoints: ~50+
- Total new tests: ~60+
- Total Celery tasks: 7
```

---

## CRITICAL RULES (APPLY TO ALL PROMPTS)

```
1. ASYNC EVERYWHERE: Every service method, route handler, and DB operation uses `async def` with SQLAlchemy async sessions.

2. MULTI-TENANT: QRActionPoint, QRScanLog, DynamicRoleAssignment, CommitteeMeeting, CommitteeActionItem extend TenantModel. EVERY query on these tables must filter by college_id. RLS is the safety net.

3. PLATFORM-LEVEL: DeviceTrust, DeviceTransferRequest, DeviceResetLog are NOT tenant-scoped. They use Base, not TenantModel. No college_id column. No RLS.

4. PYDANTIC V2: All schemas use `model_config = ConfigDict(from_attributes=True)`. Create/Update schemas omit id/college_id/timestamps.

5. MONEY IN PAISA: Any monetary amounts (fines, etc.) stored as BigInteger in paisa.

6. AUDIT: Every create/update/delete on Device Trust writes to audit_log. QRScanLog is itself an audit trail (append-only, never update/delete).

7. INDIAN CONTEXT: Phone numbers: +91XXXXXXXXXX or 10 digits starting 6-9. All times in IST (Asia/Kolkata). SMS gateway: DLT compliance required (MSG91 handles this).

8. EXISTING PATTERNS: Follow the exact same patterns as the Admin Engine backend — same router structure, same service patterns, same test patterns.

9. ERROR HANDLING: HTTPException with: 400 (validation), 401 (auth), 403 (forbidden/device), 404 (not found), 409 (conflict/duplicate).

10. NO RAW SQL: Use SQLAlchemy ORM. Except for RLS SET commands in middleware (text() is fine there).

11. TESTS: Every prompt includes tests. Tests MUST pass before moving to next prompt.

12. EVENT BUS: Use existing Redis Pub/Sub pattern from app/core/events.py.

Do NOT ask questions. Execute each prompt fully. Fix errors before proceeding.
```
