"""Seed QR action points, dynamic roles, and committee meetings for development.

Creates:
- 15 QR action points across campus locations
- 4 dynamic role assignments (committee, class rep, invigilator)
- 2 committee meetings (1 upcoming, 1 past with minutes)

Depends on: seed_admin_data.py (for COLLEGE_ID, DEPT_IDS, faculty/student UUIDs)

Usage:
    cd backend && python -m scripts.seed_qr_and_roles
"""

import asyncio
import json
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text

from app.core.database import async_session_factory

# ---------------------------------------------------------------------------
# Shared IDs from seed_admin_data.py (must be run first)
# ---------------------------------------------------------------------------
COLLEGE_ID = uuid.UUID("a0000001-0001-4000-8000-000000000001")

# Student UUIDs (from seed_admin_data)
STUDENT_1_ID = uuid.UUID("50000001-0001-4000-8000-000000000001")
STUDENT_2_ID = uuid.UUID("50000001-0002-4000-8000-000000000001")

# Faculty UUIDs (from seed_admin_data)
FACULTY_1_ID = uuid.UUID("f0000001-0001-4000-8000-000000000001")  # Dr. Rajesh Kumar (Anatomy)
FACULTY_2_ID = uuid.UUID("f0000001-0002-4000-8000-000000000001")  # Dr. Priya Sharma (Anatomy)

# Batch ID
BATCH_2025_ID = uuid.UUID("e0000001-0002-4000-8000-000000000001")

# Committee ID (new)
ANTI_RAGGING_COMMITTEE_ID = uuid.UUID("c3000001-0001-4000-8000-000000000001")

NOW = datetime.now(timezone.utc)
TODAY = date.today()

# ---------------------------------------------------------------------------
# QR Action Point definitions
# ---------------------------------------------------------------------------
QR_ACTION_POINTS = [
    {
        "id": uuid.UUID("ac000001-0001-4000-8000-000000000001"),
        "name": "Main Mess Entrance",
        "location_code": "mess_main_entrance",
        "action_type": "mess_entry",
        "qr_mode": "mode_a",
        "building": "Hostel Block",
        "floor": "Ground",
        "description": "Main dining hall entrance — scan student QR for mess entry",
        "geo_lat": 15.4537,
        "geo_lng": 75.0078,
        "geo_radius_meters": 50,
        "duplicate_window_minutes": 30,
        "security_level": "standard",
        "qr_rotation_minutes": 0,
    },
    {
        "id": uuid.UUID("ac000001-0002-4000-8000-000000000001"),
        "name": "PG Mess Entrance",
        "location_code": "mess_pg_entrance",
        "action_type": "mess_entry",
        "qr_mode": "mode_a",
        "building": "PG Hostel Block",
        "floor": "Ground",
        "description": "PG dining hall entrance",
        "geo_lat": 15.4540,
        "geo_lng": 75.0082,
        "geo_radius_meters": 50,
        "duplicate_window_minutes": 30,
        "security_level": "standard",
        "qr_rotation_minutes": 0,
    },
    {
        "id": uuid.UUID("ac000001-0003-4000-8000-000000000001"),
        "name": "Library Entrance",
        "location_code": "library_entrance",
        "action_type": "library_visit",
        "qr_mode": "mode_a",
        "building": "Library",
        "floor": "Ground",
        "description": "Library main entrance — scan for visit tracking",
        "geo_lat": 15.4545,
        "geo_lng": 75.0085,
        "geo_radius_meters": 50,
        "duplicate_window_minutes": 0,
        "security_level": "standard",
        "qr_rotation_minutes": 0,
    },
    {
        "id": uuid.UUID("ac000001-0004-4000-8000-000000000001"),
        "name": "Library Issue Desk 1",
        "location_code": "library_desk_1",
        "action_type": "library_checkout",
        "qr_mode": "mode_b",
        "building": "Library",
        "floor": "Ground",
        "description": "Book issue desk — person scans static QR",
        "geo_lat": None,
        "geo_lng": None,
        "geo_radius_meters": None,
        "duplicate_window_minutes": 5,
        "security_level": "standard",
        "qr_rotation_minutes": 0,
    },
    {
        "id": uuid.UUID("ac000001-0005-4000-8000-000000000001"),
        "name": "Library Return Desk",
        "location_code": "library_return_desk",
        "action_type": "library_return",
        "qr_mode": "mode_b",
        "building": "Library",
        "floor": "Ground",
        "description": "Book return desk — person scans static QR",
        "geo_lat": None,
        "geo_lng": None,
        "geo_radius_meters": None,
        "duplicate_window_minutes": 5,
        "security_level": "standard",
        "qr_rotation_minutes": 0,
    },
    {
        "id": uuid.UUID("ac000001-0006-4000-8000-000000000001"),
        "name": "Anatomy Lecture Hall",
        "location_code": "anatomy_lecture_hall",
        "action_type": "attendance_mark",
        "qr_mode": "mode_b",
        "building": "Academic Block",
        "floor": "1st Floor",
        "description": "Anatomy LH — rotating QR for attendance marking",
        "geo_lat": 15.4550,
        "geo_lng": 75.0090,
        "geo_radius_meters": 30,
        "duplicate_window_minutes": 60,
        "security_level": "elevated",
        "qr_rotation_minutes": 5,
    },
    {
        "id": uuid.UUID("ac000001-0007-4000-8000-000000000001"),
        "name": "Physiology Lecture Hall",
        "location_code": "physiology_lecture_hall",
        "action_type": "attendance_mark",
        "qr_mode": "mode_b",
        "building": "Academic Block",
        "floor": "1st Floor",
        "description": "Physiology LH — rotating QR for attendance",
        "geo_lat": 15.4551,
        "geo_lng": 75.0091,
        "geo_radius_meters": 30,
        "duplicate_window_minutes": 60,
        "security_level": "elevated",
        "qr_rotation_minutes": 5,
    },
    {
        "id": uuid.UUID("ac000001-0008-4000-8000-000000000001"),
        "name": "Biochemistry Lecture Hall",
        "location_code": "biochemistry_lecture_hall",
        "action_type": "attendance_mark",
        "qr_mode": "mode_b",
        "building": "Academic Block",
        "floor": "2nd Floor",
        "description": "Biochemistry LH — rotating QR for attendance",
        "geo_lat": 15.4552,
        "geo_lng": 75.0092,
        "geo_radius_meters": 30,
        "duplicate_window_minutes": 60,
        "security_level": "elevated",
        "qr_rotation_minutes": 5,
    },
    {
        "id": uuid.UUID("ac000001-0009-4000-8000-000000000001"),
        "name": "Boys Hostel Gate",
        "location_code": "hostel_boys_gate",
        "action_type": "hostel_checkin",
        "qr_mode": "mode_a",
        "building": "Boys Hostel",
        "floor": "Ground",
        "description": "Boys hostel main gate — scan student QR for check-in/out",
        "geo_lat": 15.4535,
        "geo_lng": 75.0075,
        "geo_radius_meters": 30,
        "duplicate_window_minutes": 0,
        "security_level": "standard",
        "qr_rotation_minutes": 0,
    },
    {
        "id": uuid.UUID("ac000001-0010-4000-8000-000000000001"),
        "name": "Girls Hostel Gate",
        "location_code": "hostel_girls_gate",
        "action_type": "hostel_checkin",
        "qr_mode": "mode_a",
        "building": "Girls Hostel",
        "floor": "Ground",
        "description": "Girls hostel main gate — scan student QR for check-in/out",
        "geo_lat": 15.4536,
        "geo_lng": 75.0076,
        "geo_radius_meters": 30,
        "duplicate_window_minutes": 0,
        "security_level": "standard",
        "qr_rotation_minutes": 0,
    },
    {
        "id": uuid.UUID("ac000001-0011-4000-8000-000000000001"),
        "name": "Medicine Ward",
        "location_code": "medicine_ward",
        "action_type": "clinical_posting",
        "qr_mode": "mode_b",
        "building": "Hospital",
        "floor": "2nd Floor",
        "description": "Medicine ward — clinical posting attendance with GPS",
        "geo_lat": 15.4555,
        "geo_lng": 75.0095,
        "geo_radius_meters": 50,
        "duplicate_window_minutes": 0,
        "security_level": "elevated",
        "qr_rotation_minutes": 10,
    },
    {
        "id": uuid.UUID("ac000001-0012-4000-8000-000000000001"),
        "name": "Surgery Ward",
        "location_code": "surgery_ward",
        "action_type": "clinical_posting",
        "qr_mode": "mode_b",
        "building": "Hospital",
        "floor": "3rd Floor",
        "description": "Surgery ward — clinical posting attendance with GPS",
        "geo_lat": 15.4556,
        "geo_lng": 75.0096,
        "geo_radius_meters": 50,
        "duplicate_window_minutes": 0,
        "security_level": "elevated",
        "qr_rotation_minutes": 10,
    },
    {
        "id": uuid.UUID("ac000001-0013-4000-8000-000000000001"),
        "name": "OB-GYN Ward",
        "location_code": "ob_gyn_ward",
        "action_type": "clinical_posting",
        "qr_mode": "mode_b",
        "building": "Hospital",
        "floor": "4th Floor",
        "description": "OB-GYN ward — clinical posting attendance with GPS",
        "geo_lat": 15.4557,
        "geo_lng": 75.0097,
        "geo_radius_meters": 50,
        "duplicate_window_minutes": 0,
        "security_level": "elevated",
        "qr_rotation_minutes": 10,
    },
    {
        "id": uuid.UUID("ac000001-0014-4000-8000-000000000001"),
        "name": "Pediatrics Ward",
        "location_code": "pediatrics_ward",
        "action_type": "clinical_posting",
        "qr_mode": "mode_b",
        "building": "Hospital",
        "floor": "5th Floor",
        "description": "Pediatrics ward — clinical posting attendance with GPS",
        "geo_lat": 15.4558,
        "geo_lng": 75.0098,
        "geo_radius_meters": 50,
        "duplicate_window_minutes": 0,
        "security_level": "elevated",
        "qr_rotation_minutes": 10,
    },
    {
        "id": uuid.UUID("ac000001-0015-4000-8000-000000000001"),
        "name": "Exam Hall 1",
        "location_code": "exam_hall_1",
        "action_type": "exam_hall_entry",
        "qr_mode": "mode_a",
        "building": "Academic Block",
        "floor": "Ground",
        "description": "Exam hall — strict security with biometric verification",
        "geo_lat": 15.4549,
        "geo_lng": 75.0089,
        "geo_radius_meters": 20,
        "duplicate_window_minutes": 0,
        "security_level": "strict",
        "qr_rotation_minutes": 0,
    },
]

# ---------------------------------------------------------------------------
# Dynamic Role Assignment definitions
# ---------------------------------------------------------------------------
ROLE_ASSIGNMENTS = [
    {
        "id": uuid.UUID("ra000001-0001-4000-8000-000000000001"),
        "user_id": STUDENT_1_ID,
        "user_name": "Aarav Sharma",
        "role_type": "committee_member",
        "context_type": "committee",
        "context_id": ANTI_RAGGING_COMMITTEE_ID,
        "context_name": "Anti-Ragging Committee",
        "valid_from": date(2025, 8, 1),
        "valid_until": date(2026, 7, 31),
        "auto_deactivate": True,
        "permissions": ["view_cases", "view_minutes", "view_documents"],
        "assigned_by": "admin",
    },
    {
        "id": uuid.UUID("ra000001-0002-4000-8000-000000000001"),
        "user_id": FACULTY_1_ID,
        "user_name": "Dr. Rajesh Kumar",
        "role_type": "committee_chair",
        "context_type": "committee",
        "context_id": ANTI_RAGGING_COMMITTEE_ID,
        "context_name": "Anti-Ragging Committee",
        "valid_from": date(2025, 8, 1),
        "valid_until": date(2026, 7, 31),
        "auto_deactivate": True,
        "permissions": [
            "view_cases", "update_status", "resolve_case",
            "file_minutes", "schedule_meeting", "manage_members",
        ],
        "assigned_by": "admin",
    },
    {
        "id": uuid.UUID("ra000001-0003-4000-8000-000000000001"),
        "user_id": STUDENT_2_ID,
        "user_name": "Vivaan Sharma",
        "role_type": "class_representative",
        "context_type": "batch",
        "context_id": BATCH_2025_ID,
        "context_name": "Batch 2025 Phase I",
        "valid_from": date(2025, 8, 1),
        "valid_until": date(2026, 7, 31),
        "auto_deactivate": True,
        "permissions": ["view_notices", "submit_feedback", "represent_batch"],
        "assigned_by": "admin",
    },
    {
        "id": uuid.UUID("ra000001-0004-4000-8000-000000000001"),
        "user_id": FACULTY_2_ID,
        "user_name": "Dr. Priya Sharma",
        "role_type": "exam_invigilator",
        "context_type": "exam",
        "context_id": uuid.UUID("ex000001-0001-4000-8000-000000000001"),
        "context_name": "Phase I Internal Assessment Feb 2026",
        "valid_from": TODAY,
        "valid_until": TODAY + timedelta(days=7),
        "auto_deactivate": True,
        "permissions": ["access_exam_hall", "verify_students", "report_incidents"],
        "assigned_by": "admin",
    },
]

# ---------------------------------------------------------------------------
# Committee Meetings
# ---------------------------------------------------------------------------
PAST_MEETING_ID = uuid.UUID("cm000001-0001-4000-8000-000000000001")
UPCOMING_MEETING_ID = uuid.UUID("cm000001-0002-4000-8000-000000000001")

COMMITTEE_MEETINGS = [
    {
        "id": PAST_MEETING_ID,
        "committee_id": ANTI_RAGGING_COMMITTEE_ID,
        "title": "Anti-Ragging Committee — Monthly Review (Jan 2026)",
        "meeting_date": date(2026, 1, 15),
        "description": "Monthly review of anti-ragging measures and incident reports",
        "location": "Conference Room, Admin Block",
        "agenda": [
            "Review of incidents reported in December 2025",
            "Status of awareness campaign in hostels",
            "Feedback from student representatives",
        ],
        "status": "completed",
        "minutes_text": (
            "Meeting called to order at 10:00 AM. "
            "Chair Dr. Rajesh Kumar presided. "
            "No new ragging incidents reported in December. "
            "Awareness posters to be refreshed in all hostel blocks. "
            "Student rep Aarav Sharma reported positive feedback from freshers. "
            "Next meeting scheduled for February 15, 2026."
        ),
        "minutes_filed_by": FACULTY_1_ID,
        "attendees": [
            str(FACULTY_1_ID),
            str(STUDENT_1_ID),
        ],
        "quorum_met": True,
    },
    {
        "id": UPCOMING_MEETING_ID,
        "committee_id": ANTI_RAGGING_COMMITTEE_ID,
        "title": "Anti-Ragging Committee — Monthly Review (Feb 2026)",
        "meeting_date": TODAY + timedelta(days=7),
        "description": "Monthly review and fresher orientation safety planning",
        "location": "Conference Room, Admin Block",
        "agenda": [
            "Review reported incidents",
            "Discuss awareness campaign",
            "Plan fresher orientation safety measures",
        ],
        "status": "scheduled",
        "minutes_text": None,
        "minutes_filed_by": None,
        "attendees": None,
        "quorum_met": None,
    },
]

# ---------------------------------------------------------------------------
# Action Items
# ---------------------------------------------------------------------------
ACTION_ITEMS = [
    {
        "id": uuid.UUID("ai000001-0001-4000-8000-000000000001"),
        "committee_id": ANTI_RAGGING_COMMITTEE_ID,
        "meeting_id": PAST_MEETING_ID,
        "title": "Refresh anti-ragging awareness posters in all hostel blocks",
        "description": "Replace old posters with updated designs including helpline numbers",
        "assigned_to": STUDENT_1_ID,
        "assigned_to_name": "Aarav Sharma",
        "due_date": date(2026, 2, 1),
        "status": "completed",
        "completed_at": datetime(2026, 1, 28, 14, 0, tzinfo=timezone.utc),
        "notes": "Completed — new posters put up in Boys Hostel 1 and Girls Hostel 1",
    },
    {
        "id": uuid.UUID("ai000001-0002-4000-8000-000000000001"),
        "committee_id": ANTI_RAGGING_COMMITTEE_ID,
        "meeting_id": PAST_MEETING_ID,
        "title": "Draft fresher orientation safety protocol document",
        "description": "Prepare a comprehensive safety protocol for new batch orientation week",
        "assigned_to": FACULTY_1_ID,
        "assigned_to_name": "Dr. Rajesh Kumar",
        "due_date": date(2026, 2, 15),
        "status": "pending",
        "completed_at": None,
        "notes": None,
    },
]


async def seed():
    async with async_session_factory() as session:
        await session.execute(text("SET app.is_superadmin = 'true'"))
        await session.execute(text(f"SET app.current_college_id = '{COLLEGE_ID}'"))

        # ---------------------------------------------------------------
        # 1. QR Action Points (15)
        # ---------------------------------------------------------------
        for ap in QR_ACTION_POINTS:
            await session.execute(text("""
                INSERT INTO qr_action_points (
                    id, college_id, name, location_code, action_type,
                    qr_mode, building, floor, description,
                    geo_lat, geo_lng, geo_radius_meters,
                    duplicate_window_minutes, security_level,
                    qr_rotation_minutes, qr_secret,
                    is_active, created_at, updated_at
                ) VALUES (
                    :id, :college_id, :name, :location_code, :action_type,
                    :qr_mode, :building, :floor, :description,
                    :geo_lat, :geo_lng, :geo_radius_meters,
                    :duplicate_window_minutes, :security_level,
                    :qr_rotation_minutes, :qr_secret,
                    true, NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    action_type = EXCLUDED.action_type
            """), {
                "id": str(ap["id"]),
                "college_id": str(COLLEGE_ID),
                "name": ap["name"],
                "location_code": ap["location_code"],
                "action_type": ap["action_type"],
                "qr_mode": ap["qr_mode"],
                "building": ap["building"],
                "floor": ap["floor"],
                "description": ap["description"],
                "geo_lat": ap["geo_lat"],
                "geo_lng": ap["geo_lng"],
                "geo_radius_meters": ap["geo_radius_meters"],
                "duplicate_window_minutes": ap["duplicate_window_minutes"],
                "security_level": ap["security_level"],
                "qr_rotation_minutes": ap["qr_rotation_minutes"],
                "qr_secret": secrets.token_hex(32),
            })

        # ---------------------------------------------------------------
        # 2. Dynamic Role Assignments (4)
        # ---------------------------------------------------------------
        for ra in ROLE_ASSIGNMENTS:
            await session.execute(text("""
                INSERT INTO dynamic_role_assignments (
                    id, college_id, user_id, user_name,
                    role_type, context_type, context_id, context_name,
                    valid_from, valid_until, auto_deactivate,
                    permissions, assigned_by, is_active,
                    created_at, updated_at
                ) VALUES (
                    :id, :college_id, :user_id, :user_name,
                    :role_type, :context_type, :context_id, :context_name,
                    :valid_from, :valid_until, :auto_deactivate,
                    :permissions::jsonb, :assigned_by, true,
                    NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    role_type = EXCLUDED.role_type,
                    permissions = EXCLUDED.permissions
            """), {
                "id": str(ra["id"]),
                "college_id": str(COLLEGE_ID),
                "user_id": str(ra["user_id"]),
                "user_name": ra["user_name"],
                "role_type": ra["role_type"],
                "context_type": ra["context_type"],
                "context_id": str(ra["context_id"]),
                "context_name": ra["context_name"],
                "valid_from": ra["valid_from"].isoformat(),
                "valid_until": ra["valid_until"].isoformat(),
                "auto_deactivate": ra["auto_deactivate"],
                "permissions": json.dumps(ra["permissions"]),
                "assigned_by": ra["assigned_by"],
            })

        # ---------------------------------------------------------------
        # 3. Committee Meetings (2)
        # ---------------------------------------------------------------
        for mtg in COMMITTEE_MEETINGS:
            await session.execute(text("""
                INSERT INTO committee_meetings (
                    id, college_id, committee_id, title,
                    meeting_date, description, location,
                    agenda, status, minutes_text, minutes_filed_by,
                    attendees, quorum_met,
                    created_at, updated_at
                ) VALUES (
                    :id, :college_id, :committee_id, :title,
                    :meeting_date, :description, :location,
                    :agenda::jsonb, :status, :minutes_text, :minutes_filed_by,
                    :attendees::jsonb, :quorum_met,
                    NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    status = EXCLUDED.status
            """), {
                "id": str(mtg["id"]),
                "college_id": str(COLLEGE_ID),
                "committee_id": str(mtg["committee_id"]),
                "title": mtg["title"],
                "meeting_date": mtg["meeting_date"].isoformat(),
                "description": mtg["description"],
                "location": mtg["location"],
                "agenda": json.dumps(mtg["agenda"]),
                "status": mtg["status"],
                "minutes_text": mtg["minutes_text"],
                "minutes_filed_by": str(mtg["minutes_filed_by"]) if mtg["minutes_filed_by"] else None,
                "attendees": json.dumps(mtg["attendees"]) if mtg["attendees"] else None,
                "quorum_met": mtg["quorum_met"],
            })

        # ---------------------------------------------------------------
        # 4. Action Items (2)
        # ---------------------------------------------------------------
        for item in ACTION_ITEMS:
            await session.execute(text("""
                INSERT INTO committee_action_items (
                    id, college_id, committee_id, meeting_id,
                    title, description, assigned_to, assigned_to_name,
                    due_date, status, completed_at, notes,
                    created_at, updated_at
                ) VALUES (
                    :id, :college_id, :committee_id, :meeting_id,
                    :title, :description, :assigned_to, :assigned_to_name,
                    :due_date, :status, :completed_at, :notes,
                    NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    notes = EXCLUDED.notes
            """), {
                "id": str(item["id"]),
                "college_id": str(COLLEGE_ID),
                "committee_id": str(item["committee_id"]),
                "meeting_id": str(item["meeting_id"]),
                "title": item["title"],
                "description": item["description"],
                "assigned_to": str(item["assigned_to"]),
                "assigned_to_name": item["assigned_to_name"],
                "due_date": item["due_date"].isoformat(),
                "status": item["status"],
                "completed_at": item["completed_at"].isoformat() if item["completed_at"] else None,
                "notes": item["notes"],
            })

        await session.commit()

        print("QR & Roles seed data created successfully!")
        print(f"  QR Action Points: {len(QR_ACTION_POINTS)}")
        print(f"  Dynamic Role Assignments: {len(ROLE_ASSIGNMENTS)}")
        print(f"  Committee Meetings: {len(COMMITTEE_MEETINGS)}")
        print(f"  Action Items: {len(ACTION_ITEMS)}")


if __name__ == "__main__":
    asyncio.run(seed())
