# AQP SUPREME CHECKLIST — Device Trust + QR Engine + Dynamic Roles

**Status:** NOT STARTED
**Total Prompts:** 16 (Prompt 0 through Prompt 15)
**Rule:** Execute sequentially. All tests must pass before moving to next prompt.

---

## PROMPT 0: SHARED INFRASTRUCTURE SETUP
**Goal:** Config vars, shared models refactor, security chain middleware, directory structure

- [ ] **0A — Config vars:** Add 16 new env vars to `backend/app/config.py` Settings class:
  - [ ] DEVICE_TRUST_SECRET (str, min 32 chars)
  - [ ] QR_TOKEN_SECRET (str, min 32 chars)
  - [ ] QR_ACTION_POINT_SECRET (str, HMAC key for Mode B)
  - [ ] SMS_GATEWAY_PROVIDER (str, default "msg91")
  - [ ] MSG91_API_KEY, MSG91_SENDER_ID ("ACOLYT"), MSG91_VIRTUAL_NUMBER, MSG91_DLT_TEMPLATE_ID, MSG91_WEBHOOK_SECRET
  - [ ] KALEYRA_API_KEY, KALEYRA_SID
  - [ ] DEVICE_TOKEN_EXPIRY_DAYS (int, default 180)
  - [ ] QR_IDENTITY_TOKEN_EXPIRY_SECONDS (int, default 300)
  - [ ] QR_IDENTITY_REFRESH_SECONDS (int, default 60)
  - [ ] DEVICE_RESET_FLAG_THRESHOLD (int, default 3)
- [ ] **0B — Shared models refactor:** Split `backend/app/shared/models.py` into package:
  - [ ] Create `backend/app/shared/models/__init__.py` re-exporting Base, TenantModel
  - [ ] Create `backend/app/shared/models/base.py` with Base and TenantModel moved there
  - [ ] Verify all existing imports (`from app.shared.models import Base, TenantModel`) still work
- [ ] **0C — Security chain middleware:** Create `backend/app/middleware/security_chain.py`:
  - [ ] SecurityLevel IntEnum: PUBLIC(0), AUTHENTICATED(1), DEVICE_VERIFIED(2), QR_SECURED(3), ELEVATED(4), STRICT(5)
  - [ ] `require_security(level)` decorator for FastAPI routes
  - [ ] Level 0: No checks
  - [ ] Level 1: Verify request.state.user exists (Clerk JWT)
  - [ ] Level 2: Level 1 + validate X-Device-Trust-Token header (HS256 JWT), verify user match, query DeviceTrust active status
  - [ ] Level 3: Level 2 + validate X-QR-Token header (HS256 JWT), verify typ="identity_qr", verify device fingerprint prefix
  - [ ] Level 4: Level 3 + require X-GPS-Latitude and X-GPS-Longitude headers
  - [ ] Level 5: Level 4 + require X-Biometric-Token header
  - [ ] Each level raises HTTPException 401/403 with descriptive message
- [ ] **0D — Directory structure:** Create directories:
  - [ ] `backend/app/shared/models/`
  - [ ] `backend/app/shared/services/`
  - [ ] `backend/app/shared/schemas/`
  - [ ] `backend/app/shared/routes/`
  - [ ] `backend/app/shared/tasks/`
  - [ ] `backend/app/engines/integration/sms/`
- [ ] **0E — Init files:** Create `__init__.py` for services, routes
- [ ] **Verify:** All existing tests still pass after models refactor

---

## PROMPT 1: DEVICE TRUST — Models + Migration
**Goal:** 3 new database models (platform-level, NO RLS), Alembic migration

- [ ] **1A — DeviceTrust model** (`backend/app/shared/models/device_trust.py`):
  - [ ] Extends Base (NOT TenantModel — platform-level, no college_id)
  - [ ] id (UUID PK), user_id (UUID, indexed)
  - [ ] Device identification: device_fingerprint(64), platform(10), device_id(100), device_model(100), device_manufacturer(100), os_version(20), app_version(20), screen_width, screen_height, ram_mb, sim_operator(50), sim_country(5)
  - [ ] Phone verification: claimed_phone(15), verified_phone(15), phone_verified_at, verification_code_hash(64), verification_code_expires_at, sms_verified(bool default False), sms_gateway_message_id(100)
  - [ ] Trust token: device_trust_token_hash(64), token_issued_at, token_expires_at
  - [ ] Status: status(30, default "pending_sms_verification", indexed) — 7 valid values
  - [ ] Revocation: revoked_at, revoked_by(UUID), revoke_reason(100)
  - [ ] Activity: last_active_at, total_qr_scans(int default 0), last_qr_scan_at
  - [ ] Timestamps: created_at, updated_at with server_default
  - [ ] CRITICAL: Unique partial index on (user_id) WHERE status='active'
  - [ ] Index on (claimed_phone, status)
- [ ] **1A.2 — DeviceTransferRequest model:**
  - [ ] Extends Base (NOT TenantModel)
  - [ ] id, user_id, old_device_trust_id(FK→device_trusts), transfer_code_hash(64), expires_at, status(default "pending"), new_device_trust_id(FK→device_trusts), completed_at, created_at
- [ ] **1A.3 — DeviceResetLog model:**
  - [ ] Extends Base (NOT TenantModel, append-only audit)
  - [ ] id, user_id(indexed), device_trust_id(FK→device_trusts), reset_by(UUID), reset_reason(100), admin_notes(Text), reset_at(server_default)
- [ ] **1B — Update shared models __init__.py:** Export DeviceTrust, DeviceTransferRequest, DeviceResetLog
- [ ] **1C — Alembic migration:**
  - [ ] `alembic revision --autogenerate -m "device_trust_tables"`
  - [ ] Review: unique partial index correct, FKs reference device_trusts.id, NO RLS policies
  - [ ] Apply: `alembic upgrade head`
- [ ] **1D — Verify:** Import check passes

---

## PROMPT 2: DEVICE TRUST — Token Service + Fingerprint
**Goal:** 9 cryptographic functions in qr_token_service.py, unit tests

- [ ] **2A — Create `backend/app/shared/services/qr_token_service.py`:**
  - [ ] `compute_device_fingerprint(device_info) -> str` — SHA-256 of device_id|platform|model|screen_w|screen_h (exclude app_version, os_version, sim_operator)
  - [ ] `create_device_trust_token(user_id, device_trust_id, fingerprint) -> str` — HS256 JWT, payload: sub, did, dfp[:16], typ="device_trust", iat, exp
  - [ ] `validate_device_trust_token(token) -> Optional[dict]` — decode, verify sig+expiry, require all claims
  - [ ] `create_qr_identity_token(user_id, fingerprint, college_id, user_type) -> str` — HS256 JWT, 5-min expiry, payload: sub, typ="identity_qr", dfp[:16], col[:8], utp[:3]
  - [ ] `validate_qr_identity_token(token) -> Optional[dict]` — decode, require typ="identity_qr"
  - [ ] `create_action_point_signature(ap_id, action_type, location_code, college_id, rotation_key) -> str` — HMAC-SHA256, first 32 chars hex
  - [ ] `hash_verification_code(code) -> str` — SHA-256
  - [ ] `generate_verification_code(length=6) -> str` — secrets.randbelow, zero-padded
  - [ ] `generate_transfer_code(length=8) -> str` — 8 digits
- [ ] **2B — Add PyJWT>=2.8.0** to requirements.txt (if not present)
- [ ] **2C — Unit tests** (`backend/tests/shared/test_qr_token_service.py`):
  - [ ] test_compute_fingerprint_deterministic
  - [ ] test_compute_fingerprint_different_devices
  - [ ] test_device_trust_token_roundtrip
  - [ ] test_device_trust_token_expired
  - [ ] test_qr_identity_token_roundtrip
  - [ ] test_qr_identity_token_wrong_secret
  - [ ] test_action_point_signature_deterministic
  - [ ] test_action_point_signature_different_inputs
  - [ ] test_verification_code_length
  - [ ] test_verification_code_randomness (100 codes, all different)
- [ ] **Run tests:** `pytest backend/tests/shared/test_qr_token_service.py -v` — ALL PASS

---

## PROMPT 3: SMS GATEWAY — Abstract + MSG91 + Mock
**Goal:** SMS gateway abstraction with 3 implementations

- [ ] **3A — Factory** (`backend/app/engines/integration/sms/__init__.py`):
  - [ ] `get_sms_gateway()` returns MSG91, Kaleyra, or Mock based on SMS_GATEWAY_PROVIDER
- [ ] **3B — Base** (`backend/app/engines/integration/sms/base.py`):
  - [ ] `IncomingSMS` dataclass: sender, message, received_at, gateway_message_id
  - [ ] Abstract `SMSGateway` class: send_otp(), get_virtual_number(), parse_incoming_webhook()
- [ ] **3C — MSG91** (`backend/app/engines/integration/sms/msg91.py`):
  - [ ] `send_otp`: POST to msg91 API with authkey + template_id
  - [ ] `get_virtual_number`: returns MSG91_VIRTUAL_NUMBER
  - [ ] `parse_incoming_webhook`: normalize sender to +91XXXXXXXXXX
- [ ] **3D — Kaleyra** (`backend/app/engines/integration/sms/kaleyra.py`):
  - [ ] Fallback gateway, similar phone normalization
- [ ] **3E — Mock** (`backend/app/engines/integration/sms/mock.py`):
  - [ ] In-memory dict for pending_verifications
  - [ ] `simulate_incoming_sms()` class method for testing
- [ ] **3F — Dependencies:** httpx already in requirements.txt (0.27.2)
- [ ] **3G — Tests** (`backend/tests/integration/test_sms_gateway.py`):
  - [ ] test_mock_gateway_send_otp_stores_in_memory
  - [ ] test_mock_gateway_simulate_incoming
  - [ ] test_msg91_phone_normalization (10-digit, 12-digit, +91)
  - [ ] test_factory_returns_mock_for_test_env
- [ ] **Run tests:** ALL PASS

---

## PROMPT 4: DEVICE TRUST — Service Layer
**Goal:** Complete DeviceTrustService with 8 methods + Pydantic schemas

- [ ] **Create `backend/app/shared/services/device_trust_service.py`:**
  - [ ] Constructor: db (AsyncSession), event_bus (EventBus), sms_gateway (SMSGateway)
  - [ ] METHOD 1: `register_device` — verify phone matches user, check no active device, compute fingerprint, generate code, create DeviceTrust record, return verification info
  - [ ] METHOD 2: `process_incoming_sms` — parse "ACOLYTE VERIFY {code}", match by phone+code+status, activate device, generate trust token, publish event
  - [ ] METHOD 3: `check_registration_status` — poll endpoint logic, return status + token if active
  - [ ] METHOD 4: `validate_device` — decode token, verify user match, query active DeviceTrust
  - [ ] METHOD 5: `initiate_transfer` — query active device, generate 8-digit transfer code
  - [ ] METHOD 6: `complete_transfer` — validate transfer code, revoke old device, start new registration
  - [ ] METHOD 7: `revoke_device` — set status revoked, create DeviceResetLog if admin, publish event
  - [ ] METHOD 8: `get_flagged_users` — group by user_id, count resets in period
- [ ] **Create Pydantic schemas** (`backend/app/shared/schemas/device.py`):
  - [ ] DeviceInfo, RegisterDeviceRequest, RegisterDeviceResponse
  - [ ] DeviceStatusResponse, TransferInitiateResponse, TransferCompleteRequest
  - [ ] DeviceResetRequest, DeviceTrustResponse, FlaggedUserResponse
- [ ] **Tests** (`backend/tests/shared/test_device_trust_service.py`):
  - [ ] Cover all 8 methods with mock SMS gateway
- [ ] **Run tests:** ALL PASS

---

## PROMPT 5: DEVICE TRUST — API Routes
**Goal:** 12 API endpoints across 3 route files

- [ ] **5A — User device routes** (`backend/app/shared/routes/device.py`, prefix `/api/v1/device`):
  - [ ] POST /register — SecurityLevel.AUTHENTICATED
  - [ ] POST /resend-sms — regenerate code
  - [ ] GET /status — poll registration status
  - [ ] POST /transfer/initiate — SecurityLevel.DEVICE_VERIFIED
  - [ ] POST /transfer/complete — SecurityLevel.AUTHENTICATED
  - [ ] DELETE /revoke — SecurityLevel.DEVICE_VERIFIED
- [ ] **5B — Webhook routes** (`backend/app/shared/routes/webhooks.py`, prefix `/api/v1/webhooks`):
  - [ ] POST /sms/incoming — NO AUTH, validated by secret query param
- [ ] **5C — Admin device routes** (`backend/app/engines/admin/routes/devices.py`, prefix `/api/v1/admin/devices`):
  - [ ] GET / — list devices (pagination, filters)
  - [ ] GET /{user_id} — device info for user
  - [ ] POST /{user_id}/reset — admin reset
  - [ ] GET /flagged — suspicious reset users
  - [ ] GET /stats — registration statistics
- [ ] **5D — Register routes in main.py**
- [ ] **5E — Integration tests** (`backend/tests/api/test_device_api.py`):
  - [ ] test_register_device_returns_verification_code
  - [ ] test_register_device_duplicate_active_rejected
  - [ ] test_status_poll_pending_before_sms
  - [ ] test_sms_webhook_activates_device
  - [ ] test_status_poll_active_after_sms_returns_token
  - [ ] test_admin_reset_revokes_device
  - [ ] test_admin_reset_creates_audit_log
  - [ ] test_flagged_users_threshold
- [ ] **Run ALL tests:** `pytest backend/tests/ -v --tb=short` — ALL PASS

---

## PROMPT 6: QR ENGINE — Models + Migration
**Goal:** 2 new models (QRActionPoint + QRScanLog), both tenant-scoped with RLS

- [ ] **6A — QRActionPoint model** (`backend/app/shared/models/qr.py`):
  - [ ] Extends TenantModel (college_id, RLS)
  - [ ] name(255), description(Text), action_type(30, indexed) — 14 types
  - [ ] location_code(50), qr_mode(10) — "mode_a" or "mode_b"
  - [ ] Physical: building, floor, gps_latitude, gps_longitude, geo_radius_meters(default 100)
  - [ ] QR config: qr_rotation_minutes(default 0), qr_secret(64)
  - [ ] Duplicate: duplicate_window_minutes(default 30)
  - [ ] Linked entity: linked_entity_type, linked_entity_id
  - [ ] Security: security_level(default "standard")
  - [ ] Scanner: scanner_device_trust_id(FK→device_trusts)
  - [ ] Hours: active_hours_start(5), active_hours_end(5), active_days(JSONB default [0-5])
  - [ ] metadata(JSONB), is_active(bool default True)
  - [ ] UniqueConstraint(college_id, location_code)
  - [ ] Index(college_id, action_type)
- [ ] **6A.2 — QRScanLog model:**
  - [ ] Extends TenantModel (append-only)
  - [ ] Who: user_id(indexed), user_type(10), device_trust_id(FK)
  - [ ] What: action_type(30, indexed), action_point_id(FK), qr_mode(10)
  - [ ] Context: entity_type(30), entity_id(UUID), metadata(JSONB)
  - [ ] Location: scan_latitude, scan_longitude, geo_validated(bool)
  - [ ] Validation: device_validated(bool), biometric_confirmed(bool), validation_result(20), rejection_reason(Text)
  - [ ] Timestamp: scanned_at(server_default)
  - [ ] Composite indexes: (college_id, user_id, action_type, scanned_at), (college_id, action_point_id, scanned_at)
- [ ] **6B — Update shared models __init__.py:** Export QRActionPoint, QRScanLog
- [ ] **6C — Alembic migration:**
  - [ ] `alembic revision --autogenerate -m "qr_engine_tables"`
  - [ ] Review: RLS policies for BOTH tables, unique constraint, all indexes, FK to device_trusts
  - [ ] Apply: `alembic upgrade head`

---

## PROMPT 7: QR ENGINE — Core Service + Action Handler Registry
**Goal:** QRService with scan pipeline, Haversine geo-validation, handler registry

- [ ] **Create `backend/app/shared/services/qr_service.py`:**
  - [ ] QRService class: db, event_bus, _action_handlers dict
  - [ ] `register_handler(action_type, handler)` — stores handler
  - [ ] `generate_identity_qr(user_id, college_id)` — verify active device, create identity token
  - [ ] `process_mode_a_scan(scanner_user_id, scanner_device, qr_data, action_point_id, gps)` — full 11-step pipeline: decode JWT → verify device → verify fingerprint → get AP config → GPS check → duplicate check → execute handler → log → publish event
  - [ ] `process_mode_b_scan(user_id, user_device, qr_data, gps)` — parse acolyte:// URL, validate HMAC signature, check rotation, same steps 5-11
  - [ ] `_validate_geo(user_gps, target_lat, target_lng, radius)` — Haversine formula
  - [ ] `_parse_action_qr(qr_data)` — parse `acolyte://v1/{action}?ap=...&sig=...&r=...` with urllib.parse
  - [ ] `_check_duplicate(user_id, action_type, window_minutes)` — query QRScanLog
  - [ ] `_log_failed_scan(user_id, qr_mode, result, reason)` — create failed QRScanLog
- [ ] **Create Pydantic schemas** (`backend/app/shared/schemas/qr.py`):
  - [ ] ScanResult, GPSCoordinates, ModeAScanRequest, ModeBScanRequest, ModeBConfirmRequest
  - [ ] IdentityQRResponse, QRActionPointCreate/Update/Response
  - [ ] QRScanLogResponse, ScanLogFilterParams
- [ ] **Tests** (`backend/tests/shared/test_qr_service.py`):
  - [ ] 12 tests covering: identity QR gen, mode A valid/expired/mismatch/duplicate, mode B valid/tampered, geo within/outside radius, parse valid/invalid
- [ ] **Run tests:** ALL PASS

---

## PROMPT 8: QR ENGINE — Action Handlers
**Goal:** 9 action handlers across admin and faculty engines

- [ ] **8A — Admin handlers** (`backend/app/engines/admin/services/qr_handlers.py`):
  - [ ] `handle_mess_entry` — determine meal by hour, check duplicate per meal per day
  - [ ] `handle_library_checkout` — check available copies, check student <3 active, create LibraryIssuance
  - [ ] `handle_library_return` — query active issuances, return select list
  - [ ] `handle_hostel_checkin` — toggle entry/exit, detect curfew violation (10pm-5am)
  - [ ] `handle_equipment_checkout` — check equipment available
  - [ ] `register_admin_qr_handlers(qr_service)` — registers all above
- [ ] **8B — Faculty handlers** (`backend/app/engines/faculty/services/qr_handlers.py`):
  - [ ] `handle_attendance_mark` — extract class_session_id from AP metadata
  - [ ] `handle_clinical_posting` — check active ClinicalRotation, track hours
  - [ ] `handle_event_checkin` — log CME/FDP attendance
  - [ ] `handle_exam_hall_entry` — verify exam registration, requires STRICT security
  - [ ] `register_faculty_qr_handlers(qr_service)` — registers all above
- [ ] **8C — Wire in main.py:** Register handlers at startup
- [ ] **8D — Tests:**
  - [ ] test_mess_entry_breakfast_before_10am, test_mess_entry_duplicate_same_meal_rejected
  - [ ] test_library_checkout_success, test_library_checkout_no_copies, test_library_checkout_max_3
  - [ ] test_hostel_entry_after_curfew_flagged
  - [ ] test_attendance_mark_with_gps, test_clinical_posting_no_active_rotation
- [ ] **Run ALL tests:** ALL PASS

---

## PROMPT 9: QR ENGINE — API Routes
**Goal:** ~20 endpoints across user, admin, and public route files

- [ ] **9A — User QR routes** (`backend/app/shared/routes/qr.py`, prefix `/api/v1/qr`):
  - [ ] GET /identity — SecurityLevel.DEVICE_VERIFIED
  - [ ] GET /identity/refresh — force refresh
  - [ ] POST /scan/mode-a — scanner reads person's QR
  - [ ] POST /scan/mode-b — person scans location QR
  - [ ] POST /scan/mode-b/confirm — multi-step confirm (library return, equipment return)
  - [ ] GET /history — current user scan history (paginated, filtered)
  - [ ] GET /history/meals, /history/library, /history/attendance — filtered views
- [ ] **9B — Admin QR routes** (`backend/app/engines/admin/routes/qr_admin.py`, prefix `/api/v1/admin/qr`):
  - [ ] GET /action-points — list with filters
  - [ ] POST /action-points — create (auto-gen qr_secret)
  - [ ] PUT /action-points/{id} — update
  - [ ] DELETE /action-points/{id} — soft deactivate
  - [ ] GET /action-points/{id}/generate — printable QR image (base64)
  - [ ] GET /action-points/{id}/stats — scan statistics
  - [ ] GET /scan-logs — all logs with filters
  - [ ] GET /scan-logs/summary — daily counts by action type
  - [ ] GET /scan-logs/anomalies — failed scans by reason
  - [ ] GET /scan-logs/export — CSV StreamingResponse
- [ ] **9C — Public routes** (`backend/app/shared/routes/public.py`, prefix `/api/v1/public`):
  - [ ] GET /verify/{certificate_number} — certificate verification via QR (no auth)
- [ ] **9D — Dependencies:** Add `qrcode>=7.4` and `Pillow>=10.0` to requirements.txt
- [ ] **9E — Register all routes in main.py**
- [ ] **9F — Integration tests for QR API routes**
- [ ] **Run ALL tests:** ALL PASS

---

## PROMPT 10: DYNAMIC ROLES — Models + Migration
**Goal:** 3 new models (DynamicRoleAssignment + CommitteeMeeting + CommitteeActionItem), all tenant-scoped

- [ ] **10A — DynamicRoleAssignment** (`backend/app/shared/models/dynamic_roles.py`):
  - [ ] Extends TenantModel
  - [ ] user_id, user_type(20), user_name(255)
  - [ ] role_type(50, indexed), context_type(30), context_id(UUID), context_name(255)
  - [ ] valid_from(Date), valid_until(Date nullable), is_active(bool), auto_deactivate(bool)
  - [ ] assigned_by(UUID), assigned_by_name, assignment_order_url(500), notes(Text)
  - [ ] permissions(JSONB default [])
  - [ ] Indexes: (college_id, user_id, is_active), (college_id, context_type, context_id)
  - [ ] UniqueConstraint(college_id, user_id, role_type, context_id)
- [ ] **10B — CommitteeMeeting** (`backend/app/shared/models/committee.py`):
  - [ ] Extends TenantModel
  - [ ] committee_id(UUID, indexed), title, description, meeting_date(DateTime tz), location
  - [ ] agenda(JSONB), minutes_text, minutes_file_url, minutes_filed_by, minutes_filed_at
  - [ ] attendees(JSONB), quorum_met(bool), status(default "scheduled")
- [ ] **10B.2 — CommitteeActionItem:**
  - [ ] Extends TenantModel
  - [ ] committee_id(indexed), meeting_id(FK→committee_meetings)
  - [ ] title, description, assigned_to(UUID), assigned_to_name, due_date, status, completed_at, notes
- [ ] **10C — Update shared models __init__.py**
- [ ] **10D — Alembic migration:**
  - [ ] `alembic revision --autogenerate -m "dynamic_roles_committee_tables"`
  - [ ] Add RLS policies for all 3 tables
  - [ ] Apply: `alembic upgrade head`

---

## PROMPT 11: DYNAMIC ROLES — Service + Routes
**Goal:** Role service, committee service, ~20 API endpoints

- [ ] **11A — DynamicRoleService** (`backend/app/shared/services/dynamic_role_service.py`):
  - [ ] `get_user_roles(user_id, college_id)` — active assignments, sorted
  - [ ] `get_user_committee_roles(user_id, college_id)` — filtered to committees
  - [ ] `assign_role(data, assigned_by)` — check no duplicate, determine permissions, publish event
  - [ ] `revoke_role(assignment_id, revoked_by, reason)` — set is_active=False, publish event
  - [ ] `get_expiring_roles(days=30)` — roles expiring within N days
- [ ] **11B — Committee service methods:**
  - [ ] get_committee_detail, get_committee_grievances, get_committee_meetings
  - [ ] create_committee_meeting (chair/secretary only)
  - [ ] file_meeting_minutes (secretary/chair only)
  - [ ] get_committee_action_items, update_action_item
- [ ] **11C — Pydantic schemas** (`backend/app/shared/schemas/roles.py`):
  - [ ] RoleAssignmentCreate/Update/Response
  - [ ] MeetingCreate/Response, MinutesUpload
  - [ ] ActionItemCreate/Update/Response, UserRolesResponse
- [ ] **11D — User role routes** (`backend/app/shared/routes/me.py`, prefix `/api/v1/me`):
  - [ ] GET /roles — all active dynamic roles
  - [ ] GET /committees — committee roles only
- [ ] **11E — Committee routes** (`backend/app/shared/routes/committees.py`, prefix `/api/v1/committees`):
  - [ ] GET /{id} — committee detail (member check)
  - [ ] GET /{id}/grievances — assigned cases
  - [ ] GET /{id}/meetings — meeting list
  - [ ] POST /{id}/meetings — schedule meeting (chair/secretary)
  - [ ] GET /{id}/meetings/{mid} — meeting detail + minutes
  - [ ] POST /{id}/meetings/{mid}/minutes — upload minutes
  - [ ] GET /{id}/documents — committee documents
  - [ ] GET /{id}/action-items — action items
  - [ ] PUT /{id}/action-items/{aid} — update action item
- [ ] **11F — Admin role routes** (`backend/app/engines/admin/routes/role_assignments.py`, prefix `/api/v1/admin/role-assignments`):
  - [ ] GET / — list all
  - [ ] POST / — create
  - [ ] PUT /{id} — update
  - [ ] DELETE /{id} — revoke
  - [ ] GET /expiring — expiring within 30 days
- [ ] **11G — Register all routes in main.py**
- [ ] **11H — Tests:**
  - [ ] test_get_user_roles_returns_active_only
  - [ ] test_assign_role_prevents_duplicate
  - [ ] test_revoke_role_sets_inactive
  - [ ] test_committee_member_can_view_grievances
  - [ ] test_non_member_blocked_from_committee
  - [ ] test_chair_can_schedule_meeting
  - [ ] test_member_cannot_schedule_meeting
  - [ ] test_auto_deactivate_expired_roles
- [ ] **Run ALL tests:** ALL PASS

---

## PROMPT 12: CELERY TASKS + EVENT BUS WIRING
**Goal:** 7 background tasks + event publishing verification

- [ ] **12A — Device tasks** (`backend/app/shared/tasks/device_tasks.py`):
  - [ ] `check_expired_device_tokens` — daily 2 AM IST: mark expired tokens
  - [ ] `flag_suspicious_device_resets` — daily 3 AM IST: flag users with 3+ resets in 30 days
  - [ ] `cleanup_expired_transfer_requests` — hourly: expire pending transfers
- [ ] **12B — QR tasks** (`backend/app/shared/tasks/qr_tasks.py`):
  - [ ] `rotate_action_point_qrs` — every 60 seconds: generate new QR data for rotating APs
  - [ ] `generate_qr_daily_report` — daily midnight: aggregate scan counts
- [ ] **12C — Role tasks** (`backend/app/shared/tasks/role_tasks.py`):
  - [ ] `check_expiring_roles` — daily 8 AM IST: publish events for roles expiring within 7 days
  - [ ] `auto_deactivate_expired_roles` — daily 1 AM IST: deactivate past-due roles
- [ ] **12D — Register in celery_app.py** beat_schedule — all 7 tasks with correct schedules
- [ ] **12E — Verify event publishing:**
  - [ ] device_trust_service: device.registered, device.revoked, device.transferred
  - [ ] qr_service: qr.{action_type} for every successful scan
  - [ ] dynamic_role_service: role.assigned, role.revoked
- [ ] **Tests for each Celery task**
- [ ] **Run ALL tests:** ALL PASS

---

## PROMPT 13: SEED DATA
**Goal:** Seed script with 15 QR action points, 4 role assignments, 2 committee meetings

- [ ] **Create `backend/scripts/seed_qr_and_roles.py`:**
- [ ] **Section 1 — 15 QR Action Points:**
  - [ ] mess_main_entrance (mode_a, 50m radius, 30min duplicate)
  - [ ] mess_pg_entrance (mode_a)
  - [ ] library_entrance (mode_a, library_visit)
  - [ ] library_desk_1 (mode_b, library_checkout, static QR)
  - [ ] library_return_desk (mode_b, library_return)
  - [ ] anatomy_lecture_hall (mode_b, attendance, 5min rotation, elevated security)
  - [ ] physiology_lecture_hall (mode_b, attendance)
  - [ ] biochemistry_lecture_hall (mode_b, attendance)
  - [ ] hostel_boys_gate (mode_a, hostel_checkin)
  - [ ] hostel_girls_gate (mode_a, hostel_checkin)
  - [ ] medicine_ward (mode_b, clinical_posting, elevated)
  - [ ] surgery_ward (mode_b, clinical_posting)
  - [ ] ob_gyn_ward (mode_b, clinical_posting)
  - [ ] pediatrics_ward (mode_b, clinical_posting)
  - [ ] exam_hall_1 (mode_a, exam_hall_entry, strict security)
- [ ] **Section 2 — 4 Dynamic Role Assignments:**
  - [ ] Student → committee_member on Anti-Ragging Committee (view_cases, view_minutes, view_documents)
  - [ ] Faculty → committee_chair on Anti-Ragging Committee (all permissions)
  - [ ] Student → class_representative for Batch 2024 Phase I
  - [ ] Faculty → exam_invigilator (7-day validity)
- [ ] **Section 3 — 2 Committee Meetings:**
  - [ ] Future meeting: scheduled next week, 3 agenda items
  - [ ] Past meeting: completed, minutes filed
- [ ] **Run seed script:** Verify 15 APs + 4 roles + 2 meetings created

---

## PROMPT 14: END-TO-END INTEGRATION TESTS
**Goal:** 5 comprehensive E2E tests

- [ ] **Create `backend/tests/e2e/test_qr_full_flow.py`:**
  - [ ] TEST 1: `test_full_device_registration_and_mess_scan` — register → SMS verify → get identity QR → scan at mess → verify log → duplicate rejected
  - [ ] TEST 2: `test_full_library_checkout_and_return` — register → checkout book → available_copies decremented → scan return → select book → confirm → copies restored
  - [ ] TEST 3: `test_device_transfer_flow` — register device A → initiate transfer → complete on device B → old device revoked → verify new device works → old device fails
  - [ ] TEST 4: `test_dynamic_role_committee_access` — create role → GET /me/roles includes it → access committee grievances → revoke role → access returns 403
  - [ ] TEST 5: `test_security_levels` — level 1 no JWT→401 → level 2 no device token→403 → level 4 no GPS→403 → level 5 no biometric→403
- [ ] **Run E2E tests:** `pytest backend/tests/e2e/ -v --tb=long`
- [ ] **Run full suite:** `pytest backend/tests/ -v --tb=short` — ALL PASS

---

## PROMPT 15: FINAL WIRING + HEALTH CHECKS + OPENAPI
**Goal:** All routes registered, health checks updated, OpenAPI verified, full test suite green

- [ ] **15A — Verify all routes in main.py:**
  - [ ] device_router, qr_router, me_router, webhooks_router, public_router
  - [ ] admin_devices_router, admin_qr_router, admin_roles_router
  - [ ] committees_router
- [ ] **15B — Health check update:** Add device_trust, qr_engine, sms_gateway subsystem checks
- [ ] **15C — Verify OpenAPI:** Start server, check /docs — all new endpoint tags appear
- [ ] **15D — Route count:** ~50+ new endpoints
- [ ] **15E — Full test suite:** `pytest tests/ -v --tb=short` — ALL PASS
- [ ] **15F — Update __init__.py public interfaces:**
  - [ ] admin __init__.py: expose QR handler registration, device admin service
  - [ ] faculty __init__.py: expose QR handler registration
  - [ ] shared __init__.py: expose QRService, DeviceTrustService, DynamicRoleService
- [ ] **Final summary verified:**
  - [ ] 8 new models (DeviceTrust, DeviceTransferRequest, DeviceResetLog, QRActionPoint, QRScanLog, DynamicRoleAssignment, CommitteeMeeting, CommitteeActionItem)
  - [ ] 4 services (DeviceTrustService, QRService, QRTokenService, DynamicRoleService)
  - [ ] 50+ new API endpoints
  - [ ] 60+ new tests
  - [ ] 7 Celery tasks

---

## CRITICAL RULES (ENFORCED ON EVERY PROMPT)

1. **ASYNC EVERYWHERE** — `async def` on all service methods, route handlers, DB operations
2. **MULTI-TENANT** — QRActionPoint, QRScanLog, DynamicRoleAssignment, CommitteeMeeting, CommitteeActionItem extend TenantModel. Every query filters by college_id. RLS is safety net.
3. **PLATFORM-LEVEL** — DeviceTrust, DeviceTransferRequest, DeviceResetLog use Base (NOT TenantModel). No college_id. No RLS.
4. **PYDANTIC V2** — `model_config = ConfigDict(from_attributes=True)`. Create/Update schemas omit id/college_id/timestamps.
5. **MONEY IN PAISA** — BigInteger for monetary amounts
6. **AUDIT** — Device Trust writes to audit_log. QRScanLog is append-only (never update/delete).
7. **INDIAN CONTEXT** — Phone +91XXXXXXXXXX. IST timezone. DLT compliance.
8. **EXISTING PATTERNS** — Follow Admin Engine patterns exactly (same router, service, test structure).
9. **ERROR HANDLING** — HTTPException: 400/401/403/404/409
10. **NO RAW SQL** — SQLAlchemy ORM only (except RLS SET via text())
11. **TESTS MUST PASS** — before proceeding to next prompt
12. **EVENT BUS** — Use existing Redis Pub/Sub from app/core/events.py
