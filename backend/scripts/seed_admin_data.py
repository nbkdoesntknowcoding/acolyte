"""Seed admin engine data for development.

Creates realistic sample data:
- 1 test college (Karnataka, 150-seat private)
- 19 NMC departments with correct codes
- 2 batches
- 20 sample students
- 15 sample faculty across departments
- Fee structures (3 quotas)
- 5 scholarship schemes (national)
- Leave policies
- Salary structures (7th CPC levels)
- Workflow definitions
- Hostel blocks & rooms

Usage:
    cd backend && python -m scripts.seed_admin_data
"""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text

from app.core.database import async_session_factory

# ---------------------------------------------------------------------------
# Deterministic UUIDs (idempotent re-runs)
# ---------------------------------------------------------------------------
COLLEGE_ID = uuid.UUID("a0000001-0001-4000-8000-000000000001")

# Department UUIDs (19 NMC departments)
DEPT_IDS = {code: uuid.UUID(f"d0000001-{i:04d}-4000-8000-000000000001") for i, code in enumerate([
    "ANAT", "PHYS", "BCHM", "PATH", "MCBIO", "PHARM", "FMT", "CMED",
    "MED", "SURG", "OBGY", "PED", "ORTH", "OPTH", "ENT", "DERM",
    "PSYCH", "ANAES", "RAD",
], start=1)}

BATCH_2024_ID = uuid.UUID("e0000001-0001-4000-8000-000000000001")
BATCH_2025_ID = uuid.UUID("e0000001-0002-4000-8000-000000000001")

NOW = datetime.now(timezone.utc)
TODAY = date.today()

# ---------------------------------------------------------------------------
# NMC Department definitions
# ---------------------------------------------------------------------------
NMC_DEPARTMENTS = [
    ("Anatomy", "ANAT", "preclinical"),
    ("Physiology", "PHYS", "preclinical"),
    ("Biochemistry", "BCHM", "preclinical"),
    ("Pathology", "PATH", "paraclinical"),
    ("Microbiology", "MCBIO", "paraclinical"),
    ("Pharmacology", "PHARM", "paraclinical"),
    ("Forensic Medicine & Toxicology", "FMT", "paraclinical"),
    ("Community Medicine", "CMED", "paraclinical"),
    ("General Medicine", "MED", "clinical"),
    ("General Surgery", "SURG", "clinical"),
    ("Obstetrics & Gynaecology", "OBGY", "clinical"),
    ("Paediatrics", "PED", "clinical"),
    ("Orthopaedics", "ORTH", "clinical"),
    ("Ophthalmology", "OPTH", "clinical"),
    ("ENT", "ENT", "clinical"),
    ("Dermatology", "DERM", "clinical"),
    ("Psychiatry", "PSYCH", "clinical"),
    ("Anaesthesiology", "ANAES", "clinical"),
    ("Radiology", "RAD", "clinical"),
]

# ---------------------------------------------------------------------------
# Sample faculty data
# ---------------------------------------------------------------------------
FACULTY_DATA = [
    ("Dr. Rajesh Kumar", "ANAT", "Professor", "MD", "Anatomy", "1975-06-15", "2005-08-01"),
    ("Dr. Priya Sharma", "ANAT", "Associate Professor", "MD", "Anatomy", "1980-03-22", "2010-07-15"),
    ("Dr. Suresh Patel", "PHYS", "Professor", "MD", "Physiology", "1972-11-08", "2003-06-01"),
    ("Dr. Anita Rao", "BCHM", "Professor", "MD", "Biochemistry", "1974-08-25", "2004-09-01"),
    ("Dr. Vikram Singh", "PATH", "Professor", "MD", "Pathology", "1970-01-30", "2001-07-01"),
    ("Dr. Meera Nair", "MCBIO", "Associate Professor", "MD", "Microbiology", "1978-04-12", "2008-06-15"),
    ("Dr. Arun Desai", "MED", "Professor", "MD", "General Medicine", "1968-09-20", "2000-05-01"),
    ("Dr. Sunita Kulkarni", "MED", "Associate Professor", "MD", "General Medicine", "1975-12-05", "2006-08-01"),
    ("Dr. Prakash Joshi", "SURG", "Professor", "MS", "General Surgery", "1969-07-14", "2001-06-01"),
    ("Dr. Kavitha Reddy", "OBGY", "Professor", "MD", "Obstetrics & Gynaecology", "1971-02-28", "2002-07-01"),
    ("Dr. Mohan Das", "PED", "Associate Professor", "MD", "Paediatrics", "1976-10-10", "2007-08-15"),
    ("Dr. Deepa Shetty", "OPTH", "Assistant Professor", "MS", "Ophthalmology", "1982-05-18", "2012-07-01"),
    ("Dr. Ravi Hegde", "ENT", "Professor", "MS", "ENT", "1973-03-07", "2004-06-01"),
    ("Dr. Lakshmi Iyer", "DERM", "Assistant Professor", "MD", "Dermatology", "1984-08-30", "2014-07-15"),
    ("Dr. Ganesh Pai", "ANAES", "Associate Professor", "MD", "Anaesthesiology", "1977-06-22", "2008-08-01"),
]


async def seed():
    async with async_session_factory() as session:
        # Set superadmin context so RLS doesn't block inserts
        await session.execute(text("SET app.is_superadmin = 'true'"))
        await session.execute(text(f"SET app.current_college_id = '{COLLEGE_ID}'"))

        # -------------------------------------------------------------------
        # 1. College (upsert)
        # -------------------------------------------------------------------
        await session.execute(text("""
            INSERT INTO colleges (id, name, code, nmc_registration_number, university_affiliation,
                state, district, city, address, pin_code, phone, email, website,
                established_year, college_type, sanctioned_intake, total_intake, status, config)
            VALUES (
                :id, :name, :code, :nmc_reg, :uni,
                :state, :district, :city, :address, :pin, :phone, :email, :website,
                :year, :type, :intake, :total_intake, 'active',
                :config::jsonb
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                sanctioned_intake = EXCLUDED.sanctioned_intake
        """), {
            "id": str(COLLEGE_ID),
            "name": "SDM College of Medical Sciences & Hospital",
            "code": "SDMCMS",
            "nmc_reg": "KA-PVT-2001-150",
            "uni": "Rajiv Gandhi University of Health Sciences, Karnataka",
            "state": "Karnataka",
            "district": "Dharwad",
            "city": "Dharwad",
            "address": "Manjushree Nagar, Sattur, Dharwad - 580009",
            "pin": "580009",
            "phone": "0836-2462655",
            "email": "info@sdmcms.edu.in",
            "website": "https://sdmcms.edu.in",
            "year": 2001,
            "type": "private",
            "intake": 150,
            "total_intake": 150,
            "config": '{"academic_calendar_start": "August", "teaching_weeks_per_year": 39, "working_days_per_week": 6, "fee_regulatory_authority": "KFRC", "timezone": "Asia/Kolkata"}',
        })

        # -------------------------------------------------------------------
        # 2. Departments (19 NMC departments)
        # -------------------------------------------------------------------
        for i, (name, code, nmc_type) in enumerate(NMC_DEPARTMENTS):
            dept_id = DEPT_IDS[code]
            await session.execute(text("""
                INSERT INTO departments (id, college_id, name, code, nmc_department_type, department_type,
                    is_active, display_order, created_at, updated_at)
                VALUES (:id, :college_id, :name, :code, :nmc_type, :dept_type,
                    true, :order, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": str(dept_id),
                "college_id": str(COLLEGE_ID),
                "name": name,
                "code": code,
                "nmc_type": nmc_type,
                "dept_type": nmc_type.replace("para", "para_"),
                "order": i + 1,
            })

        # -------------------------------------------------------------------
        # 3. Batches
        # -------------------------------------------------------------------
        for batch_id, name, year, phase in [
            (BATCH_2024_ID, "Batch 2024", 2024, "Phase I"),
            (BATCH_2025_ID, "Batch 2025", 2025, "Phase I"),
        ]:
            await session.execute(text("""
                INSERT INTO batches (id, college_id, name, batch_type, admission_year,
                    current_phase, current_semester, student_count, is_active, created_at, updated_at)
                VALUES (:id, :college_id, :name, 'admission_year', :year,
                    :phase, 1, 0, true, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": str(batch_id),
                "college_id": str(COLLEGE_ID),
                "name": name,
                "year": year,
                "phase": phase,
            })

        # -------------------------------------------------------------------
        # 4. Faculty (15 members)
        # -------------------------------------------------------------------
        for i, (name, dept_code, designation, qual, spec, dob, doj) in enumerate(FACULTY_DATA):
            fac_id = uuid.UUID(f"f0000001-{i+1:04d}-4000-8000-000000000001")
            dob_date = date.fromisoformat(dob)
            retirement = date(dob_date.year + 70, dob_date.month, dob_date.day)
            await session.execute(text("""
                INSERT INTO faculty (id, college_id, name, designation, department_id,
                    qualification, specialization, date_of_birth, date_of_joining,
                    retirement_date, employment_type, status, gender,
                    teaching_experience_years, created_at, updated_at)
                VALUES (:id, :college_id, :name, :designation, :dept_id,
                    :qual, :spec, :dob, :doj,
                    :retirement, 'permanent', 'active', 'male',
                    :exp, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": str(fac_id),
                "college_id": str(COLLEGE_ID),
                "name": name,
                "designation": designation,
                "dept_id": str(DEPT_IDS[dept_code]),
                "qual": qual,
                "spec": spec,
                "dob": dob,
                "doj": doj,
                "retirement": retirement.isoformat(),
                "exp": round((TODAY - date.fromisoformat(doj)).days / 365, 1),
            })

        # -------------------------------------------------------------------
        # 5. Students (20 sample)
        # -------------------------------------------------------------------
        first_names = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
                       "Ishita", "Saanvi", "Ananya", "Diya", "Priya", "Kavya", "Meera", "Riya",
                       "Tanvi", "Shreya", "Nisha", "Pooja"]
        quotas = ["AIQ", "AIQ", "AIQ", "State", "State", "State", "State", "State",
                  "State", "State", "Management", "Management", "Management", "Management", "NRI",
                  "State", "State", "State", "AIQ", "State"]
        categories = ["General", "OBC", "SC", "General", "OBC", "General", "ST", "General",
                      "General", "SC", "General", "OBC", "General", "EWS", "General",
                      "OBC", "General", "SC", "General", "OBC"]

        for i in range(20):
            stu_id = uuid.UUID(f"50000001-{i+1:04d}-4000-8000-000000000001")
            enroll = f"SDMCMS/2025/{i+1:03d}"
            neet_score = 550 + (i * 5) % 100
            await session.execute(text("""
                INSERT INTO students (id, college_id, name, enrollment_number,
                    admission_quota, category, neet_score, neet_year,
                    admission_year, current_phase, current_semester,
                    batch_id, status, gender, date_of_birth, is_hosteler,
                    created_at, updated_at)
                VALUES (:id, :college_id, :name, :enroll,
                    :quota, :cat, :neet, 2025,
                    2025, 'Phase I', 1,
                    :batch_id, 'active', :gender, :dob, :hosteler,
                    NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": str(stu_id),
                "college_id": str(COLLEGE_ID),
                "name": f"{first_names[i]} Sharma",
                "enroll": enroll,
                "quota": quotas[i],
                "cat": categories[i],
                "neet": neet_score,
                "batch_id": str(BATCH_2025_ID),
                "gender": "female" if i >= 8 and i < 16 else "male",
                "dob": date(2003, 1 + (i % 12), 1 + (i % 28)).isoformat(),
                "hosteler": i < 15,  # 15 out of 20 are hostelers
            })

        # -------------------------------------------------------------------
        # 6. Fee Structures (3 quotas)
        # -------------------------------------------------------------------
        fee_configs = [
            ("AIQ", 600000_00, 50000_00),      # ₹6L tuition, ₹50K dev
            ("State", 550000_00, 45000_00),     # ₹5.5L tuition
            ("Management", 1500000_00, 100000_00),  # ₹15L tuition
        ]
        for j, (quota, tuition, dev) in enumerate(fee_configs):
            fs_id = uuid.UUID(f"70000001-{j+1:04d}-4000-8000-000000000001")
            await session.execute(text("""
                INSERT INTO fee_structures (id, college_id, academic_year, quota,
                    tuition_fee, development_fee, hostel_fee_boys, hostel_fee_girls,
                    mess_fee, examination_fee, library_fee, laboratory_fee,
                    caution_deposit, insurance_premium, is_active,
                    installment_config, late_fee_per_day, grace_period_days,
                    created_at, updated_at)
                VALUES (:id, :college_id, '2025-26', :quota,
                    :tuition, :dev, 120000_00, 130000_00,
                    48000_00, 15000_00, 5000_00, 8000_00,
                    25000_00, 3000_00, true,
                    :installments::jsonb, 100_00, 15,
                    NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET tuition_fee = EXCLUDED.tuition_fee
            """), {
                "id": str(fs_id),
                "college_id": str(COLLEGE_ID),
                "quota": quota,
                "tuition": tuition,
                "dev": dev,
                "installments": '[{"installment_no": 1, "due_date": "2025-08-15", "percentage": 60}, {"installment_no": 2, "due_date": "2026-01-15", "percentage": 40}]',
            })

        # -------------------------------------------------------------------
        # 7. Scholarship Schemes (5 national schemes — NOT tenant-scoped)
        # -------------------------------------------------------------------
        schemes = [
            ("Post Matric Scholarship for SC Students", "Central Government", "PMS-SC",
             '["SC"]', 250000_00, 60000_00, "NSP", True),
            ("Post Matric Scholarship for OBC Students", "Central Government", "PMS-OBC",
             '["OBC"]', 100000_00, 25000_00, "NSP", True),
            ("Merit-cum-Means Scholarship for Minorities", "Central Government", "MCM-MIN",
             '["Minority"]', 250000_00, 30000_00, "NSP", True),
            ("Top Class Education for SC Students", "Central Government", "TCE-SC",
             '["SC"]', None, None, "NSP", True),
            ("PM-YASASVI Central OBC/EBC/DNT", "Central Government", "PM-YASASVI",
             '["OBC", "EWS"]', 250000_00, 75000_00, "NSP", True),
        ]
        for k, (name, body, code, cats, income, amount, portal, active) in enumerate(schemes):
            sch_id = uuid.UUID(f"80000001-{k+1:04d}-4000-8000-000000000001")
            await session.execute(text("""
                INSERT INTO scholarship_schemes (id, name, awarding_body, scheme_code,
                    eligible_categories, income_ceiling, amount_per_year,
                    application_portal, renewal_required, is_active, academic_year,
                    created_at)
                VALUES (:id, :name, :body, :code,
                    :cats::jsonb, :income, :amount,
                    :portal, :renewal, :active, '2025-26',
                    NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": str(sch_id),
                "name": name,
                "body": body,
                "code": code,
                "cats": cats,
                "income": income,
                "amount": amount,
                "portal": portal,
                "renewal": True,
                "active": active,
            })

        # -------------------------------------------------------------------
        # 8. Leave Policies
        # -------------------------------------------------------------------
        leave_types = [
            ("teaching_faculty", "casual_leave", 12, 0, False, False),
            ("teaching_faculty", "earned_leave", 30, 300, True, False),
            ("teaching_faculty", "medical_leave", 20, 0, False, True),
            ("teaching_faculty", "duty_leave", None, 0, False, True),
            ("teaching_faculty", "maternity_leave", 180, 0, False, True),
            ("teaching_faculty", "study_leave", 730, 0, False, True),
        ]
        for m, (staff, ltype, entitlement, max_acc, carry, doc) in enumerate(leave_types):
            lp_id = uuid.UUID(f"90000001-{m+1:04d}-4000-8000-000000000001")
            await session.execute(text("""
                INSERT INTO leave_policies (id, college_id, staff_category, leave_type,
                    annual_entitlement, max_accumulation, can_carry_forward,
                    requires_document, is_active, created_at, updated_at)
                VALUES (:id, :college_id, :staff, :ltype,
                    :entitlement, :max_acc, :carry,
                    :doc, true, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET annual_entitlement = EXCLUDED.annual_entitlement
            """), {
                "id": str(lp_id),
                "college_id": str(COLLEGE_ID),
                "staff": staff,
                "ltype": ltype,
                "entitlement": entitlement,
                "max_acc": max_acc,
                "carry": carry,
                "doc": doc,
            })

        # -------------------------------------------------------------------
        # 9. Salary Structures (7th CPC levels 10-14)
        # -------------------------------------------------------------------
        salary_levels = [
            ("Assistant Professor", "7cpc", 10, 5690000, 12540000),
            ("Associate Professor", "7cpc", 13, 12310000, 15950000),
            ("Professor", "7cpc", 14, 14420000, 21800000),
            ("Tutor", "private", None, 3500000, 5000000),
            ("Senior Resident", "private", None, 5000000, 8000000),
        ]
        for n, (designation, scale, level, band_min, band_max) in enumerate(salary_levels):
            ss_id = uuid.UUID(f"a1000001-{n+1:04d}-4000-8000-000000000001")
            await session.execute(text("""
                INSERT INTO salary_structures (id, college_id, designation, pay_scale_type,
                    pay_level, pay_band_min, pay_band_max, basic_pay,
                    da_percentage, hra_percentage, npa_percentage,
                    transport_allowance, is_active, created_at, updated_at)
                VALUES (:id, :college_id, :designation, :scale,
                    :level, :band_min, :band_max, :basic,
                    55.0, 24.0, 20.0,
                    360000, true, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET designation = EXCLUDED.designation
            """), {
                "id": str(ss_id),
                "college_id": str(COLLEGE_ID),
                "designation": designation,
                "scale": scale,
                "level": level,
                "band_min": band_min,
                "band_max": band_max,
                "basic": band_min,  # Start of band
            })

        # -------------------------------------------------------------------
        # 10. Workflow Definitions
        # -------------------------------------------------------------------
        workflows = [
            ("Leave Approval", "leave_request",
             '[{"step": 1, "role": "HOD", "auto_escalate_days": 3}, {"step": 2, "role": "Dean", "auto_escalate_days": 5}]'),
            ("Certificate Request", "certificate_request",
             '[{"step": 1, "role": "Admin", "auto_escalate_days": 2}]'),
            ("Purchase Order", "purchase_order",
             '[{"step": 1, "role": "HOD", "auto_escalate_days": 3}, {"step": 2, "role": "Admin", "auto_escalate_days": 3}, {"step": 3, "role": "Dean", "auto_escalate_days": 5}]'),
        ]
        for p, (wf_name, wf_type, chain) in enumerate(workflows):
            wf_id = uuid.UUID(f"b1000001-{p+1:04d}-4000-8000-000000000001")
            await session.execute(text("""
                INSERT INTO workflow_definitions (id, college_id, name, workflow_type,
                    approval_chain, is_active, created_at, updated_at)
                VALUES (:id, :college_id, :name, :wtype,
                    :chain::jsonb, true, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": str(wf_id),
                "college_id": str(COLLEGE_ID),
                "name": wf_name,
                "wtype": wf_type,
                "chain": chain,
            })

        # -------------------------------------------------------------------
        # 11. Hostel Blocks & Rooms
        # -------------------------------------------------------------------
        blocks = [
            ("Boys Hostel 1", "ug_boys", 50, 100, 4),
            ("Girls Hostel 1", "ug_girls", 40, 80, 4),
        ]
        for q, (bname, btype, rooms, beds, floors) in enumerate(blocks):
            block_id = uuid.UUID(f"c1000001-{q+1:04d}-4000-8000-000000000001")
            await session.execute(text("""
                INSERT INTO hostel_blocks (id, college_id, name, block_type,
                    total_rooms, total_beds, floors, is_active,
                    has_cctv, is_anti_ragging_compliant,
                    created_at, updated_at)
                VALUES (:id, :college_id, :name, :btype,
                    :rooms, :beds, :floors, true,
                    true, true,
                    NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": str(block_id),
                "college_id": str(COLLEGE_ID),
                "name": bname,
                "btype": btype,
                "rooms": rooms,
                "beds": beds,
                "floors": floors,
            })

            # Create 10 sample rooms per block
            for r in range(1, 11):
                room_id = uuid.UUID(f"c2{q:02d}{r:04d}-0001-4000-8000-000000000001")
                await session.execute(text("""
                    INSERT INTO hostel_rooms (id, college_id, block_id,
                        room_number, floor, capacity, current_occupancy,
                        room_type, status, created_at, updated_at)
                    VALUES (:id, :college_id, :block_id,
                        :room_no, :floor, 2, 0,
                        'regular', 'available', NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET room_number = EXCLUDED.room_number
                """), {
                    "id": str(room_id),
                    "college_id": str(COLLEGE_ID),
                    "block_id": str(block_id),
                    "room_no": f"{q+1}{r:02d}",
                    "floor": (r - 1) // 3 + 1,
                })

        await session.commit()
        print("Admin engine seed data created successfully!")
        print(f"  College: {COLLEGE_ID}")
        print(f"  Departments: {len(NMC_DEPARTMENTS)}")
        print(f"  Faculty: {len(FACULTY_DATA)}")
        print(f"  Students: 20")
        print(f"  Fee structures: {len(fee_configs)}")
        print(f"  Scholarship schemes: {len(schemes)}")


if __name__ == "__main__":
    asyncio.run(seed())
