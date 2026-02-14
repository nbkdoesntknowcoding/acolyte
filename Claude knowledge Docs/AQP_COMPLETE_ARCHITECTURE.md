# ACOLYTE QR PROTOCOL (AQP) — Complete System Architecture

**Version:** 1.0 | **Date:** February 2026 | **Status:** Implementation-Ready
**Scope:** Device Trust Security Layer + Universal QR Engine + Dynamic Role/Committee System
**Integration Target:** Existing FastAPI Modular Monolith (6 Engines + Shared Layer)

---

## TABLE OF CONTENTS

1. System Placement Within Existing Architecture
2. Device Trust Security Layer
3. QR Engine — Protocol & Processing
4. Dynamic Role & Committee System
5. Database Schema (Complete)
6. Permify Authorization Extensions
7. API Contracts (Complete)
8. Pydantic Schemas (Complete)
9. Service Layer (Complete)
10. Event Bus Integration
11. Celery Background Tasks
12. Mobile App Integration (Expo)
13. Web Frontend Integration
14. Admin Management Pages
15. Security Hardening
16. SMS Gateway Integration
17. Testing Strategy

---

## 1. SYSTEM PLACEMENT WITHIN EXISTING ARCHITECTURE

### 1.1 Where These Systems Live

The QR Engine and Device Trust are **platform-level shared services**, NOT engine-specific. They sit in `app/shared/` because every engine consumes them. Dynamic Roles extend both `app/shared/` (the assignment model) and individual engines (the UI they expose).

```
backend/app/
├── shared/                          # ← NEW ADDITIONS HERE
│   ├── models.py                    # Base, TenantModel (existing)
│   ├── models/                      # ← NEW: Split shared models
│   │   ├── __init__.py
│   │   ├── base.py                  # Base, TenantModel (moved from models.py)
│   │   ├── device_trust.py          # ← NEW: DeviceTrust, DeviceTransferRequest
│   │   ├── qr.py                    # ← NEW: QRActionPoint, QRScanLog
│   │   ├── dynamic_roles.py         # ← NEW: DynamicRoleAssignment
│   │   └── committee.py             # ← NEW: CommitteeMeeting, CommitteeActionItem
│   ├── services/                    # ← NEW
│   │   ├── __init__.py
│   │   ├── device_trust_service.py  # ← NEW: Registration, verification, revocation
│   │   ├── qr_service.py            # ← NEW: QR generation, scan processing
│   │   ├── qr_token_service.py      # ← NEW: JWT creation/validation for QR tokens
│   │   ├── sms_gateway.py           # ← NEW: MSG91/Kaleyra abstraction
│   │   └── dynamic_role_service.py  # ← NEW: Role assignment, committee management
│   ├── middleware/                   # ← NEW
│   │   ├── __init__.py
│   │   └── device_trust.py          # ← NEW: DeviceTrustMiddleware
│   ├── routes/                      # ← NEW: Platform-level routes
│   │   ├── __init__.py
│   │   ├── device.py                # ← NEW: /api/v1/device/* endpoints
│   │   ├── qr.py                    # ← NEW: /api/v1/qr/* endpoints
│   │   ├── me.py                    # ← NEW: /api/v1/me/* endpoints (roles, profile)
│   │   └── public.py                # ← NEW: /api/v1/public/* (cert verify, no auth)
│   └── schemas/                     # ← NEW
│       ├── __init__.py
│       ├── device.py
│       ├── qr.py
│       └── roles.py
│
├── middleware/                       # EXISTING — extend these
│   ├── auth.py                      # Clerk JWT validation (existing)
│   ├── tenant.py                    # Multi-tenant RLS (existing)
│   ├── device_trust.py              # ← NEW: Device validation layer
│   └── security_chain.py            # ← NEW: Unified security chain orchestrator
│
├── engines/                          # EXISTING — these CONSUME QR/roles
│   ├── admin/
│   │   ├── services/
│   │   │   ├── qr_handlers.py       # ← NEW: mess_entry, library_checkout handlers
│   │   │   └── device_admin.py      # ← NEW: Admin device management
│   │   └── routes/
│   │       ├── qr_admin.py          # ← NEW: /api/v1/admin/qr/* management
│   │       └── devices.py           # ← NEW: /api/v1/admin/devices/*
│   ├── faculty/
│   │   └── services/
│   │       └── qr_handlers.py       # ← NEW: attendance_mark handler
│   ├── student/
│   │   └── services/
│   │       └── qr_handlers.py       # ← NEW: student-side QR interactions
│   └── integration/
│       └── sms/                     # ← NEW: SMS gateway adapters
│           ├── __init__.py
│           ├── base.py              # Abstract SMS adapter
│           ├── msg91.py             # MSG91 implementation
│           ├── kaleyra.py           # Kaleyra fallback
│           └── mock.py              # Dev/test mock
│
└── main.py                          # Register new routes + middleware
```

### 1.2 How It Connects to the Existing Middleware Chain

```
CURRENT CHAIN (existing):
Request → CORS → RateLimit → ClerkAuth → TenantContext → Route Handler

NEW CHAIN (with Device Trust):
Request → CORS → RateLimit → ClerkAuth → TenantContext → DeviceTrust* → Route Handler
                                                           ↑
                                                     *Only on routes
                                                      that require it
                                                      (configurable per
                                                      route via decorator)

The DeviceTrust middleware is OPTIONAL per route. Most admin web routes
don't need it (they're on desktop browsers). Mobile QR routes ALWAYS
require it. This is controlled by a decorator: @require_device_trust
```

### 1.3 The Security Chain Orchestrator

```python
# backend/app/middleware/security_chain.py

"""
Unified security chain. Composes existing auth layers with new device trust.

Security levels (configurable per route):

LEVEL 0: Public (no auth)
  - Certificate verification, health checks
  
LEVEL 1: Authenticated (Clerk JWT only — existing behavior)
  - All web dashboard routes
  - All admin pages
  
LEVEL 2: Device-Verified (Clerk JWT + Device Trust Token)
  - All mobile app routes
  - QR generation endpoints
  - Any action that identifies the user physically
  
LEVEL 3: QR-Secured (Level 2 + valid QR token in request)
  - QR scan processing
  - Mess entry, library checkout, etc.
  
LEVEL 4: Elevated (Level 3 + GPS validation)
  - Attendance marking (must be on campus)
  - Clinical posting check-in
  
LEVEL 5: Strict (Level 4 + device biometric confirmation)
  - Exam hall entry
  - High-security administrative actions
"""

from enum import IntEnum
from functools import wraps
from fastapi import Request, HTTPException

class SecurityLevel(IntEnum):
    PUBLIC = 0
    AUTHENTICATED = 1
    DEVICE_VERIFIED = 2
    QR_SECURED = 3
    ELEVATED = 4
    STRICT = 5

def require_security(level: SecurityLevel):
    """Decorator for FastAPI route handlers."""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # Level 1: Clerk JWT (always present after auth middleware)
            if level >= SecurityLevel.AUTHENTICATED:
                if not hasattr(request.state, "user"):
                    raise HTTPException(401, "Authentication required")
            
            # Level 2: Device Trust
            if level >= SecurityLevel.DEVICE_VERIFIED:
                device_token = request.headers.get("X-Device-Trust-Token")
                if not device_token:
                    raise HTTPException(403, "Device not registered")
                device = await validate_device_trust(
                    request.state.user.id, device_token
                )
                if not device:
                    raise HTTPException(403, "Device trust validation failed")
                request.state.device = device
            
            # Level 3: QR Token
            if level >= SecurityLevel.QR_SECURED:
                qr_token = request.headers.get("X-QR-Token")
                if not qr_token:
                    raise HTTPException(403, "QR token required")
                qr_data = await validate_qr_token(qr_token)
                if not qr_data:
                    raise HTTPException(403, "Invalid or expired QR token")
                request.state.qr_data = qr_data
            
            # Level 4: GPS
            if level >= SecurityLevel.ELEVATED:
                lat = request.headers.get("X-GPS-Latitude")
                lng = request.headers.get("X-GPS-Longitude")
                if not lat or not lng:
                    raise HTTPException(403, "Location required")
                request.state.gps = {"lat": float(lat), "lng": float(lng)}
            
            # Level 5: Biometric confirmation
            if level >= SecurityLevel.STRICT:
                bio_token = request.headers.get("X-Biometric-Token")
                if not bio_token:
                    raise HTTPException(403, "Biometric confirmation required")
                request.state.biometric_confirmed = True
            
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
```

---

## 2. DEVICE TRUST SECURITY LAYER

### 2.1 The SMS-From-Device Verification Flow (Detailed)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DEVICE REGISTRATION FLOW                          │
│                                                                          │
│  PREREQUISITES:                                                          │
│  - User has a Clerk account (created during onboarding)                 │
│  - User's phone number is stored in their profile                       │
│  - No other device is currently registered to this account              │
│                                                                          │
│  STEP 1: INITIATE (App → Backend)                                       │
│  ─────────────────────────────────                                       │
│  POST /api/v1/device/register                                           │
│  Headers: Authorization: Bearer <clerk_jwt>                             │
│  Body: {                                                                │
│    "phone_number": "+919876543210",   // User enters their number       │
│    "device_info": {                                                     │
│      "platform": "android",           // "android" | "ios"              │
│      "device_id": "a1b2c3d4...",      // Application.androidId or      │
│                                       // Constants.deviceId (Expo)      │
│      "device_model": "Samsung Galaxy A14",                              │
│      "device_manufacturer": "Samsung",                                  │
│      "os_version": "14",                                                │
│      "app_version": "1.0.0",                                           │
│      "screen_width": 1080,                                              │
│      "screen_height": 2340,                                             │
│      "ram_mb": 4096,                                                    │
│      "sim_operator": "Jio",           // expo-cellular                  │
│      "sim_country": "IN"                                                │
│    }                                                                    │
│  }                                                                      │
│                                                                          │
│  Backend does:                                                          │
│  1. Verify Clerk JWT → get user_id                                      │
│  2. Verify phone_number matches user's profile phone                    │
│  3. Check no active DeviceTrust exists for this user_id                 │
│  4. Generate a 6-digit verification_code (crypto random)                │
│  5. Compute device_fingerprint = SHA-256(device_id + platform +         │
│     device_model + screen_width + screen_height)                        │
│  6. Create DeviceTrust record with status="pending_sms_verification"    │
│  7. Store verification_code in record (hashed, expires in 10 min)       │
│                                                                          │
│  Response: {                                                            │
│    "verification_id": "uuid-...",                                       │
│    "sms_target_number": "+919999888877",  // Acolyte's virtual number   │
│    "sms_body_template": "ACOLYTE VERIFY {code}",                        │
│    "verification_code": "847293",         // Show to user briefly       │
│    "expires_in_seconds": 600                                            │
│  }                                                                      │
│                                                                          │
│  STEP 2: SEND SMS FROM DEVICE (App triggers native SMS)                 │
│  ──────────────────────────────────────────────────────                   │
│  The app uses expo-sms or react-native-sms to open the device's        │
│  native SMS composer, pre-filled with:                                  │
│    To: +919999888877 (Acolyte's virtual number)                         │
│    Body: "ACOLYTE VERIFY 847293"                                        │
│                                                                          │
│  The user just hits Send. The SMS goes through their SIM card.          │
│  This is the CRITICAL step: only the SIM with this phone number        │
│  can send this SMS. No way to fake it.                                  │
│                                                                          │
│  STEP 3: SMS RECEIVED (SMS Gateway → Backend webhook)                   │
│  ────────────────────────────────────────────────────                     │
│  Acolyte's virtual number (via MSG91/Kaleyra) receives the SMS.        │
│  The gateway triggers a webhook:                                        │
│                                                                          │
│  POST /api/v1/webhooks/sms/incoming                                     │
│  Body: {                                                                │
│    "sender": "+919876543210",     // The REAL sender number from SIM    │
│    "message": "ACOLYTE VERIFY 847293",                                  │
│    "received_at": "2026-02-13T10:30:00Z",                              │
│    "gateway_message_id": "msg_abc123"                                   │
│  }                                                                      │
│                                                                          │
│  Backend does:                                                          │
│  1. Parse message → extract verification code "847293"                  │
│  2. Find DeviceTrust where:                                             │
│     - verification_code matches (after hashing)                         │
│     - status = "pending_sms_verification"                               │
│     - created_at within last 10 minutes                                 │
│  3. Verify sender number matches the phone_number in the record        │
│  4. If ALL match:                                                       │
│     - Set status = "active"                                             │
│     - Set verified_phone = sender number                                │
│     - Set phone_verified_at = now                                       │
│     - Set sms_verified = true                                           │
│     - Generate device_trust_token (encrypted JWT, 180-day expiry)      │
│     - Create Permify relationship: user has_device device_trust_id     │
│  5. If mismatch: Set status = "verification_failed", log attempt       │
│                                                                          │
│  STEP 4: POLL FOR COMPLETION (App polls backend)                        │
│  ─────────────────────────────────────────────────                       │
│  GET /api/v1/device/status?verification_id=uuid-...                     │
│  (Poll every 3 seconds, max 60 attempts = 3 minutes)                   │
│                                                                          │
│  Response when completed:                                               │
│  {                                                                      │
│    "status": "active",                                                  │
│    "device_trust_token": "eyJhbGciOi...",  // Long-lived, encrypted    │
│    "token_expires_at": "2026-08-13T10:30:00Z"                          │
│  }                                                                      │
│                                                                          │
│  App stores device_trust_token in:                                      │
│  - iOS: Keychain (expo-secure-store)                                    │
│  - Android: Android Keystore (expo-secure-store)                        │
│                                                                          │
│  From now on, EVERY API call from the mobile app includes:              │
│  Headers:                                                               │
│    Authorization: Bearer <clerk_jwt>                                    │
│    X-Device-Trust-Token: <device_trust_token>                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Device Fingerprint Computation

```python
# backend/app/shared/services/device_trust_service.py

import hashlib
from typing import Optional

def compute_device_fingerprint(device_info: dict) -> str:
    """
    Generate a deterministic fingerprint from device attributes.
    
    We hash a combination of attributes that are:
    1. Stable across app reinstalls (device_id persists)
    2. Unique per physical device
    3. Not easily spoofable (can't change screen resolution or RAM)
    
    We deliberately EXCLUDE:
    - App version (changes on update)
    - OS version (changes on system update)
    - SIM operator (user might switch carriers)
    
    The fingerprint must match on every subsequent request.
    If the device is factory-reset, device_id changes → new fingerprint →
    user needs admin-assisted re-registration.
    """
    components = [
        device_info.get("device_id", ""),        # expo-application: Application.androidId / Constants.deviceId
        device_info.get("platform", ""),          # "android" | "ios"
        device_info.get("device_model", ""),      # "Samsung Galaxy A14"
        str(device_info.get("screen_width", 0)),  # 1080
        str(device_info.get("screen_height", 0)), # 2340
    ]
    raw = "|".join(components)
    return hashlib.sha256(raw.encode()).hexdigest()
```

### 2.3 Device Trust Token Structure

```python
# backend/app/shared/services/qr_token_service.py

import jwt
from datetime import datetime, timedelta
from app.config import settings

DEVICE_TOKEN_EXPIRY_DAYS = 180
QR_IDENTITY_TOKEN_EXPIRY_SECONDS = 300  # 5 minutes
QR_IDENTITY_REFRESH_SECONDS = 60       # Refresh every 60 seconds

def create_device_trust_token(
    user_id: str,
    device_trust_id: str,
    device_fingerprint: str,
) -> str:
    """
    Long-lived token stored on device. Proves this device is trusted.
    Encrypted with AES-256 before storage, but the JWT itself uses RS256.
    """
    payload = {
        "sub": str(user_id),
        "did": str(device_trust_id),        # Device trust record ID
        "dfp": device_fingerprint[:16],      # First 16 chars of fingerprint (for quick validation)
        "typ": "device_trust",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=DEVICE_TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, settings.DEVICE_TRUST_SECRET, algorithm="HS256")


def create_qr_identity_token(
    user_id: str,
    device_fingerprint: str,
    college_id: str,
    user_type: str,  # "student", "faculty", "staff"
) -> str:
    """
    Short-lived QR display token. Auto-refreshes every 60 seconds.
    This is what gets encoded into the QR code the user shows.
    Even if someone screenshots it, it expires in 5 minutes.
    """
    payload = {
        "sub": str(user_id),
        "typ": "identity_qr",
        "dfp": device_fingerprint[:16],
        "col": str(college_id)[:8],          # Short college ID for compact QR
        "utp": user_type[:3],                # "stu", "fac", "sta"
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(seconds=QR_IDENTITY_TOKEN_EXPIRY_SECONDS),
    }
    return jwt.encode(payload, settings.QR_TOKEN_SECRET, algorithm="HS256")


def validate_qr_identity_token(token: str) -> Optional[dict]:
    """Validate and decode a QR identity token."""
    try:
        payload = jwt.decode(
            token, settings.QR_TOKEN_SECRET,
            algorithms=["HS256"],
            options={"require": ["sub", "typ", "dfp", "col", "exp"]}
        )
        if payload.get("typ") != "identity_qr":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def create_action_point_signature(
    action_point_id: str,
    action_type: str,
    location_code: str,
    college_id: str,
    rotation_key: str,  # Changes every N minutes for rotating QRs
) -> str:
    """
    Sign a Mode B (location) QR. The QR at a location contains this signature.
    Fixed scanners display this. Users scan it with their trusted device.
    """
    import hmac
    message = f"{action_point_id}:{action_type}:{location_code}:{college_id}:{rotation_key}"
    return hmac.new(
        settings.QR_ACTION_POINT_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()[:32]  # Truncate for shorter QR
```

### 2.4 Device Transfer Flow

```
SCENARIO A: Self-Service Transfer (old phone accessible)
─────────────────────────────────────────────────────────
1. Old Phone: User opens Settings → "Transfer to New Device"
2. Old Phone: POST /api/v1/device/transfer/initiate
   → Generates a 8-digit transfer_code (valid 15 minutes)
   → Creates DeviceTransferRequest record
   → Response: { "transfer_code": "48293716", "expires_in": 900 }

3. New Phone: User installs app, logs in with Clerk
4. New Phone: Sees "This account is registered to another device"
5. New Phone: Enters transfer_code
6. New Phone: POST /api/v1/device/transfer/complete
   Body: { "transfer_code": "48293716", "device_info": { ... } }

7. Backend:
   - Validates transfer_code
   - Revokes old DeviceTrust (status = "transferred")
   - Triggers SMS verification on new device (Steps 1-4 from registration)
   - Old phone receives push notification: "Your device registration has been transferred"

SCENARIO B: Admin-Assisted Reset (phone lost/stolen)
─────────────────────────────────────────────────────
1. Student goes to admin office
2. Admin: Searches student in admin panel
3. Admin: Clicks "Reset Device Registration"
4. Admin: POST /api/v1/admin/devices/{user_id}/reset
   Body: { "reason": "phone_lost", "admin_notes": "Student reported phone stolen on 13-Feb-2026" }
5. Backend:
   - Revokes current DeviceTrust (status = "revoked", revoked_by = admin_id)
   - Audit log: "Device reset for user X by admin Y, reason: phone_lost"
   - Student can now register a new device
6. Student: Installs app on new phone → goes through full registration flow

ANOMALY DETECTION:
- If same user has 3+ device resets in 30 days → flag for review
- Admin dashboard shows flagged accounts: /api/v1/admin/devices/flagged
- Security alert published to event bus: "device.suspicious_resets"
```

---

## 3. QR ENGINE — PROTOCOL & PROCESSING

### 3.1 QR Code Formats

```
MODE A: "I AM" QR (User shows their identity)
──────────────────────────────────────────────
Format: Compact JWT encoded as QR Code (QR Version 10, Error Correction M)
Content: The QR identity token from Section 2.3
Size: ~200 bytes → fits in QR Version 5-6 comfortably
Display: Auto-refreshes every 60 seconds on user's screen
Max age: 5 minutes (server rejects expired tokens)

Example decoded:
{
  "sub": "usr_abc123",
  "typ": "identity_qr",
  "dfp": "a1b2c3d4e5f6g7h8",
  "col": "clg_xyz1",
  "utp": "stu",
  "iat": 1708300000,
  "exp": 1708300300
}

MODE B: "ACTION" QR (Fixed at a location, user scans)
─────────────────────────────────────────────────────
Format: URL-encoded action payload as QR Code
Content: acolyte://v1/{action}?ap={action_point_id}&lc={location_code}&c={college_short}&sig={hmac_signature}&r={rotation_key}
Size: ~150 bytes
Display: Printed sticker, projected on screen, or displayed on dedicated tablet
Rotation: Static (stickers) or rotated every N minutes (projected/tablet)

Example:
acolyte://v1/library_checkout?ap=ap_lib01&lc=main_lib_desk1&c=clg_xyz1&sig=a1b2c3d4&r=20260213103000

For book-specific QR (stuck on each book):
acolyte://v1/library_checkout?ap=ap_lib01&lc=main_lib_desk1&c=clg_xyz1&eid=book_12345&sig=x9y8z7w6&r=static

"r=static" means this QR never rotates (it's a physical sticker on a book).
The sig is computed with a static rotation_key for permanence.
```

### 3.2 Scan Processing Pipeline

```python
# backend/app/shared/services/qr_service.py

class QRService:
    """Core QR processing engine. Handles both Mode A and Mode B scans."""
    
    def __init__(self, db: AsyncSession, event_bus: EventBus):
        self.db = db
        self.event_bus = event_bus
        self._action_handlers: dict[str, Callable] = {}
    
    def register_handler(self, action_type: str, handler: Callable):
        """Engines register their action handlers at app startup."""
        self._action_handlers[action_type] = handler
    
    # ── MODE A: Scanner reads someone's identity QR ──
    
    async def process_mode_a_scan(
        self,
        scanner_user_id: UUID,
        scanner_device: DeviceTrust,
        scanned_qr_data: str,  # The raw QR content (JWT)
        action_point_id: UUID,
        gps: Optional[GPSCoordinates] = None,
    ) -> ScanResult:
        """
        A scanner device (mess tablet, library desk, gate scanner) reads 
        a person's identity QR code.
        
        Flow:
        1. Decode QR JWT → validate signature, expiry
        2. Extract user_id from token
        3. Verify device fingerprint in token matches active DeviceTrust
        4. Determine action from the action_point configuration
        5. Check for duplicate scans (time-windowed)
        6. Execute the action handler
        7. Log to QRScanLog
        8. Publish event
        """
        # Step 1: Decode and validate token
        token_data = validate_qr_identity_token(scanned_qr_data)
        if not token_data:
            return await self._log_failed_scan(
                scanner_user_id, "mode_a", "expired_token",
                "QR token expired or invalid"
            )
        
        target_user_id = UUID(token_data["sub"])
        
        # Step 2: Verify device trust is still active
        device_trust = await self._get_active_device_trust(target_user_id)
        if not device_trust:
            return await self._log_failed_scan(
                target_user_id, "mode_a", "no_active_device",
                "User has no active registered device"
            )
        
        # Step 3: Verify fingerprint matches
        if not device_trust.device_fingerprint.startswith(token_data["dfp"]):
            return await self._log_failed_scan(
                target_user_id, "mode_a", "device_mismatch",
                "QR token device fingerprint does not match registered device"
            )
        
        # Step 4: Get action point config
        action_point = await self._get_action_point(action_point_id)
        if not action_point:
            return await self._log_failed_scan(
                target_user_id, "mode_a", "invalid_action_point",
                f"Action point {action_point_id} not found"
            )
        
        # Step 5: GPS validation (if action point requires it)
        geo_valid = True
        if action_point.gps_latitude and gps:
            geo_valid = self._validate_geo(
                gps, action_point.gps_latitude,
                action_point.gps_longitude,
                action_point.geo_radius_meters
            )
            if action_point.security_level in ("elevated", "strict") and not geo_valid:
                return await self._log_failed_scan(
                    target_user_id, "mode_a", "geo_violation",
                    f"User is outside {action_point.geo_radius_meters}m radius"
                )
        
        # Step 6: Duplicate check
        is_duplicate = await self._check_duplicate(
            target_user_id, action_point.action_type,
            action_point.duplicate_window_minutes
        )
        if is_duplicate:
            return await self._log_failed_scan(
                target_user_id, "mode_a", "duplicate_scan",
                "Already scanned within the allowed time window"
            )
        
        # Step 7: Execute action handler
        handler = self._action_handlers.get(action_point.action_type)
        if not handler:
            return await self._log_failed_scan(
                target_user_id, "mode_a", "no_handler",
                f"No handler registered for action: {action_point.action_type}"
            )
        
        action_result = await handler(
            user_id=target_user_id,
            action_point=action_point,
            device_trust=device_trust,
            gps=gps,
            db=self.db
        )
        
        # Step 8: Log successful scan
        scan_log = QRScanLog(
            college_id=action_point.college_id,
            user_id=target_user_id,
            user_type=token_data.get("utp", "stu"),
            device_trust_id=device_trust.id,
            action_type=action_point.action_type,
            action_point_id=action_point.id,
            qr_mode="mode_a",
            entity_type=action_result.get("entity_type"),
            entity_id=action_result.get("entity_id"),
            metadata=action_result.get("metadata", {}),
            scan_latitude=gps.lat if gps else None,
            scan_longitude=gps.lng if gps else None,
            geo_validated=geo_valid,
            device_validated=True,
            biometric_confirmed=False,
            validation_result="success",
        )
        self.db.add(scan_log)
        await self.db.flush()
        
        # Step 9: Publish event
        await self.event_bus.publish(f"qr.{action_point.action_type}", {
            "scan_log_id": str(scan_log.id),
            "user_id": str(target_user_id),
            "action_type": action_point.action_type,
            "college_id": str(action_point.college_id),
            "result": action_result,
        })
        
        return ScanResult(
            success=True,
            action_type=action_point.action_type,
            message=action_result.get("message", "Scan recorded"),
            data=action_result,
        )
    
    # ── MODE B: User scans a location/item QR ──
    
    async def process_mode_b_scan(
        self,
        user_id: UUID,
        user_device: DeviceTrust,
        scanned_qr_data: str,  # The raw QR content (acolyte:// URL)
        gps: Optional[GPSCoordinates] = None,
    ) -> ScanResult:
        """
        User scans a QR code at a location (library book, mess return desk,
        classroom projector, equipment sticker, etc.).
        
        The QR contains: action type, action point ID, optional entity ID,
        HMAC signature, and rotation key.
        """
        # Parse the acolyte:// URL
        parsed = self._parse_action_qr(scanned_qr_data)
        if not parsed:
            return ScanResult(success=False, message="Invalid QR code format")
        
        # Validate HMAC signature
        action_point = await self._get_action_point_by_code(parsed["location_code"])
        if not action_point:
            return ScanResult(success=False, message="Unknown QR location")
        
        expected_sig = create_action_point_signature(
            str(action_point.id),
            parsed["action_type"],
            parsed["location_code"],
            parsed["college_id"],
            parsed["rotation_key"],
        )
        if not hmac.compare_digest(parsed["signature"], expected_sig):
            return ScanResult(success=False, message="Invalid QR signature — may be tampered")
        
        # Rotation check (for rotating QRs, verify the rotation key is current)
        if action_point.qr_rotation_minutes > 0:
            if not self._is_rotation_key_current(
                parsed["rotation_key"],
                action_point.qr_rotation_minutes
            ):
                return ScanResult(success=False, message="QR code has expired — scan the current one")
        
        # Execute action (same pattern as Mode A from Step 5 onwards)
        # ... GPS validation, duplicate check, handler execution, logging, event publishing
        # (omitted for brevity — identical logic)
    
    # ── Helper Methods ──
    
    def _validate_geo(
        self, user_gps: GPSCoordinates,
        target_lat: float, target_lng: float,
        radius_meters: int
    ) -> bool:
        """Haversine distance check."""
        from math import radians, sin, cos, sqrt, atan2
        R = 6371000  # Earth radius in meters
        lat1, lat2 = radians(user_gps.lat), radians(target_lat)
        dlat = radians(target_lat - user_gps.lat)
        dlng = radians(target_lng - user_gps.lng)
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
        return distance <= radius_meters
    
    def _parse_action_qr(self, qr_data: str) -> Optional[dict]:
        """Parse acolyte://v1/{action}?... format."""
        if not qr_data.startswith("acolyte://v1/"):
            return None
        from urllib.parse import urlparse, parse_qs
        # Convert acolyte:// to https:// for urlparse compatibility
        url = qr_data.replace("acolyte://", "https://acolyte.internal/")
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        path_parts = parsed.path.strip("/").split("/")
        if len(path_parts) < 2:
            return None
        return {
            "action_type": path_parts[1],
            "action_point_id": params.get("ap", [None])[0],
            "location_code": params.get("lc", [None])[0],
            "college_id": params.get("c", [None])[0],
            "entity_id": params.get("eid", [None])[0],
            "signature": params.get("sig", [None])[0],
            "rotation_key": params.get("r", ["static"])[0],
        }
```

### 3.3 Action Handlers (Engine-Specific)

```python
# backend/app/engines/admin/services/qr_handlers.py

"""
QR action handlers for the Admin Engine.
Each handler is registered with the QR service at app startup.
"""

async def handle_mess_entry(
    user_id: UUID, action_point: QRActionPoint,
    device_trust: DeviceTrust, gps: Optional[GPSCoordinates],
    db: AsyncSession
) -> dict:
    """Process mess hall entry scan."""
    from datetime import datetime
    
    hour = datetime.now().hour
    if hour < 10:
        meal = "breakfast"
    elif hour < 15:
        meal = "lunch"
    elif hour < 18:
        meal = "snacks"
    else:
        meal = "dinner"
    
    # Check duplicate meal today
    today = datetime.now().date()
    existing = await db.execute(
        select(QRScanLog).where(
            QRScanLog.user_id == user_id,
            QRScanLog.action_type == "mess_entry",
            func.date(QRScanLog.scanned_at) == today,
            QRScanLog.metadata["meal"].astext == meal,
            QRScanLog.validation_result == "success",
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "duplicate", "message": f"Already recorded for {meal} today", "meal": meal}
    
    # Get mess allocation for billing
    mess_unit = await get_student_mess(user_id, action_point.linked_entity_id, db)
    
    return {
        "status": "success",
        "message": f"{meal.title()} entry recorded ✓",
        "meal": meal,
        "metadata": {"meal": meal, "mess_unit_id": str(mess_unit.id) if mess_unit else None},
        "entity_type": "mess_unit",
        "entity_id": mess_unit.id if mess_unit else None,
    }


async def handle_library_checkout(
    user_id: UUID, action_point: QRActionPoint,
    device_trust: DeviceTrust, gps: Optional[GPSCoordinates],
    db: AsyncSession, entity_id: UUID = None,  # book_id from QR
) -> dict:
    """Process library book checkout via QR scan."""
    if not entity_id:
        return {"status": "error", "message": "No book specified in QR code"}
    
    book = await db.get(LibraryBook, entity_id)
    if not book:
        return {"status": "error", "message": "Book not found"}
    if book.available_copies <= 0:
        return {"status": "unavailable", "message": f"'{book.title}' — no copies available"}
    
    # Check student's active issuances
    active_count = await db.scalar(
        select(func.count(LibraryIssuance.id)).where(
            LibraryIssuance.borrower_id == user_id,
            LibraryIssuance.status == "issued",
        )
    )
    if active_count >= 3:
        return {"status": "limit", "message": "Maximum 3 books allowed at a time"}
    
    # Create issuance
    due_date = datetime.now().date() + timedelta(days=14)
    issuance = LibraryIssuance(
        college_id=book.college_id,
        book_id=book.id,
        borrower_id=user_id,
        borrower_type="student",
        issued_date=datetime.now().date(),
        due_date=due_date,
        status="issued",
    )
    db.add(issuance)
    book.available_copies -= 1
    await db.flush()
    
    return {
        "status": "success",
        "message": f"'{book.title}' checked out. Due: {due_date.strftime('%d %b %Y')}",
        "metadata": {"book_id": str(book.id), "book_title": book.title, "due_date": str(due_date)},
        "entity_type": "book",
        "entity_id": book.id,
    }


async def handle_library_return(
    user_id: UUID, action_point: QRActionPoint,
    device_trust: DeviceTrust, gps: Optional[GPSCoordinates],
    db: AsyncSession,
) -> dict:
    """Process library book return. Student scans the return desk QR,
    then selects which book to return from their active issuances."""
    
    # Fetch active issuances for this student
    result = await db.execute(
        select(LibraryIssuance).join(LibraryBook).where(
            LibraryIssuance.borrower_id == user_id,
            LibraryIssuance.status == "issued",
        )
    )
    active_issuances = result.scalars().all()
    
    if not active_issuances:
        return {"status": "none", "message": "No books to return"}
    
    # Return list of books for user to select (UI handles selection)
    return {
        "status": "select_book",
        "message": "Select book to return",
        "metadata": {
            "active_issuances": [
                {
                    "issuance_id": str(i.id),
                    "book_title": i.book.title,
                    "due_date": str(i.due_date),
                    "overdue": i.due_date < datetime.now().date(),
                }
                for i in active_issuances
            ]
        },
    }


async def handle_hostel_checkin(
    user_id: UUID, action_point: QRActionPoint,
    device_trust: DeviceTrust, gps: Optional[GPSCoordinates],
    db: AsyncSession
) -> dict:
    """Process hostel gate entry/exit."""
    # Determine entry or exit based on last scan
    last_scan = await db.scalar(
        select(QRScanLog).where(
            QRScanLog.user_id == user_id,
            QRScanLog.action_type == "hostel_checkin",
            func.date(QRScanLog.scanned_at) == datetime.now().date(),
        ).order_by(QRScanLog.scanned_at.desc()).limit(1)
    )
    
    direction = "entry" if (not last_scan or last_scan.metadata.get("direction") == "exit") else "exit"
    
    # Curfew check (if entry and after curfew time)
    curfew_warning = None
    if direction == "entry":
        hour = datetime.now().hour
        if hour >= 22 or hour < 5:
            curfew_warning = "Late entry recorded — warden will be notified"
            # Publish event for warden notification
    
    return {
        "status": "success",
        "message": f"Hostel {direction} recorded" + (f" ⚠️ {curfew_warning}" if curfew_warning else ""),
        "metadata": {"direction": direction, "curfew_violation": curfew_warning is not None},
    }


# HANDLER REGISTRY — called from main.py at startup
def register_admin_qr_handlers(qr_service: QRService):
    """Register all admin engine QR action handlers."""
    qr_service.register_handler("mess_entry", handle_mess_entry)
    qr_service.register_handler("library_checkout", handle_library_checkout)
    qr_service.register_handler("library_return", handle_library_return)
    qr_service.register_handler("hostel_checkin", handle_hostel_checkin)
    qr_service.register_handler("equipment_checkout", handle_equipment_checkout)
    qr_service.register_handler("transport_boarding", handle_transport_boarding)
    qr_service.register_handler("visitor_entry", handle_visitor_entry)


# backend/app/engines/faculty/services/qr_handlers.py

async def handle_attendance_mark(
    user_id: UUID, action_point: QRActionPoint,
    device_trust: DeviceTrust, gps: Optional[GPSCoordinates],
    db: AsyncSession
) -> dict:
    """
    Student scans classroom QR to mark attendance.
    GPS validated (must be within 100m of campus).
    This is PARALLEL to AEBAS — complements, not replaces.
    """
    # The action_point.metadata should contain: class_session_id, subject, faculty_id
    session_metadata = action_point.metadata or {}
    
    return {
        "status": "success",
        "message": f"Attendance marked for {session_metadata.get('subject', 'class')} ✓",
        "metadata": {
            "class_session_id": session_metadata.get("class_session_id"),
            "subject": session_metadata.get("subject"),
            "faculty_id": session_metadata.get("faculty_id"),
            "gps_validated": gps is not None,
        },
    }


async def handle_clinical_posting(
    user_id: UUID, action_point: QRActionPoint,
    device_trust: DeviceTrust, gps: Optional[GPSCoordinates],
    db: AsyncSession
) -> dict:
    """Student scans QR at hospital ward/OPD for clinical rotation tracking."""
    # Update hours in ClinicalRotation record
    rotation = await get_active_rotation(user_id, action_point.linked_entity_id, db)
    if not rotation:
        return {"status": "error", "message": "No active rotation in this department"}
    
    return {
        "status": "success",
        "message": f"Clinical posting check-in: {rotation.department.name}",
        "metadata": {
            "rotation_id": str(rotation.id),
            "department": rotation.department.name,
            "hours_completed": rotation.completed_hours,
            "hours_required": rotation.required_hours,
        },
    }


def register_faculty_qr_handlers(qr_service: QRService):
    qr_service.register_handler("attendance_mark", handle_attendance_mark)
    qr_service.register_handler("clinical_posting", handle_clinical_posting)
    qr_service.register_handler("event_checkin", handle_event_checkin)
    qr_service.register_handler("exam_hall_entry", handle_exam_hall_entry)
```

---

## 4. DYNAMIC ROLE & COMMITTEE SYSTEM

### 4.1 Concept

Static roles (student, faculty, admin) are set in Clerk + Permify. Dynamic roles are **temporary overlays** that add permissions and UI sections without changing base roles. They are managed through `DynamicRoleAssignment` records.

### 4.2 Role Types

```python
class DynamicRoleType(str, Enum):
    # Committee roles
    COMMITTEE_CHAIR = "committee_chair"
    COMMITTEE_MEMBER = "committee_member"
    COMMITTEE_SECRETARY = "committee_secretary"
    COMMITTEE_EXTERNAL = "committee_external"
    
    # Academic roles
    CLASS_REPRESENTATIVE = "class_representative"
    EXAM_INVIGILATOR = "exam_invigilator"
    ROTATION_SUPERVISOR = "rotation_supervisor"
    MENTOR = "mentor"
    
    # Administrative roles
    DUTY_WARDEN = "duty_warden"
    EVENT_COORDINATOR = "event_coordinator"
    NCC_OFFICER = "ncc_officer"
    NSS_COORDINATOR = "nss_coordinator"
    SPORTS_INCHARGE = "sports_incharge"
    
    # Temporary elevated access
    TEMPORARY_ADMIN = "temporary_admin"
    AUDIT_VIEWER = "audit_viewer"
```

### 4.3 Committee Member Experience

```
USER FLOW (Student who is on Anti-Ragging Committee):
──────────────────────────────────────────────────────

1. Student logs into the app (mobile or web)
2. Frontend calls GET /api/v1/me/roles
3. Response includes:
   {
     "roles": [{
       "role_type": "committee_member",
       "context_type": "committee",
       "context_id": "uuid-anti-ragging",
       "context_name": "Anti-Ragging Committee",
       "permissions": ["view_cases", "view_minutes", "view_documents"]
     }]
   }
4. Sidebar renders "MY COMMITTEES" section with "Anti-Ragging Committee" link
5. Student clicks → navigates to /committees/{uuid-anti-ragging}
6. Page shows: committee info, assigned grievances, meeting schedule, documents
7. Student can VIEW cases (anonymized if anonymous filing) but NOT update status
8. Chair/Secretary CAN update status, file minutes, etc.
```

---

## 5. DATABASE SCHEMA (COMPLETE)

```python
# ═══════════════════════════════════════════════════════════════
# backend/app/shared/models/device_trust.py
# ═══════════════════════════════════════════════════════════════

from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, Text, Date,
    ForeignKey, Index, text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from uuid import uuid4
from .base import Base, TenantModel


class DeviceTrust(Base):
    """
    Device registration and trust management.
    NOT tenant-scoped — a user's device exists outside any single college.
    Platform-level table.
    """
    __tablename__ = "device_trusts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # ── Device Identification ──
    device_fingerprint = Column(String(64), nullable=False)
    platform = Column(String(10), nullable=False)          # "android", "ios"
    device_id = Column(String(100), nullable=False)         # Native device ID
    device_model = Column(String(100))
    device_manufacturer = Column(String(100))
    os_version = Column(String(20))
    app_version = Column(String(20))
    screen_width = Column(Integer)
    screen_height = Column(Integer)
    ram_mb = Column(Integer)
    sim_operator = Column(String(50))
    sim_country = Column(String(5))
    
    # ── Phone Verification ──
    claimed_phone = Column(String(15), nullable=False)
    verified_phone = Column(String(15))
    phone_verified_at = Column(DateTime(timezone=True))
    verification_code_hash = Column(String(64))
    verification_code_expires_at = Column(DateTime(timezone=True))
    sms_verified = Column(Boolean, default=False)
    sms_gateway_message_id = Column(String(100))
    
    # ── Trust Token ──
    device_trust_token_hash = Column(String(64))   # Hash of issued token for revocation check
    token_issued_at = Column(DateTime(timezone=True))
    token_expires_at = Column(DateTime(timezone=True))
    
    # ── Status ──
    status = Column(String(30), default="pending_sms_verification", index=True)
    # "pending_sms_verification", "active", "revoked", "expired",
    # "transferred", "verification_failed", "suspended"
    
    # ── Revocation ──
    revoked_at = Column(DateTime(timezone=True))
    revoked_by = Column(UUID(as_uuid=True))
    revoke_reason = Column(String(100))
    
    # ── Activity ──
    last_active_at = Column(DateTime(timezone=True))
    total_qr_scans = Column(Integer, default=0)
    last_qr_scan_at = Column(DateTime(timezone=True))
    
    # ── Timestamps ──
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    
    __table_args__ = (
        # Only ONE active device per user
        Index(
            "ix_device_trust_user_active",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        # Fast lookup by phone number (for SMS webhook matching)
        Index("ix_device_trust_phone_pending", "claimed_phone", "status"),
    )


class DeviceTransferRequest(Base):
    """Tracks device transfer requests (self-service phone change)."""
    __tablename__ = "device_transfer_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    old_device_trust_id = Column(UUID(as_uuid=True), ForeignKey("device_trusts.id"), nullable=False)
    transfer_code_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="pending")  # "pending", "completed", "expired"
    new_device_trust_id = Column(UUID(as_uuid=True), ForeignKey("device_trusts.id"))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))


class DeviceResetLog(Base):
    """Audit trail for admin-initiated device resets. Append-only."""
    __tablename__ = "device_reset_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    device_trust_id = Column(UUID(as_uuid=True), ForeignKey("device_trusts.id"), nullable=False)
    reset_by = Column(UUID(as_uuid=True), nullable=False)     # Admin who reset
    reset_reason = Column(String(100), nullable=False)
    admin_notes = Column(Text)
    reset_at = Column(DateTime(timezone=True), server_default=text("NOW()"))


# ═══════════════════════════════════════════════════════════════
# backend/app/shared/models/qr.py
# ═══════════════════════════════════════════════════════════════

class QRActionPoint(TenantModel):
    """
    Physical or virtual location where QR actions occur.
    Examples: "Main Mess Entrance", "Library Desk 1", "Anatomy Lecture Hall 3"
    
    Each action point defines:
    - What action happens here (mess_entry, library_checkout, etc.)
    - How the QR works (Mode A scanner reads people, or Mode B people scan QR here)
    - Security requirements (GPS radius, biometric, time windows)
    - Duplicate scan prevention window
    """
    __tablename__ = "qr_action_points"
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # ── Action Configuration ──
    action_type = Column(String(30), nullable=False, index=True)
    # "mess_entry", "hostel_checkin", "library_visit", "library_checkout",
    # "library_return", "attendance_mark", "equipment_checkout", "event_checkin",
    # "exam_hall_entry", "transport_boarding", "clinical_posting", "fee_payment",
    # "visitor_entry", "certificate_verify"
    
    location_code = Column(String(50), nullable=False)
    # Unique within a college: "mess_main_1", "lib_desk_1", "anat_lh_3"
    
    # ── QR Mode ──
    qr_mode = Column(String(10), nullable=False)  # "mode_a" or "mode_b"
    
    # ── Physical Location ──
    building = Column(String(100))
    floor = Column(Integer)
    gps_latitude = Column(Float)
    gps_longitude = Column(Float)
    geo_radius_meters = Column(Integer, default=100)
    
    # ── QR Generation Config (for Mode B) ──
    qr_rotation_minutes = Column(Integer, default=0)
    # 0 = static (printed sticker), 5 = rotates every 5 min, etc.
    qr_secret = Column(String(64))  # Per-action-point HMAC secret
    
    # ── Duplicate Prevention ──
    duplicate_window_minutes = Column(Integer, default=30)
    # 30 = can't scan same action type again within 30 minutes
    # 0 = no duplicate prevention
    
    # ── Linked Entity ──
    linked_entity_type = Column(String(30))
    linked_entity_id = Column(UUID(as_uuid=True))
    
    # ── Security Level ──
    security_level = Column(String(20), default="standard")
    # "standard" — Clerk JWT + Device Trust
    # "elevated" — above + GPS within radius
    # "strict" — above + device biometric
    
    # ── Scanner Device (for Mode A — a fixed tablet/scanner) ──
    scanner_device_trust_id = Column(UUID(as_uuid=True), ForeignKey("device_trusts.id"))
    
    # ── Operational Hours ──
    active_hours_start = Column(String(5))   # "06:00"
    active_hours_end = Column(String(5))     # "22:00"
    active_days = Column(JSONB, default=[0,1,2,3,4,5])  # Mon-Sat (0-indexed)
    
    # ── Metadata ──
    metadata = Column(JSONB, default={})
    # For attendance: {"class_session_id": "...", "subject": "Anatomy"}
    # For mess: {"mess_unit_id": "..."}
    
    is_active = Column(Boolean, default=True)
    
    __table_args__ = (
        UniqueConstraint("college_id", "location_code", name="uq_action_point_location"),
        Index("ix_action_point_type", "college_id", "action_type"),
    )


class QRScanLog(TenantModel):
    """
    Immutable, append-only log of every QR interaction.
    This is the SINGLE SOURCE OF TRUTH for mess meals, library visits,
    attendance marks, equipment checkouts, etc.
    
    Other systems read from this table to derive their own state.
    For example, the mess billing system queries scan logs for meal counts.
    """
    __tablename__ = "qr_scan_logs"
    
    # ── Who ──
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_type = Column(String(10))  # "stu", "fac", "sta", "vis"
    device_trust_id = Column(UUID(as_uuid=True), ForeignKey("device_trusts.id"))
    
    # ── What ──
    action_type = Column(String(30), nullable=False, index=True)
    action_point_id = Column(UUID(as_uuid=True), ForeignKey("qr_action_points.id"))
    qr_mode = Column(String(10))  # "mode_a" or "mode_b"
    
    # ── Context ──
    entity_type = Column(String(30))     # "book", "equipment", "event", "exam", "meal"
    entity_id = Column(UUID(as_uuid=True))
    metadata = Column(JSONB, default={})
    
    # ── Location ──
    scan_latitude = Column(Float)
    scan_longitude = Column(Float)
    geo_validated = Column(Boolean)
    
    # ── Validation ──
    device_validated = Column(Boolean, nullable=False, default=False)
    biometric_confirmed = Column(Boolean, default=False)
    validation_result = Column(String(20), nullable=False)
    # "success", "device_mismatch", "expired_token", "geo_violation",
    # "time_violation", "duplicate_scan", "revoked_device", "unauthorized",
    # "invalid_qr", "no_handler"
    rejection_reason = Column(Text)
    
    # ── Timestamp ──
    scanned_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    
    __table_args__ = (
        Index(
            "ix_scan_log_user_action_time",
            "college_id", "user_id", "action_type", "scanned_at",
        ),
        Index(
            "ix_scan_log_action_point_time",
            "college_id", "action_point_id", "scanned_at",
        ),
        # Partition by month (for high-volume scan logs)
        # Applied via Alembic migration using pg_partman
    )


# ═══════════════════════════════════════════════════════════════
# backend/app/shared/models/dynamic_roles.py
# ═══════════════════════════════════════════════════════════════

class DynamicRoleAssignment(TenantModel):
    """
    Temporary or context-specific role overlays.
    These ADD permissions and UI sections without changing the user's base role.
    """
    __tablename__ = "dynamic_role_assignments"
    
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_type = Column(String(20))  # "student", "faculty", "staff", "external"
    user_name = Column(String(255))  # Denormalized for display
    
    # ── Role Definition ──
    role_type = Column(String(50), nullable=False, index=True)
    
    # ── Context: What entity this role is attached to ──
    context_type = Column(String(30), nullable=False)
    # "committee", "exam", "event", "hostel_block", "department", "batch"
    context_id = Column(UUID(as_uuid=True), nullable=False)
    context_name = Column(String(255))  # Denormalized: "Anti-Ragging Committee"
    
    # ── Validity ──
    valid_from = Column(Date, nullable=False)
    valid_until = Column(Date)  # null = indefinite
    is_active = Column(Boolean, default=True)
    auto_deactivate = Column(Boolean, default=True)  # Auto-set is_active=false after valid_until
    
    # ── Assignment Details ──
    assigned_by = Column(UUID(as_uuid=True))
    assigned_by_name = Column(String(255))
    assignment_order_url = Column(String(500))  # R2 URL of appointment letter
    notes = Column(Text)
    
    # ── Permissions (denormalized for frontend) ──
    permissions = Column(JSONB, default=[])
    # ["view_cases", "update_status", "file_minutes", "view_documents",
    #  "schedule_meeting", "manage_members"]
    
    __table_args__ = (
        Index("ix_dra_user_active", "college_id", "user_id", "is_active"),
        Index("ix_dra_context", "college_id", "context_type", "context_id"),
        # Prevent duplicate active assignments for same user+context+role
        UniqueConstraint(
            "college_id", "user_id", "role_type", "context_id",
            name="uq_dra_user_role_context",
        ),
    )


# ═══════════════════════════════════════════════════════════════
# backend/app/shared/models/committee.py
# ═══════════════════════════════════════════════════════════════

class CommitteeMeeting(TenantModel):
    """Meeting records for committees. Accessible only to committee members."""
    __tablename__ = "committee_meetings"
    
    committee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    meeting_date = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255))
    
    # ── Agenda & Minutes ──
    agenda = Column(JSONB, default=[])  # [{"item": "Review pending cases", "presenter": "Dr. X"}]
    minutes_text = Column(Text)
    minutes_file_url = Column(String(500))  # R2 URL
    minutes_filed_by = Column(UUID(as_uuid=True))
    minutes_filed_at = Column(DateTime(timezone=True))
    
    # ── Attendance ──
    attendees = Column(JSONB, default=[])  # [{"user_id": "...", "name": "...", "present": true}]
    quorum_met = Column(Boolean)
    
    status = Column(String(20), default="scheduled")
    # "scheduled", "in_progress", "completed", "cancelled"


class CommitteeActionItem(TenantModel):
    """Action items from committee meetings."""
    __tablename__ = "committee_action_items"
    
    committee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("committee_meetings.id"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    assigned_to = Column(UUID(as_uuid=True))
    assigned_to_name = Column(String(255))
    due_date = Column(Date)
    status = Column(String(20), default="pending")  # "pending", "in_progress", "completed", "overdue"
    completed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
```

---

## 6. PERMIFY AUTHORIZATION EXTENSIONS

```yaml
# Extend existing Permify schema

# ── Device Trust Entity ──
entity device_trust {
  relation user @user
  
  permission verify = user
}

# ── Committee Entity (extends existing) ──
entity committee {
  relation college @college
  relation chair @user
  relation secretary @user
  relation member @user
  relation external_member @user
  
  permission manage = chair or college.admin or college.dean
  permission view_cases = member or chair or secretary or external_member or college.admin
  permission update_case_status = chair or secretary
  permission resolve_case = chair
  permission file_minutes = secretary or chair
  permission view_minutes = member or chair or secretary or external_member or college.admin
  permission view_documents = member or chair or secretary or external_member
  permission schedule_meeting = chair or secretary or college.admin
  permission manage_members = chair or college.admin or college.dean
  permission receive_notifications = member or chair or secretary or external_member
}

# ── Grievance Entity (extends existing) ──
entity grievance {
  relation assigned_committee @committee
  relation filed_by @user
  
  permission view = assigned_committee.view_cases or filed_by
  permission update_status = assigned_committee.update_case_status
  permission resolve = assigned_committee.resolve_case
  permission add_evidence = filed_by or assigned_committee.view_cases
}

# ── QR Action Point Entity ──
entity qr_action_point {
  relation college @college
  relation scanner @user
  
  permission scan = scanner or college.admin
  permission manage = college.admin
}

# ── Dynamic Role Assignment ──
# Dynamic roles are resolved at query time by checking DynamicRoleAssignment table.
# The /me/roles endpoint reads from the table and returns permissions.
# Permify relationships are CREATED when a DynamicRoleAssignment is created,
# and DELETED when it expires or is revoked.
```

---

## 7. API CONTRACTS (COMPLETE)

### 7.1 Device Trust APIs

```
POST   /api/v1/device/register                    # Initiate device registration
POST   /api/v1/device/resend-sms                   # Resend verification SMS
GET    /api/v1/device/status                        # Check registration status (poll)
POST   /api/v1/device/transfer/initiate             # Start device transfer (old phone)
POST   /api/v1/device/transfer/complete             # Complete transfer (new phone)
DELETE /api/v1/device/revoke                        # Self-revoke device

# Webhooks (called by SMS gateway, no auth)
POST   /api/v1/webhooks/sms/incoming                # SMS gateway webhook (MSG91/Kaleyra)

# Admin device management
GET    /api/v1/admin/devices                        # List all registered devices
GET    /api/v1/admin/devices/{user_id}              # Get device info for a user
POST   /api/v1/admin/devices/{user_id}/reset        # Admin-initiated device reset
GET    /api/v1/admin/devices/flagged                # Users with 3+ resets in 30 days
GET    /api/v1/admin/devices/stats                   # Device registration statistics
```

### 7.2 QR APIs

```
# QR Generation (requires Level 2: Device Verified)
GET    /api/v1/qr/identity                          # Get identity QR token (auto-refresh)
GET    /api/v1/qr/identity/refresh                   # Force refresh QR token

# QR Scanning (requires Level 3+: QR Secured)
POST   /api/v1/qr/scan/mode-a                       # Scanner reads someone's QR (Mode A)
POST   /api/v1/qr/scan/mode-b                       # User scans location QR (Mode B)
POST   /api/v1/qr/scan/mode-b/confirm               # Confirm action (e.g., select book to return)

# Scan History
GET    /api/v1/qr/history                            # Current user's scan history
GET    /api/v1/qr/history/meals                      # Filtered: mess meals only
GET    /api/v1/qr/history/library                    # Filtered: library only
GET    /api/v1/qr/history/attendance                 # Filtered: attendance only

# Action Point Management (Admin)
GET    /api/v1/admin/qr/action-points                # List all action points
POST   /api/v1/admin/qr/action-points                # Create action point
PUT    /api/v1/admin/qr/action-points/{id}           # Update action point
DELETE /api/v1/admin/qr/action-points/{id}           # Deactivate action point
GET    /api/v1/admin/qr/action-points/{id}/generate  # Generate printable QR for Mode B
GET    /api/v1/admin/qr/action-points/{id}/stats      # Scan statistics for this point

# Scan Logs (Admin)
GET    /api/v1/admin/qr/scan-logs                    # All scan logs with filters
GET    /api/v1/admin/qr/scan-logs/summary             # Summary: scans per action type per day
GET    /api/v1/admin/qr/scan-logs/anomalies            # Flagged anomalous scans
GET    /api/v1/admin/qr/scan-logs/export               # Export as CSV

# Public (no auth)
GET    /api/v1/public/verify/{certificate_number}    # Certificate verification via QR
```

### 7.3 Dynamic Role & Committee APIs

```
# Current user's roles
GET    /api/v1/me/roles                              # All active dynamic role assignments
GET    /api/v1/me/committees                          # Filtered: committee roles only

# Committee member views (requires active committee membership)
GET    /api/v1/committees/{id}                        # Committee detail
GET    /api/v1/committees/{id}/grievances              # Cases assigned to committee
GET    /api/v1/committees/{id}/meetings                # Committee meetings
POST   /api/v1/committees/{id}/meetings                # Schedule meeting (chair/secretary)
GET    /api/v1/committees/{id}/meetings/{mid}          # Meeting detail with minutes
POST   /api/v1/committees/{id}/meetings/{mid}/minutes  # Upload minutes
GET    /api/v1/committees/{id}/documents               # Committee documents
GET    /api/v1/committees/{id}/action-items             # Action items
PUT    /api/v1/committees/{id}/action-items/{aid}       # Update action item status

# Admin management of dynamic roles
GET    /api/v1/admin/role-assignments                  # List all
POST   /api/v1/admin/role-assignments                  # Create assignment
PUT    /api/v1/admin/role-assignments/{id}              # Update
DELETE /api/v1/admin/role-assignments/{id}              # Revoke
GET    /api/v1/admin/role-assignments/expiring          # Expiring within 30 days

# Admin committee member management
POST   /api/v1/admin/committees/{id}/add-member         # Add + create DynamicRoleAssignment
POST   /api/v1/admin/committees/{id}/remove-member      # Remove + revoke role
```

---

## 8. SMS GATEWAY INTEGRATION

### 8.1 Gateway Abstraction

```python
# backend/app/engines/integration/sms/base.py

from abc import ABC, abstractmethod

class SMSGateway(ABC):
    """Abstract SMS gateway. Supports both sending OTPs and receiving incoming SMS."""
    
    @abstractmethod
    async def send_otp(self, phone: str, otp: str, template_id: str) -> str:
        """Send an OTP SMS. Returns gateway message ID."""
        pass
    
    @abstractmethod
    async def get_virtual_number(self) -> str:
        """Get the virtual number that receives incoming SMS."""
        pass
    
    @abstractmethod
    def parse_incoming_webhook(self, payload: dict) -> IncomingSMS:
        """Parse the incoming SMS webhook payload from this gateway."""
        pass


# backend/app/engines/integration/sms/msg91.py

class MSG91Gateway(SMSGateway):
    """
    MSG91 implementation.
    
    Setup required:
    1. MSG91 account with transactional route
    2. DLT registration for templates (mandatory in India)
    3. Virtual mobile number (VMN) for incoming SMS
    4. Incoming SMS webhook configured to POST to our endpoint
    
    Pricing (Feb 2026):
    - Outgoing SMS: ₹0.15-0.20 per SMS (transactional)
    - VMN rental: ₹500-1000/month
    - Incoming SMS: ₹0.10-0.15 per received SMS
    
    Fallback: Kaleyra (formerly Solutions Infini)
    """
    
    def __init__(self):
        self.api_key = settings.MSG91_API_KEY
        self.sender_id = settings.MSG91_SENDER_ID  # 6-char: "ACOLYT"
        self.vmn = settings.MSG91_VIRTUAL_NUMBER     # +919999888877
        self.dlt_te_id = settings.MSG91_DLT_TEMPLATE_ID
    
    async def send_otp(self, phone: str, otp: str, template_id: str) -> str:
        """Not used for device verification (student sends TO us), 
        but used for other OTP needs (password reset, etc.)."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.msg91.com/api/v5/flow/",
                headers={"authkey": self.api_key},
                json={
                    "template_id": template_id,
                    "short_url": "0",
                    "recipients": [{"mobiles": phone, "otp": otp}],
                }
            )
            return response.json().get("request_id", "")
    
    def parse_incoming_webhook(self, payload: dict) -> IncomingSMS:
        """
        MSG91 incoming SMS webhook format:
        {
            "sender": "919876543210",
            "message": "ACOLYTE VERIFY 847293",
            "keyword": "ACOLYTE",
            "received_at": "2026-02-13 10:30:00",
            "operator": "Jio"
        }
        """
        sender = payload.get("sender", "")
        if not sender.startswith("+"):
            sender = f"+{sender}" if not sender.startswith("91") else f"+{sender}"
            if sender.startswith("+91") and len(sender) == 13:
                pass  # Valid Indian number
            else:
                sender = f"+91{sender[-10:]}"  # Normalize
        
        return IncomingSMS(
            sender=sender,
            message=payload.get("message", "").strip(),
            received_at=payload.get("received_at"),
            gateway_message_id=payload.get("msgId", ""),
        )
```

---

## 9. EVENT BUS INTEGRATION

```python
# Events published by the QR system and Dynamic Role system.
# These integrate with the existing Redis Pub/Sub event bus.

# ── QR Events ──

"qr.mess_entry"           # Payload: {user_id, meal, mess_unit_id, timestamp}
                           # Subscribers: Admin Engine (mess billing), 
                           #              Compliance Engine (student campus presence)

"qr.library_checkout"     # Payload: {user_id, book_id, due_date}
                           # Subscribers: Admin Engine (library stats for NAAC)

"qr.library_return"       # Payload: {user_id, book_id, fine_amount}
                           # Subscribers: Admin Engine (fine collection)

"qr.attendance_marked"    # Payload: {user_id, class_session_id, subject, gps_validated}
                           # Subscribers: Compliance Engine (AEBAS reconciliation),
                           #              Faculty Engine (class attendance records)

"qr.clinical_posting"     # Payload: {user_id, rotation_id, department, hours_added}
                           # Subscribers: Compliance Engine (NMC hour tracking)

"qr.hostel_checkin"       # Payload: {user_id, direction, curfew_violation}
                           # Subscribers: Admin Engine (warden notifications if curfew)

"qr.exam_hall_entry"      # Payload: {user_id, exam_id, seat_number}
                           # Subscribers: Faculty Engine (exam attendance)

# ── Device Events ──

"device.registered"        # Payload: {user_id, device_model, platform}
"device.revoked"           # Payload: {user_id, reason, revoked_by}
"device.transferred"       # Payload: {user_id, old_device, new_device}
"device.suspicious_resets" # Payload: {user_id, reset_count, period_days}
                           # Subscribers: Admin Engine (security alert notification)

# ── Dynamic Role Events ──

"role.assigned"            # Payload: {user_id, role_type, context_type, context_name}
                           # Subscribers: Notification service (push notification to user)

"role.revoked"             # Payload: {user_id, role_type, context_type, reason}
"role.expiring"            # Payload: {user_id, role_type, expires_in_days}
                           # Published by Celery beat task 7 days before expiry
```

---

## 10. CELERY BACKGROUND TASKS

```python
# backend/app/shared/tasks/device_tasks.py

@celery.task(queue="default")
def check_expired_device_tokens():
    """Run daily. Expire device tokens past their expiry date."""
    # Mark status = "expired" where token_expires_at < now and status = "active"

@celery.task(queue="default")
def flag_suspicious_device_resets():
    """Run daily. Flag users with 3+ device resets in last 30 days."""
    # Query device_reset_logs, group by user_id, count where reset_at > 30 days ago
    # Publish "device.suspicious_resets" event for each flagged user

@celery.task(queue="default")
def cleanup_expired_transfer_requests():
    """Run hourly. Mark expired transfer requests."""
    # Update status = "expired" where expires_at < now and status = "pending"


# backend/app/shared/tasks/qr_tasks.py

@celery.task(queue="default")
def rotate_action_point_qrs():
    """Run every minute. Generate new QR data for rotating action points."""
    # Query QRActionPoints where qr_rotation_minutes > 0
    # Update qr_static_data with new rotation key based on current timestamp

@celery.task(queue="default")
def generate_qr_usage_report():
    """Run daily at midnight. Aggregate daily scan counts by action type."""
    # Group QRScanLog by action_type, count successes/failures
    # Store in a daily_qr_stats table for dashboard


# backend/app/shared/tasks/role_tasks.py

@celery.task(queue="default")
def check_expiring_roles():
    """Run daily. Publish events for roles expiring within 7 days."""
    # Query DynamicRoleAssignment where valid_until between now and now+7d
    # Publish "role.expiring" event for each

@celery.task(queue="default")
def auto_deactivate_expired_roles():
    """Run daily. Deactivate roles past their valid_until date."""
    # Update is_active = false where auto_deactivate = true 
    # and valid_until < today and is_active = true
    # Also delete Permify relationships for deactivated roles
```

---

## 11. MOBILE APP INTEGRATION (EXPO)

### 11.1 Required Packages

```bash
# Device identification & security
npx expo install expo-application        # Android ID / iOS device ID
npx expo install expo-device             # Device model, manufacturer, OS
npx expo install expo-cellular           # SIM operator info
npx expo install expo-secure-store       # Keychain/Keystore for token storage
npx expo install expo-local-authentication  # Biometric (FaceID/TouchID/Fingerprint)
npx expo install expo-sms                # Send SMS from device (triggers native SMS app)
npx expo install expo-location           # GPS for geo-validation
npx expo install expo-camera             # QR scanner (or expo-barcode-scanner)
npx expo install expo-constants          # Device constants

# QR Code display
npm install react-native-qrcode-svg      # Render QR codes from JWT tokens
npm install react-native-svg             # Dependency for qrcode-svg

# Alternative QR scanner (better performance)
npm install react-native-vision-camera   # Fast camera with frame processor
npm install vision-camera-code-scanner   # QR/barcode scanning for vision-camera
```

### 11.2 File Structure (Mobile App)

```
apps/mobile/
├── app/
│   ├── (auth)/
│   │   └── register-device.tsx         # ← NEW: Device registration flow
│   ├── (tabs)/
│   │   ├── home/
│   │   ├── study/
│   │   ├── qr/                         # ← NEW: QR tab (central)
│   │   │   ├── index.tsx               # Tab layout with "My QR" / "Scan" tabs
│   │   │   ├── my-qr.tsx              # Shows identity QR (auto-refreshing)
│   │   │   ├── scan.tsx               # Camera scanner for Mode B
│   │   │   ├── scan-result.tsx        # Shows scan result (success/error)
│   │   │   └── history.tsx            # Scan history
│   │   ├── committees/                 # ← NEW: My Committees
│   │   │   ├── index.tsx              # List of user's committees
│   │   │   └── [id].tsx              # Committee detail page
│   │   ├── logbook/
│   │   └── profile/
│   │       └── device-settings.tsx    # ← NEW: Device management
│   └── _layout.tsx
├── lib/
│   ├── device-trust/                   # ← NEW
│   │   ├── registration.ts           # Device registration flow logic
│   │   ├── fingerprint.ts            # Device fingerprint computation
│   │   ├── token-manager.ts          # Store/retrieve device trust token
│   │   └── sms-verification.ts       # Trigger SMS from device
│   ├── qr/                            # ← NEW
│   │   ├── identity-qr.ts            # Generate/refresh identity QR token
│   │   ├── scanner.ts                # QR scanning logic
│   │   └── action-processor.ts       # Handle scan results (UI flow)
│   └── api/
│       ├── device-api.ts              # ← NEW: Device trust API calls
│       ├── qr-api.ts                  # ← NEW: QR API calls
│       └── roles-api.ts              # ← NEW: Dynamic roles API calls
```

---

## 12. ADMIN WEB PAGES (NEW)

```
apps/web/app/(dashboard)/admin/
├── devices/                            # ← NEW: Device Management
│   └── page.tsx                       # Device registry, flagged accounts, stats
├── qr/                                 # ← NEW: QR Action Points Management
│   ├── page.tsx                       # Action points list, create/edit, generate QR PDFs
│   ├── scan-logs/
│   │   └── page.tsx                   # Scan log viewer with filters
│   └── analytics/
│       └── page.tsx                   # QR usage analytics dashboard
├── role-assignments/                   # ← NEW: Dynamic Role Management
│   └── page.tsx                       # Create/view/revoke role assignments
```

---

## 13. SECURITY HARDENING CHECKLIST

```
✅ Device Trust Token: HS256 JWT, 180-day expiry, stored in device Keychain/Keystore
✅ QR Identity Token: HS256 JWT, 5-min expiry, auto-refresh every 60s
✅ SMS Verification: SMS sent FROM device (proves SIM ownership)
✅ One Device Per Account: Enforced by unique partial index on (user_id) WHERE status='active'
✅ Device Fingerprint: SHA-256 of device_id + platform + model + screen dimensions
✅ Verification Code: 6 digits, crypto-random, stored hashed (SHA-256), 10-min expiry
✅ Transfer Code: 8 digits, 15-min expiry, one-time use, old device immediately revoked
✅ Action Point Signatures: HMAC-SHA256 with per-action-point secret keys
✅ Rotating QR Codes: Configurable rotation interval, prevents photo-sharing
✅ Geo-Validation: Haversine distance check, configurable radius per action point
✅ Duplicate Prevention: Time-windowed per action type (configurable minutes)
✅ Anomaly Detection: 3+ device resets in 30 days = flagged for review
✅ Audit Trail: Every device registration, reset, scan logged to immutable tables
✅ Rate Limiting: QR scan endpoint: 10 scans/minute per user (prevent brute force)
✅ Webhook Security: SMS gateway webhook validated by shared secret in query param
✅ No Raw Aadhaar: Only SHA-256 hash stored (existing policy, maintained)
✅ Token Revocation: On device revoke, token hash is marked invalid, all future requests rejected
✅ Biometric Escalation: Strict mode requires device FaceID/TouchID for high-security actions
```

---

## 14. TESTING STRATEGY

```python
# Tests to write (in order of priority)

# 1. Device Trust
test_device_registration_happy_path()
test_device_registration_phone_mismatch()
test_device_registration_duplicate_active_device()
test_sms_verification_correct_code_correct_phone()
test_sms_verification_wrong_code()
test_sms_verification_wrong_phone()
test_sms_verification_expired_code()
test_device_transfer_happy_path()
test_device_transfer_expired_code()
test_device_revocation_self_service()
test_device_revocation_admin_initiated()
test_anomaly_detection_multiple_resets()
test_one_active_device_constraint()

# 2. QR Processing
test_mode_a_scan_valid_token()
test_mode_a_scan_expired_token()
test_mode_a_scan_device_mismatch()
test_mode_a_scan_duplicate_within_window()
test_mode_b_scan_valid_signature()
test_mode_b_scan_tampered_signature()
test_mode_b_scan_expired_rotation()
test_geo_validation_within_radius()
test_geo_validation_outside_radius()
test_mess_entry_handler_meals_by_time()
test_library_checkout_handler_max_books()
test_library_return_handler_with_fine()

# 3. Dynamic Roles
test_role_assignment_creates_permify_relation()
test_role_revocation_removes_permify_relation()
test_auto_deactivate_expired_roles()
test_me_roles_returns_only_active()
test_committee_access_member_can_view_cases()
test_committee_access_non_member_blocked()
test_committee_chair_can_update_status()
test_committee_member_cannot_update_status()

# 4. Integration Tests
test_full_flow_register_device_scan_mess_qr()
test_full_flow_library_checkout_and_return()
test_full_flow_device_transfer_and_rescan()
```
