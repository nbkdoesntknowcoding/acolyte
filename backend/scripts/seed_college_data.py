"""Comprehensive seed: SIMSRC demo college (~4500 records).

Usage:
    cd backend && python -m scripts.seed_college_data
    cd backend && python -m scripts.seed_college_data --reset
"""

import asyncio
import json
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text

from app.core.database import async_session_factory

# ── Deterministic IDs ──
NS = uuid.UUID("ac01e7e0-5eed-4000-8000-51a5ec000001")
COLLEGE_ID = uuid.UUID("a0000001-0004-4000-8000-000000000004")
TODAY = date.today()
NOW = datetime.now(timezone.utc)
random.seed(42)


def uid(prefix: str, index: int) -> str:
    return str(uuid.uuid5(NS, f"{prefix}-{index}"))


# ── Department config: (name, code, nmc_type, beds, opd, labs, lh) ──
DEPTS = [
    ("Anatomy", "ANAT", "preclinical", 0, 0, 3, 2),
    ("Physiology", "PHYS", "preclinical", 0, 0, 2, 2),
    ("Biochemistry", "BCHM", "preclinical", 0, 0, 2, 1),
    ("Pathology", "PATH", "paraclinical", 0, 0, 3, 1),
    ("Microbiology", "MCBIO", "paraclinical", 0, 0, 2, 1),
    ("Pharmacology", "PHARM", "paraclinical", 0, 0, 2, 1),
    ("Forensic Medicine & Toxicology", "FMT", "paraclinical", 0, 0, 1, 1),
    ("Community Medicine", "CMED", "paraclinical", 0, 1, 1, 1),
    ("General Medicine", "MED", "clinical", 120, 4, 1, 2),
    ("General Surgery", "SURG", "clinical", 100, 3, 1, 2),
    ("Obstetrics & Gynaecology", "OBGY", "clinical", 80, 3, 1, 1),
    ("Paediatrics", "PED", "clinical", 60, 2, 1, 1),
    ("Orthopaedics", "ORTH", "clinical", 40, 2, 0, 1),
    ("Ophthalmology", "OPTH", "clinical", 30, 2, 0, 1),
    ("ENT", "ENT", "clinical", 30, 2, 0, 1),
    ("Dermatology, Venereology & Leprosy", "DERM", "clinical", 20, 2, 0, 1),
    ("Psychiatry", "PSYCH", "clinical", 30, 2, 0, 1),
    ("Anaesthesiology", "ANAES", "clinical", 0, 0, 0, 1),
    ("Radiodiagnosis", "RAD", "clinical", 0, 0, 0, 1),
]
DEPT_IDS = {d[1]: uid("dept", i) for i, d in enumerate(DEPTS)}

# Faculty distribution per dept: (prof, assoc, asst, tutor, sr)
DEPT_FACULTY = {
    "ANAT": (1, 2, 2, 5, 0), "PHYS": (1, 2, 2, 4, 0), "BCHM": (1, 1, 2, 4, 0),
    "PATH": (1, 2, 2, 4, 0), "MCBIO": (1, 1, 2, 3, 0), "PHARM": (1, 1, 1, 3, 0),
    "FMT": (1, 1, 1, 2, 0), "CMED": (1, 2, 2, 3, 0),
    "MED": (3, 4, 3, 3, 6), "SURG": (2, 3, 2, 2, 5), "OBGY": (2, 2, 2, 2, 4),
    "PED": (1, 2, 1, 2, 3), "ORTH": (1, 1, 1, 2, 3), "OPTH": (1, 1, 1, 2, 2),
    "ENT": (1, 1, 1, 2, 2), "DERM": (1, 1, 1, 2, 2), "PSYCH": (1, 1, 1, 2, 2),
    "ANAES": (1, 2, 1, 2, 3), "RAD": (0, 1, 1, 2, 0),
}

BATCH_IDS = {y: uid("batch", y) for y in [2022, 2023, 2024, 2025]}
BATCH_PHASES = {2022: ("CRMI", 9), 2023: ("Phase III", 7), 2024: ("Phase II", 5), 2025: ("Phase I", 1)}

# ── Name pools ──
MALE = [
    "Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Reyansh", "Krishna", "Ansh",
    "Vihaan", "Kabir", "Rohan", "Sahil", "Dev", "Dhruv", "Ishaan", "Kunal",
    "Manav", "Nikhil", "Pranav", "Rahul", "Shaurya", "Tanay", "Utkarsh", "Varun",
    "Yash", "Arnav", "Devansh", "Harsh", "Kartik", "Nakul", "Om", "Parth",
    "Rudra", "Shreyas", "Tejas", "Atharv", "Gaurav", "Hemant", "Jayant", "Kiran",
]
FEMALE = [
    "Aanya", "Saanvi", "Ananya", "Diya", "Kavya", "Meera", "Priya", "Riya",
    "Sara", "Tanvi", "Shreya", "Nisha", "Pooja", "Isha", "Aditi", "Neha",
    "Swati", "Divya", "Kriti", "Mahi", "Radhika", "Sakshi", "Trisha", "Vidya",
    "Zara", "Aisha", "Bhavya", "Charvi", "Gauri", "Jiya", "Kiara", "Lavanya",
    "Mansi", "Navya", "Oviya", "Pari", "Ritika", "Simran", "Tara", "Uma",
]
SURNAMES = [
    "Kumar", "Sharma", "Gowda", "Reddy", "Shetty", "Hegde", "Pai", "Nair",
    "Menon", "Rao", "Patil", "Kulkarni", "Desai", "Joshi", "Bhat", "Acharya",
    "Kamath", "Patel", "Singh", "Gupta", "Das", "Iyer", "Naik", "Shenoy",
    "Murthy", "Prasad", "Swamy", "Babu", "Deshpande", "Kini", "Prabhu", "Verma",
    "Mishra", "Tiwari", "Dubey", "Pandey", "Mehta", "Shah", "Thakur", "Chauhan",
    "Bangera", "Devadiga", "Poojary", "Suvarna", "Fernandes", "Srinivas",
    "Chandra", "Marathe", "Saxena", "Iyengar",
]
FAC_FIRST_M = [
    "Rajesh", "Suresh", "Mohan", "Ganesh", "Ramesh", "Mahesh", "Venkatesh",
    "Prakash", "Arun", "Ravi", "Deepak", "Sanjay", "Vinod", "Ashok", "Anand",
    "Kishore", "Narayan", "Srinivas", "Girish", "Harish", "Pradeep", "Raghav",
    "Vijay", "Manoj", "Naveen", "Sachin", "Dinesh", "Jagdish", "Shashank", "Keshav",
]
FAC_FIRST_F = [
    "Sunita", "Meera", "Priya", "Kavitha", "Deepa", "Lakshmi", "Anita", "Padma",
    "Vani", "Suma", "Rekha", "Shobha", "Savita", "Pushpa", "Jaya", "Usha",
    "Asha", "Hema", "Geetha", "Radha", "Sarala", "Nandini", "Bhavani", "Chitra",
    "Swapna", "Vidya", "Mamata", "Sujata", "Aruna", "Veena",
]
FAC_SURNAMES = [
    "Venkatesh", "Subramanian", "Krishnamurthy", "Ramachandra", "Manjunath",
    "Basavanna", "Chandrashekar", "Narasimha", "Vishwanath", "Jagadish",
    "Srinivasan", "Gopalakrishna", "Hegde", "Bhat", "Shetty", "Rao",
    "Kulkarni", "Desai", "Patel", "Reddy", "Nair", "Iyer", "Kamath", "Pai",
    "Murthy", "Prasad", "Acharya", "Joshi", "Patil", "Naik",
]

# Degree per designation
DESIG_QUALS = {
    "Professor": ("MD", "MS"), "Associate Professor": ("MD", "MS"),
    "Assistant Professor": ("MD", "MS"), "Tutor": ("MBBS",), "Senior Resident": ("MD", "MS"),
}
DEPT_SPEC_MAP = {
    "ANAT": "Anatomy", "PHYS": "Physiology", "BCHM": "Biochemistry",
    "PATH": "Pathology", "MCBIO": "Microbiology", "PHARM": "Pharmacology",
    "FMT": "Forensic Medicine", "CMED": "Community Medicine",
    "MED": "General Medicine", "SURG": "General Surgery",
    "OBGY": "Obstetrics & Gynaecology", "PED": "Paediatrics",
    "ORTH": "Orthopaedics", "OPTH": "Ophthalmology", "ENT": "ENT",
    "DERM": "Dermatology", "PSYCH": "Psychiatry",
    "ANAES": "Anaesthesiology", "RAD": "Radiodiagnosis",
}

UNIVERSITIES = [
    "RGUHS Bangalore", "AIIMS New Delhi", "JIPMER Puducherry",
    "Mysore University", "Bangalore University", "Manipal University",
    "Kasturba Medical College Mangalore", "MAHE Manipal",
]

# 100 real medical textbooks
BOOKS = [
    ("Gray's Anatomy", "Susan Standring", "Elsevier", "ANAT"),
    ("Cunningham's Manual of Practical Anatomy", "G.J. Romanes", "Oxford", "ANAT"),
    ("B.D. Chaurasia's Human Anatomy", "B.D. Chaurasia", "CBS", "ANAT"),
    ("Inderbir Singh's Textbook of Human Histology", "Inderbir Singh", "Jaypee", "ANAT"),
    ("Difiore's Atlas of Histology", "Victor Eroschenko", "Lippincott", "ANAT"),
    ("Guyton & Hall Textbook of Medical Physiology", "John E. Hall", "Elsevier", "PHYS"),
    ("Ganong's Review of Medical Physiology", "Kim Barrett", "McGraw-Hill", "PHYS"),
    ("Sembulingam Essentials of Medical Physiology", "K. Sembulingam", "Jaypee", "PHYS"),
    ("Indu Khurana Textbook of Physiology", "Indu Khurana", "Elsevier", "PHYS"),
    ("Harper's Illustrated Biochemistry", "Victor W. Rodwell", "McGraw-Hill", "BCHM"),
    ("Lehninger Principles of Biochemistry", "David Nelson", "W.H. Freeman", "BCHM"),
    ("Satyanarayana Biochemistry", "U. Satyanarayana", "Elsevier", "BCHM"),
    ("Vasudevan Textbook of Biochemistry", "D.M. Vasudevan", "Jaypee", "BCHM"),
    ("Robbins Pathologic Basis of Disease", "Vinay Kumar", "Elsevier", "PATH"),
    ("Harsh Mohan Textbook of Pathology", "Harsh Mohan", "Jaypee", "PATH"),
    ("Wheater's Functional Histopathology", "Geraldine O'Dowd", "Elsevier", "PATH"),
    ("Ramadas Nayak Essentials of Clinical Pathology", "R. Nayak", "Jaypee", "PATH"),
    ("Ananthanarayanan Microbiology", "R. Ananthanarayan", "Universities Press", "MCBIO"),
    ("Jawetz Medical Microbiology", "Karen Carroll", "McGraw-Hill", "MCBIO"),
    ("Baveja Textbook of Microbiology", "C.P. Baveja", "Arya", "MCBIO"),
    ("KD Tripathi Essentials of Medical Pharmacology", "K.D. Tripathi", "Jaypee", "PHARM"),
    ("Goodman & Gilman's Pharmacological Basis", "Laurence Brunton", "McGraw-Hill", "PHARM"),
    ("Lippincott Illustrated Reviews Pharmacology", "Karen Whalen", "Wolters Kluwer", "PHARM"),
    ("Krishan Vij Textbook of Forensic Medicine", "Krishan Vij", "Elsevier", "FMT"),
    ("Reddy's Essentials of Forensic Medicine", "K.S.N. Reddy", "Jaypee", "FMT"),
    ("Nageshkumar Rao Textbook of Forensic Medicine", "N.G. Rao", "Jaypee", "FMT"),
    ("Park's Textbook of Preventive & Social Medicine", "K. Park", "Bhanot", "CMED"),
    ("Mahajan & Gupta Textbook of Community Medicine", "B.K. Mahajan", "Jaypee", "CMED"),
    ("Harrison's Principles of Internal Medicine", "J. Larry Jameson", "McGraw-Hill", "MED"),
    ("Davidson's Principles and Practice of Medicine", "Stuart Ralston", "Elsevier", "MED"),
    ("API Textbook of Medicine", "Yash Pal Munjal", "JAPI", "MED"),
    ("Golwalla's Medicine for Students", "Aspi Golwalla", "National", "MED"),
    ("Alagappan Manual of Practical Medicine", "R. Alagappan", "Jaypee", "MED"),
    ("Bailey & Love's Short Practice of Surgery", "Norman Williams", "CRC Press", "SURG"),
    ("SRB's Manual of Surgery", "Sriram Bhat M", "Jaypee", "SURG"),
    ("Sabiston Textbook of Surgery", "Courtney Townsend", "Elsevier", "SURG"),
    ("Das A Concise Textbook of Surgery", "S. Das", "Old Majeed", "SURG"),
    ("Schwartz's Principles of Surgery", "F. Charles Brunicardi", "McGraw-Hill", "SURG"),
    ("DC Dutta's Textbook of Obstetrics", "Hiralal Konar", "New Central", "OBGY"),
    ("Shaw's Textbook of Gynaecology", "V.G. Padubidri", "Elsevier", "OBGY"),
    ("Williams Obstetrics", "F. Gary Cunningham", "McGraw-Hill", "OBGY"),
    ("Sheila Balakrishnan Textbook of Obstetrics", "S. Balakrishnan", "Paras", "OBGY"),
    ("Nelson Textbook of Pediatrics", "Robert Kliegman", "Elsevier", "PED"),
    ("OP Ghai Essential Pediatrics", "O.P. Ghai", "CBS", "PED"),
    ("IAP Textbook of Pediatrics", "Pallab Chatterjee", "Jaypee", "PED"),
    ("Apley's System of Orthopaedics", "Louis Solomon", "CRC Press", "ORTH"),
    ("Maheshwari Essential Orthopaedics", "J. Maheshwari", "Mehta", "ORTH"),
    ("Parsons' Diseases of the Eye", "Ramanjit Sihota", "Elsevier", "OPTH"),
    ("Kanski's Clinical Ophthalmology", "Brad Bowling", "Elsevier", "OPTH"),
    ("AK Khurana Ophthalmology", "A.K. Khurana", "New Age", "OPTH"),
    ("Dhingra Diseases of Ear, Nose and Throat", "P.L. Dhingra", "Elsevier", "ENT"),
    ("KJ Lee's Essential Otolaryngology", "K.J. Lee", "McGraw-Hill", "ENT"),
    ("IADVL Textbook of Dermatology", "R.G. Valia", "Bhalani", "DERM"),
    ("Roxburgh's Common Skin Diseases", "T.P. Habif", "CRC Press", "DERM"),
    ("Ahuja Niraj Short Textbook of Psychiatry", "Niraj Ahuja", "Jaypee", "PSYCH"),
    ("Kaplan & Sadock's Comprehensive Textbook", "Benjamin Sadock", "Wolters Kluwer", "PSYCH"),
    ("Lee's Synopsis of Anaesthesia", "J.P. Loughman", "Elsevier", "ANAES"),
    ("Ajay Yadav SRB Anaesthesiology", "Ajay Yadav", "Jaypee", "ANAES"),
    ("Sutton's Textbook of Radiology", "David Sutton", "Elsevier", "RAD"),
    ("Joshi Diagnostic Radiology", "A.R. Joshi", "Bhalani", "RAD"),
]

JOURNALS = [
    ("Indian Journal of Medical Research", "ICMR", "0971-5916", "national"),
    ("Journal of Postgraduate Medicine", "JPGM", "0022-3859", "national"),
    ("Indian Pediatrics", "Indian Academy of Pediatrics", "0019-6061", "national"),
    ("Indian Journal of Surgery", "ASI", "0972-2068", "national"),
    ("The Lancet", "Elsevier", "0140-6736", "international"),
    ("New England Journal of Medicine", "NEJM Group", "0028-4793", "international"),
    ("BMJ", "BMJ Publishing", "0959-8138", "international"),
    ("JAMA", "AMA", "0098-7484", "international"),
    ("Nature Medicine", "Springer Nature", "1078-8956", "international"),
    ("Annals of Internal Medicine", "ACP", "0003-4819", "international"),
    ("Journal of Clinical Investigation", "ASCI", "0021-9738", "international"),
    ("Indian Journal of Ophthalmology", "AIOS", "0301-4738", "national"),
    ("Indian Journal of Pathology & Microbiology", "IJPM", "0377-4929", "national"),
    ("Indian Journal of Pharmacology", "IPS", "0253-7613", "national"),
    ("Journal of Forensic & Legal Medicine", "Elsevier", "1752-928X", "international"),
    ("Indian Journal of Community Medicine", "IAPSM", "0970-0218", "national"),
    ("Journal of Obstetrics and Gynaecology", "FOGSI", "0971-9202", "national"),
    ("Indian Journal of Anaesthesia", "ISA", "0019-5049", "national"),
    ("Indian Journal of Orthopaedics", "IOA", "0019-5413", "national"),
    ("Indian Journal of Dermatology", "IADVL", "0019-5154", "national"),
    ("Journal of Indian Medical Association", "IMA", "0019-5847", "national"),
    ("Indian Heart Journal", "CSI", "0019-4832", "national"),
    ("Indian Journal of Psychiatry", "IPS", "0019-5545", "national"),
    ("Indian Journal of Radiology & Imaging", "IRIA", "0971-3026", "national"),
    ("Neurology India", "NSI", "0028-3886", "national"),
    ("Journal of Evolution of Medical and Dental Sciences", "JEMDS", "2278-4748", "national"),
    ("Journal of Medical Education", "JHPE", "2382-5723", "international"),
    ("Medical Teacher", "Taylor & Francis", "0142-159X", "international"),
    ("Academic Medicine", "AAMC", "1040-2446", "international"),
    ("BMC Medical Education", "Springer", "1472-6920", "international"),
]

QUOTA_DIST = [("AIQ", 23), ("State", 67), ("Management", 45), ("NRI", 15)]
CATEGORIES = ["General"] * 35 + ["OBC"] * 30 + ["SC"] * 15 + ["ST"] * 8 + ["EWS"] * 12
RELIGIONS = ["Hindu"] * 60 + ["Muslim"] * 15 + ["Christian"] * 15 + ["Jain"] * 5 + ["Sikh"] * 3 + ["Buddhist"] * 2
BLOOD_GROUPS = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"]
STATES_INDIA = ["Karnataka", "Kerala", "Tamil Nadu", "Andhra Pradesh", "Telangana",
                "Maharashtra", "Rajasthan", "Uttar Pradesh", "Bihar", "Delhi"]


# ============================================================================
# Main seed function
# ============================================================================

async def seed():
    counts = {}
    async with async_session_factory() as session:
        await session.execute(text("SET app.is_superadmin = 'true'"))
        await session.execute(text(f"SET app.current_college_id = '{COLLEGE_ID}'"))

        cid = str(COLLEGE_ID)

        # ── Reset if requested ──
        if "--reset" in sys.argv:
            print("Resetting SIMSRC data...")
            tables = [
                "qr_scan_logs", "qr_action_points", "audit_log", "certificates",
                "documents", "workflow_instances", "workflow_definitions",
                "academic_calendar_events", "timetable_slots", "clinical_rotations",
                "notice_read_receipts", "notices", "grievances",
                "committee_members", "committees",
                "library_issuances", "library_journals", "library_books",
                "maintenance_tickets", "equipment", "infrastructure",
                "transport_bookings", "transport_routes", "vehicles",
                "vehicle_maintenance_logs",
                "hostel_allocations", "hostel_rooms", "hostel_blocks", "mess_units",
                "leave_requests", "leave_balances", "leave_policies",
                "payroll_records", "salary_structures",
                "student_scholarships", "fee_refunds", "fee_payments", "fee_structures",
                "student_documents", "faculty_qualifications",
                "students", "faculty", "batches", "departments",
            ]
            for t in tables:
                try:
                    await session.execute(text(f"DELETE FROM {t} WHERE college_id = :c"), {"c": cid})
                except Exception:
                    pass
            try:
                await session.execute(text("DELETE FROM colleges WHERE id = :c"), {"c": cid})
            except Exception:
                pass
            await session.commit()
            print("  Reset complete.")
            # Re-set context after commit
            await session.execute(text("SET app.is_superadmin = 'true'"))
            await session.execute(text(f"SET app.current_college_id = '{cid}'"))

        # ================================================================
        # 1. COLLEGE
        # ================================================================
        print("Seeding SIMSRC...")
        await session.execute(text("""
            INSERT INTO colleges (id, name, code, nmc_registration_number, university_affiliation,
                state, district, city, address, pin_code, phone, email, website,
                established_year, college_type, sanctioned_intake, total_intake, status,
                features, config, allowed_domains)
            VALUES (:id, :name, :code, :nmc, :uni, :state, :district, :city, :addr, :pin,
                :phone, :email, :web, :year, :type, :intake, :intake, 'active',
                CAST(:features AS jsonb), CAST(:config AS jsonb), CAST(:domains AS jsonb))
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, config = EXCLUDED.config
        """), {
            "id": cid, "name": "Siddhartha Institute of Medical Sciences and Research Centre",
            "code": "SIMSRC", "nmc": "KA-PVT-2008-150",
            "uni": "Rajiv Gandhi University of Health Sciences, Karnataka",
            "state": "Karnataka", "district": "Tumkur", "city": "Tumkur",
            "addr": "NH-4, Agalakote, Tumkur - 572107, Karnataka",
            "pin": "572107", "phone": "0816-2272066", "email": "info@simsrc.edu.in",
            "web": "https://simsrc.edu.in", "year": 2008, "type": "private",
            "intake": 150,
            "features": json.dumps({"compliance_engine": True, "ai_engine": True,
                                     "student_engine": True, "faculty_engine": True,
                                     "integration_engine": True, "admin_engine": True}),
            "config": json.dumps({"academic_calendar_start": "August",
                                   "teaching_weeks_per_year": 39, "working_days_per_week": 6,
                                   "fee_regulatory_authority": "KFRC", "timezone": "Asia/Kolkata",
                                   "attendance_thresholds": {"lecture": 75, "clinical": 80}}),
            "domains": json.dumps(["simsrc.edu.in"]),
        })
        counts["college"] = 1

        # ================================================================
        # 2. DEPARTMENTS (19)
        # ================================================================
        for i, (name, code, nmc_type, beds, opd, labs, lh) in enumerate(DEPTS):
            await session.execute(text("""
                INSERT INTO departments (id, college_id, name, code, nmc_department_type,
                    department_type, beds, opd_rooms, labs, lecture_halls,
                    is_active, display_order, established_year)
                VALUES (:id, :cid, :name, :code, :nmc, :dtype, :beds, :opd, :labs, :lh,
                    true, :ord, :yr)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, beds = EXCLUDED.beds
            """), {
                "id": DEPT_IDS[code], "cid": cid, "name": name, "code": code,
                "nmc": nmc_type, "dtype": nmc_type.replace("para", "para_"),
                "beds": beds, "opd": opd, "labs": labs, "lh": lh,
                "ord": i + 1, "yr": 2008,
            })
        counts["departments"] = len(DEPTS)

        # ================================================================
        # 3. BATCHES (4)
        # ================================================================
        for year, (phase, sem) in BATCH_PHASES.items():
            await session.execute(text("""
                INSERT INTO batches (id, college_id, name, batch_type, admission_year,
                    current_phase, current_semester, student_count, is_active)
                VALUES (:id, :cid, :name, 'admission_year', :yr, :phase, :sem, 150, true)
                ON CONFLICT (id) DO UPDATE SET current_phase = EXCLUDED.current_phase
            """), {
                "id": BATCH_IDS[year], "cid": cid, "name": f"Batch {year}",
                "yr": year, "phase": phase, "sem": sem,
            })
        counts["batches"] = 4

        # ================================================================
        # 4. FACULTY (165)
        # ================================================================
        fac_idx = 0
        faculty_ids = {}  # dept_code -> list of faculty UUIDs
        all_faculty_ids = []  # flat list of all faculty UUIDs
        hod_ids = {}  # dept_code -> HOD faculty UUID

        for dept_code, (profs, assocs, assts, tutors, srs) in DEPT_FACULTY.items():
            faculty_ids[dept_code] = []
            for designation, count in [
                ("Professor", profs), ("Associate Professor", assocs),
                ("Assistant Professor", assts), ("Tutor", tutors),
                ("Senior Resident", srs),
            ]:
                for j in range(count):
                    fac_idx += 1
                    fid = uid("fac", fac_idx)
                    faculty_ids[dept_code].append(fid)
                    all_faculty_ids.append(fid)

                    # First professor is HOD
                    if designation == "Professor" and j == 0:
                        hod_ids[dept_code] = fid

                    gender = "female" if fac_idx % 3 == 0 else "male"
                    first = FAC_FIRST_F[(fac_idx - 1) % len(FAC_FIRST_F)] if gender == "female" \
                        else FAC_FIRST_M[(fac_idx - 1) % len(FAC_FIRST_M)]
                    last = FAC_SURNAMES[(fac_idx + hash(dept_code)) % len(FAC_SURNAMES)]
                    name = f"Dr. {first} {last}"

                    # Age ranges by designation
                    if designation == "Professor":
                        birth_year = random.randint(1958, 1972)
                        join_year = random.randint(1995, 2010)
                    elif designation == "Associate Professor":
                        birth_year = random.randint(1968, 1980)
                        join_year = random.randint(2005, 2015)
                    elif designation == "Assistant Professor":
                        birth_year = random.randint(1978, 1990)
                        join_year = random.randint(2012, 2020)
                    elif designation == "Tutor":
                        birth_year = random.randint(1988, 2000)
                        join_year = random.randint(2018, 2024)
                    else:  # Senior Resident
                        birth_year = random.randint(1990, 1999)
                        join_year = random.randint(2020, 2025)

                    dob = date(birth_year, random.randint(1, 12), random.randint(1, 28))
                    doj = date(join_year, random.choice([1, 7, 8]), random.randint(1, 28))
                    retire = date(dob.year + 70, dob.month, min(dob.day, 28))
                    exp = round((TODAY - doj).days / 365.25, 1)
                    qual = random.choice(DESIG_QUALS[designation])
                    spec = DEPT_SPEC_MAP[dept_code]

                    await session.execute(text("""
                        INSERT INTO faculty (id, college_id, name, email, phone, date_of_birth,
                            gender, designation, department_id, qualification, specialization,
                            date_of_joining, retirement_date, employment_type, pay_scale_type,
                            teaching_experience_years, total_experience_years, status,
                            qualification_validated, is_eligible_per_nmc,
                            publications_count, h_index, bcme_completed, employee_id)
                        VALUES (:id, :cid, :name, :email, :phone, :dob, :gender,
                            :desig, :dept, :qual, :spec, :doj, :retire,
                            :etype, :pscale, :texp, :texp, 'active',
                            true, true, :pubs, :hidx, :bcme, :empid)
                        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
                    """), {
                        "id": fid, "cid": cid, "name": name,
                        "email": f"{first.lower()}.{last.lower()}@simsrc.edu.in",
                        "phone": f"+9198{random.randint(10000000, 99999999)}",
                        "dob": dob, "gender": gender,
                        "desig": designation, "dept": DEPT_IDS[dept_code],
                        "qual": qual, "spec": spec,
                        "doj": doj, "retire": retire,
                        "etype": "permanent" if designation != "Senior Resident" else "contractual",
                        "pscale": "7cpc" if designation in ("Professor", "Associate Professor", "Assistant Professor") else "private",
                        "texp": max(exp, 0.5),
                        "pubs": random.randint(5, 80) if designation == "Professor" else random.randint(1, 20),
                        "hidx": random.randint(3, 20) if designation == "Professor" else random.randint(0, 8),
                        "bcme": designation != "Senior Resident",
                        "empid": f"SIMSRC/FAC/{fac_idx:04d}",
                    })

        counts["faculty"] = fac_idx

        # Set HODs on departments
        for dept_code, hod_fid in hod_ids.items():
            await session.execute(text("""
                UPDATE departments SET hod_id = :hod WHERE id = :did
            """), {"hod": hod_fid, "did": DEPT_IDS[dept_code]})

        # ================================================================
        # 5. FACULTY QUALIFICATIONS
        # ================================================================
        qual_idx = 0
        fac_idx2 = 0
        for dept_code, (profs, assocs, assts, tutors, srs) in DEPT_FACULTY.items():
            for designation, count in [
                ("Professor", profs), ("Associate Professor", assocs),
                ("Assistant Professor", assts), ("Tutor", tutors),
                ("Senior Resident", srs),
            ]:
                for j in range(count):
                    fac_idx2 += 1
                    fid = uid("fac", fac_idx2)
                    spec = DEPT_SPEC_MAP[dept_code]

                    # Everyone has MBBS
                    qual_idx += 1
                    await session.execute(text("""
                        INSERT INTO faculty_qualifications (id, college_id, faculty_id, degree,
                            specialization, university, year_of_passing, nmc_verified, is_highest)
                        VALUES (:id, :cid, :fid, 'MBBS', NULL, :uni, :yr, true, :highest)
                        ON CONFLICT (id) DO UPDATE SET degree = EXCLUDED.degree
                    """), {
                        "id": uid("fqual", qual_idx), "cid": cid, "fid": fid,
                        "uni": random.choice(UNIVERSITIES),
                        "yr": random.randint(1985, 2015),
                        "highest": designation == "Tutor",
                    })

                    # PG degree for non-tutors
                    if designation != "Tutor":
                        qual_idx += 1
                        pg = "MS" if dept_code in ("SURG", "OBGY", "ORTH", "OPTH", "ENT") else "MD"
                        await session.execute(text("""
                            INSERT INTO faculty_qualifications (id, college_id, faculty_id, degree,
                                specialization, university, year_of_passing, nmc_verified, is_highest)
                            VALUES (:id, :cid, :fid, :deg, :spec, :uni, :yr, true, :highest)
                            ON CONFLICT (id) DO UPDATE SET degree = EXCLUDED.degree
                        """), {
                            "id": uid("fqual", qual_idx), "cid": cid, "fid": fid,
                            "deg": pg, "spec": spec, "uni": random.choice(UNIVERSITIES),
                            "yr": random.randint(1990, 2020),
                            "highest": designation != "Professor",
                        })

                    # Superspecialty for some professors
                    if designation == "Professor" and random.random() < 0.3:
                        qual_idx += 1
                        await session.execute(text("""
                            INSERT INTO faculty_qualifications (id, college_id, faculty_id, degree,
                                specialization, university, year_of_passing, nmc_verified, is_highest)
                            VALUES (:id, :cid, :fid, :deg, :spec, :uni, :yr, true, true)
                            ON CONFLICT (id) DO UPDATE SET degree = EXCLUDED.degree
                        """), {
                            "id": uid("fqual", qual_idx), "cid": cid, "fid": fid,
                            "deg": random.choice(["DM", "MCh", "PhD"]),
                            "spec": spec, "uni": random.choice(UNIVERSITIES),
                            "yr": random.randint(2000, 2018),
                        })

        counts["faculty_qualifications"] = qual_idx

        # ================================================================
        # 6. STUDENTS (600 = 4 batches x 150)
        # ================================================================
        stu_idx = 0
        all_student_ids = []
        student_quotas = {}  # student_uid -> quota

        for batch_year in [2022, 2023, 2024, 2025]:
            phase, sem = BATCH_PHASES[batch_year]
            q_offset = 0
            for quota, qcount in QUOTA_DIST:
                for qi in range(qcount):
                    stu_idx += 1
                    sid = uid("stu", stu_idx)
                    all_student_ids.append(sid)
                    student_quotas[sid] = quota

                    gender = "female" if stu_idx % 3 == 0 else "male"
                    pool = FEMALE if gender == "female" else MALE
                    first = pool[(stu_idx * 7 + batch_year) % len(pool)]
                    last = SURNAMES[(stu_idx * 3 + qi) % len(SURNAMES)]
                    cat = CATEGORIES[(stu_idx + qi) % len(CATEGORIES)]
                    religion = RELIGIONS[(stu_idx + batch_year) % len(RELIGIONS)]

                    birth_year = batch_year - random.randint(17, 22)
                    dob = date(birth_year, random.randint(1, 12), random.randint(1, 28))
                    adm_date = date(batch_year, 8, random.randint(1, 30))

                    # NEET scores by quota
                    if quota == "AIQ":
                        neet = random.randint(580, 700)
                    elif quota == "State":
                        neet = random.randint(460, 600)
                    elif quota == "Management":
                        neet = random.randint(350, 480)
                    else:  # NRI
                        neet = random.randint(200, 400)

                    neet_pct = round(neet / 720 * 100, 1)
                    neet_rank = max(1, int(720000 - neet * 1000 + random.randint(-5000, 5000)))

                    await session.execute(text("""
                        INSERT INTO students (id, college_id, name, email, phone,
                            date_of_birth, gender, blood_group, nationality, religion, category,
                            father_name, mother_name, guardian_phone,
                            permanent_address, city, state, pin_code,
                            neet_score, neet_rank, neet_percentile, neet_year,
                            admission_quota, admission_date, admission_year,
                            enrollment_number, current_phase, current_semester,
                            batch_id, status, is_hosteler,
                            class_12_board, class_12_percentage, pcb_percentage)
                        VALUES (:id, :cid, :name, :email, :phone,
                            :dob, :gender, :bg, 'Indian', :rel, :cat,
                            :father, :mother, :gphone,
                            :addr, :city, :state, :pin,
                            :neet, :rank, :pct, :nyear,
                            :quota, :adm_date, :adm_year,
                            :enroll, :phase, :sem,
                            :bid, 'active', :hostel,
                            :board, :c12pct, :pcb)
                        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
                    """), {
                        "id": sid, "cid": cid,
                        "name": f"{first} {last}",
                        "email": f"{first.lower()}.{last.lower()}.{batch_year}@simsrc.edu.in",
                        "phone": f"+9199{random.randint(10000000, 99999999)}",
                        "dob": dob, "gender": gender,
                        "bg": random.choice(BLOOD_GROUPS),
                        "rel": religion, "cat": cat,
                        "father": f"{random.choice(MALE)} {last}",
                        "mother": f"{random.choice(FEMALE)} {last}",
                        "gphone": f"+9198{random.randint(10000000, 99999999)}",
                        "addr": f"{random.randint(1,500)}, {random.choice(['MG Road','Gandhi Nagar','JP Nagar','Jayanagar','Rajajinagar','Basavanagudi','Malleshwaram','Vijayanagar','Koramangala','HSR Layout'])}, {random.choice(['Bangalore','Mysore','Mangalore','Hubli','Tumkur','Shimoga','Belgaum','Gulbarga'])}",
                        "city": random.choice(["Bangalore", "Mysore", "Mangalore", "Hubli", "Tumkur"]),
                        "state": random.choice(STATES_INDIA[:5]),
                        "pin": f"{random.randint(560001, 590999)}",
                        "neet": neet, "rank": neet_rank, "pct": neet_pct, "nyear": batch_year,
                        "quota": quota, "adm_date": adm_date, "adm_year": batch_year,
                        "enroll": f"SIMSRC/{batch_year}/{stu_idx:04d}",
                        "phase": phase, "sem": sem, "bid": BATCH_IDS[batch_year],
                        "hostel": random.random() < 0.7,
                        "board": random.choice(["CBSE", "Karnataka PUC", "ICSE", "Maharashtra HSC", "AP Board"]),
                        "c12pct": round(random.uniform(75, 98), 1),
                        "pcb": round(random.uniform(70, 98), 1),
                    })

        counts["students"] = stu_idx

        # ================================================================
        # 7. FEE STRUCTURES (5 quotas for 2025-26)
        # ================================================================
        fee_configs = [
            ("AIQ", 600000_00, 50000_00),
            ("State", 550000_00, 45000_00),
            ("Management", 1500000_00, 100000_00),
            ("NRI", 2500000_00, 150000_00),
            ("Institutional", 1800000_00, 120000_00),
        ]
        fee_struct_ids = {}
        for fi, (quota, tuition, dev) in enumerate(fee_configs):
            fsid = uid("feestruct", fi)
            fee_struct_ids[quota] = fsid
            await session.execute(text("""
                INSERT INTO fee_structures (id, college_id, academic_year, quota,
                    tuition_fee, development_fee, hostel_fee_boys, hostel_fee_girls,
                    hostel_fee, mess_fee, examination_fee, exam_fee, library_fee,
                    laboratory_fee, lab_fee, caution_deposit, insurance_premium,
                    is_active, installment_config, late_fee_per_day, grace_period_days)
                VALUES (:id, :cid, '2025-26', :quota, :tuition, :dev,
                    12000000, 13000000, 12500000, 4800000, 1500000, 1500000,
                    500000, 800000, 800000, 2500000, 300000,
                    true, CAST(:inst AS jsonb), 10000, 15)
                ON CONFLICT (id) DO UPDATE SET tuition_fee = EXCLUDED.tuition_fee
            """), {
                "id": fsid, "cid": cid, "quota": quota,
                "tuition": tuition, "dev": dev,
                "inst": json.dumps([
                    {"installment_no": 1, "due_date": "2025-08-15", "percentage": 60},
                    {"installment_no": 2, "due_date": "2026-01-15", "percentage": 40},
                ]),
            })
        counts["fee_structures"] = len(fee_configs)

        # ================================================================
        # 8. FEE PAYMENTS (~1050)
        # ================================================================
        pay_idx = 0
        for si, sid in enumerate(all_student_ids):
            quota = student_quotas[sid]
            fsid = fee_struct_ids.get(quota, fee_struct_ids["State"])
            # Use quota to get total fee
            total_fee_map = {"AIQ": 800000_00, "State": 750000_00,
                             "Management": 1900000_00, "NRI": 3000000_00,
                             "Institutional": 2200000_00}
            total = total_fee_map.get(quota, 800000_00)
            inst1 = int(total * 0.6)
            inst2 = total - inst1

            # Distribution: 70% full, 15% partial, 10% late, 5% default
            r = random.random()
            if r < 0.70:
                status_list = [("captured", 0), ("captured", 0)]
            elif r < 0.85:
                status_list = [("captured", 0)]
            elif r < 0.95:
                late_days = random.randint(15, 60)
                status_list = [("captured", late_days), ("captured", late_days)]
            else:
                status_list = []  # defaulters

            batch_year = 2022 + si // 150
            for inst_no, (st, late) in enumerate(status_list, 1):
                pay_idx += 1
                amt = inst1 if inst_no == 1 else inst2
                pay_date = date(batch_year, 8 if inst_no == 1 else 12,
                                min(15 + late + random.randint(0, 5), 28))
                method = random.choice(["upi", "neft", "rtgs", "demand_draft"])

                await session.execute(text("""
                    INSERT INTO fee_payments (id, college_id, student_id, fee_structure_id,
                        academic_year, installment_number, amount, payment_method,
                        payment_date, receipt_number, status,
                        late_fee_amount, late_fee_days, fee_component)
                    VALUES (:id, :cid, :sid, :fsid, :yr, :inst, :amt, :method,
                        :pdate, :rcpt, :status, :late_amt, :late_days, 'tuition')
                    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
                """), {
                    "id": uid("feepay", pay_idx), "cid": cid, "sid": sid, "fsid": fsid,
                    "yr": f"{batch_year}-{(batch_year+1) % 100:02d}",
                    "inst": inst_no, "amt": amt, "method": method,
                    "pdate": pay_date,
                    "rcpt": f"SIMSRC/R/{batch_year}/{pay_idx:05d}",
                    "status": st, "late_amt": late * 10000 if late else 0, "late_days": late,
                })

        counts["fee_payments"] = pay_idx

        # ================================================================
        # 9. SCHOLARSHIP SCHEMES (5, non-tenant — upsert with ON CONFLICT)
        # ================================================================
        schemes = [
            ("Post Matric Scholarship for SC", "Central Govt", "PMS-SC", '["SC"]', 250000_00, 60000_00),
            ("Post Matric Scholarship for OBC", "Central Govt", "PMS-OBC", '["OBC"]', 100000_00, 25000_00),
            ("Merit-cum-Means for Minorities", "Central Govt", "MCM-MIN", '["Minority"]', 250000_00, 30000_00),
            ("Top Class Education for SC", "Central Govt", "TCE-SC", '["SC"]', None, None),
            ("PM-YASASVI for OBC/EWS", "Central Govt", "PM-YASASVI", '["OBC","EWS"]', 250000_00, 75000_00),
        ]
        scheme_ids = []
        for si, (name, body, code, cats, income, amount) in enumerate(schemes):
            schid = uid("scheme", si)
            scheme_ids.append(schid)
            await session.execute(text("""
                INSERT INTO scholarship_schemes (id, name, awarding_body, scheme_code,
                    eligible_categories, income_ceiling, amount_per_year,
                    application_portal, renewal_required, is_active, academic_year)
                VALUES (:id, :name, :body, :code, CAST(:cats AS jsonb), :income, :amount,
                    'NSP', true, true, '2025-26')
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": schid, "name": name, "body": body, "code": code,
                "cats": cats, "income": income, "amount": amount,
            })
        counts["scholarship_schemes"] = len(schemes)

        # ================================================================
        # 10. STUDENT SCHOLARSHIPS (~90)
        # ================================================================
        schol_idx = 0
        for sid in all_student_ids[:90]:
            schol_idx += 1
            schid = random.choice(scheme_ids)
            statuses = ["matched", "applied", "l1_verified", "approved", "disbursed"]
            st = random.choice(statuses)
            await session.execute(text("""
                INSERT INTO student_scholarships (id, college_id, student_id, scheme_id,
                    academic_year, application_status, sanctioned_amount, disbursed_amount)
                VALUES (:id, :cid, :sid, :schid, '2025-26', :st, :sanc, :disb)
                ON CONFLICT (id) DO UPDATE SET application_status = EXCLUDED.application_status
            """), {
                "id": uid("stuschol", schol_idx), "cid": cid, "sid": sid, "schid": schid,
                "st": st,
                "sanc": random.randint(20000_00, 80000_00) if st in ("approved", "disbursed") else None,
                "disb": random.randint(20000_00, 80000_00) if st == "disbursed" else 0,
            })
        counts["student_scholarships"] = schol_idx

        # ================================================================
        # 11. SALARY STRUCTURES (6)
        # ================================================================
        salary_configs = [
            ("Professor", "7cpc", 14, 14420000, 21800000),
            ("Associate Professor", "7cpc", 13, 12310000, 15950000),
            ("Assistant Professor", "7cpc", 10, 5690000, 12540000),
            ("Tutor", "private", None, 3500000, 5000000),
            ("Senior Resident", "private", None, 5000000, 8000000),
            ("Demonstrator", "private", None, 3000000, 4500000),
        ]
        for si, (desig, scale, level, bmin, bmax) in enumerate(salary_configs):
            await session.execute(text("""
                INSERT INTO salary_structures (id, college_id, designation, pay_scale_type,
                    pay_level, pay_band_min, pay_band_max, basic_pay,
                    da_percentage, hra_percentage, npa_percentage, transport_allowance, is_active)
                VALUES (:id, :cid, :desig, :scale, :level, :bmin, :bmax, :basic,
                    55.0, 24.0, 20.0, 360000, true)
                ON CONFLICT (id) DO UPDATE SET designation = EXCLUDED.designation
            """), {
                "id": uid("salstruct", si), "cid": cid, "desig": desig,
                "scale": scale, "level": level, "bmin": bmin, "bmax": bmax,
                "basic": bmin,
            })
        counts["salary_structures"] = len(salary_configs)

        # ================================================================
        # 12. PAYROLL RECORDS (4 months x 165 faculty)
        # ================================================================
        pr_idx = 0
        for month_offset in range(4):  # Oct 2025 - Jan 2026
            m = 10 + month_offset
            y = 2025 if m <= 12 else 2026
            m = m if m <= 12 else m - 12
            for fid in all_faculty_ids:
                pr_idx += 1
                basic = random.randint(4000000, 15000000)  # paisa
                da = int(basic * 0.55)
                hra = int(basic * 0.24)
                npa = int(basic * 0.20)
                ta = 360000
                gross = basic + da + hra + npa + ta
                epf_ee = int(basic * 0.12)
                tds = int(gross * 0.10)
                pt = 200000  # Rs 2000
                total_ded = epf_ee + tds + pt
                net = gross - total_ded

                await session.execute(text("""
                    INSERT INTO payroll_records (id, college_id, faculty_id, month, year,
                        basic_pay, dearness_allowance, house_rent_allowance,
                        non_practicing_allowance, transport_allowance,
                        gross_earnings, epf_employee, tds, professional_tax,
                        total_deductions, net_pay, status)
                    VALUES (:id, :cid, :fid, :m, :y, :basic, :da, :hra, :npa, :ta,
                        :gross, :epf, :tds, :pt, :tded, :net, 'disbursed')
                    ON CONFLICT (id) DO UPDATE SET net_pay = EXCLUDED.net_pay
                """), {
                    "id": uid("payroll", pr_idx), "cid": cid, "fid": fid,
                    "m": m, "y": y, "basic": basic, "da": da, "hra": hra,
                    "npa": npa, "ta": ta, "gross": gross, "epf": epf_ee,
                    "tds": tds, "pt": pt, "tded": total_ded, "net": net,
                })
        counts["payroll_records"] = pr_idx

        # ================================================================
        # 13. LEAVE POLICIES (5)
        # ================================================================
        leave_types = [
            ("teaching_faculty", "casual_leave", 12, 0, False, False),
            ("teaching_faculty", "earned_leave", 30, 300, True, False),
            ("teaching_faculty", "medical_leave", 20, 0, False, True),
            ("teaching_faculty", "duty_leave", None, 0, False, True),
            ("teaching_faculty", "maternity_leave", 180, 0, False, True),
        ]
        for li, (staff, ltype, ent, maxacc, carry, doc) in enumerate(leave_types):
            await session.execute(text("""
                INSERT INTO leave_policies (id, college_id, staff_category, leave_type,
                    annual_entitlement, max_accumulation, can_carry_forward,
                    requires_document, is_active)
                VALUES (:id, :cid, :staff, :ltype, :ent, :maxacc, :carry, :doc, true)
                ON CONFLICT (id) DO UPDATE SET annual_entitlement = EXCLUDED.annual_entitlement
            """), {
                "id": uid("leavepol", li), "cid": cid, "staff": staff,
                "ltype": ltype, "ent": ent, "maxacc": maxacc, "carry": carry, "doc": doc,
            })
        counts["leave_policies"] = len(leave_types)

        # ================================================================
        # 14. LEAVE BALANCES (~825 = 165 faculty x 5 types)
        # ================================================================
        lb_idx = 0
        for fid in all_faculty_ids:
            for li, (_, ltype, ent, _, _, _) in enumerate(leave_types):
                lb_idx += 1
                taken = random.randint(0, min(ent or 10, 8))
                await session.execute(text("""
                    INSERT INTO leave_balances (id, college_id, employee_id, employee_type,
                        leave_type, academic_year, entitled, taken, balance)
                    VALUES (:id, :cid, :eid, 'faculty', :lt, '2025-26', :ent, :taken, :bal)
                    ON CONFLICT (id) DO UPDATE SET taken = EXCLUDED.taken
                """), {
                    "id": uid("leavebal", lb_idx), "cid": cid, "eid": fid,
                    "lt": ltype, "ent": ent or 0, "taken": taken,
                    "bal": (ent or 0) - taken,
                })
        counts["leave_balances"] = lb_idx

        # ================================================================
        # 15. LEAVE REQUESTS (25)
        # ================================================================
        leave_statuses = ["pending"] * 5 + ["approved"] * 12 + ["rejected"] * 3 + ["cancelled"] * 5
        for lr_i in range(25):
            fid = random.choice(all_faculty_ids)
            lt = random.choice(["casual_leave", "earned_leave", "medical_leave", "duty_leave"])
            days = random.randint(1, 5) if lt == "casual_leave" else random.randint(2, 10)
            from_d = TODAY - timedelta(days=random.randint(0, 60))
            to_d = from_d + timedelta(days=days - 1)
            await session.execute(text("""
                INSERT INTO leave_requests (id, college_id, employee_id, employee_type,
                    leave_type, from_date, to_date, days, reason, status)
                VALUES (:id, :cid, :eid, 'faculty', :lt, :fd, :td, :days, :reason, :st)
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
            """), {
                "id": uid("leavereq", lr_i), "cid": cid, "eid": fid,
                "lt": lt, "fd": from_d, "td": to_d,
                "days": days,
                "reason": random.choice([
                    "Personal work", "Family function", "Medical appointment",
                    "Conference attendance", "Research seminar", "Workshop at RGUHS",
                    "Family emergency", "NMC inspection duty at another college",
                ]),
                "st": leave_statuses[lr_i % len(leave_statuses)],
            })
        counts["leave_requests"] = 25

        # ================================================================
        # 16-18. HOSTEL (4 blocks, ~265 rooms, ~420 allocations)
        # ================================================================
        hostel_blocks = [
            ("Boys Hostel A", "ug_boys", 80, 160, 4),
            ("Boys Hostel B", "ug_boys", 60, 120, 3),
            ("Girls Hostel A", "ug_girls", 80, 160, 4),
            ("Girls Hostel B", "ug_girls", 45, 90, 3),
        ]
        block_ids = []
        all_room_ids = []
        room_idx = 0

        for bi, (bname, btype, rooms, beds, floors) in enumerate(hostel_blocks):
            blk_id = uid("hostelblk", bi)
            block_ids.append(blk_id)
            # Assign warden from faculty
            warden = all_faculty_ids[bi * 10] if len(all_faculty_ids) > bi * 10 else None
            await session.execute(text("""
                INSERT INTO hostel_blocks (id, college_id, name, block_type, total_rooms,
                    total_beds, floors, warden_faculty_id, has_cctv,
                    is_anti_ragging_compliant, is_active)
                VALUES (:id, :cid, :name, :btype, :rooms, :beds, :floors, :warden,
                    true, true, true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": blk_id, "cid": cid, "name": bname, "btype": btype,
                "rooms": rooms, "beds": beds, "floors": floors, "warden": warden,
            })

            for ri in range(rooms):
                room_idx += 1
                rid = uid("hostelroom", room_idx)
                all_room_ids.append(rid)
                floor_num = ri // (rooms // floors) + 1
                await session.execute(text("""
                    INSERT INTO hostel_rooms (id, college_id, block_id, room_number,
                        floor, capacity, current_occupancy, room_type, status)
                    VALUES (:id, :cid, :blk, :rno, :floor, 2, 0, 'regular', 'available')
                    ON CONFLICT (id) DO UPDATE SET room_number = EXCLUDED.room_number
                """), {
                    "id": rid, "cid": cid, "blk": blk_id,
                    "rno": f"{bi+1}{floor_num}{(ri % 20) + 1:02d}",
                    "floor": floor_num,
                })

        counts["hostel_blocks"] = len(hostel_blocks)
        counts["hostel_rooms"] = room_idx

        # Hostel allocations (~420 = 70% of 600)
        alloc_idx = 0
        hosteler_students = [sid for sid in all_student_ids if random.random() < 0.70]
        for hi, sid in enumerate(hosteler_students[:len(all_room_ids) * 2]):
            alloc_idx += 1
            rid = all_room_ids[hi % len(all_room_ids)]
            blk = block_ids[hi % len(block_ids)]
            batch_year = 2022 + (hi // 150) % 4
            await session.execute(text("""
                INSERT INTO hostel_allocations (id, college_id, student_id, room_id,
                    block_id, academic_year, check_in_date, status)
                VALUES (:id, :cid, :sid, :rid, :blk, :yr, :cin, 'active')
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
            """), {
                "id": uid("hostalloc", alloc_idx), "cid": cid, "sid": sid,
                "rid": rid, "blk": blk, "yr": f"{batch_year}-{(batch_year+1)%100:02d}",
                "cin": date(batch_year, 8, random.randint(1, 15)),
            })
        counts["hostel_allocations"] = alloc_idx

        # ================================================================
        # 19. MESS UNITS (2)
        # ================================================================
        for mi, (mname, mtype, cap, vendor) in enumerate([
            ("Main Mess", "veg_nonveg", 500, "Sri Catering Services"),
            ("Vegetarian Mess", "veg", 200, "Annapurna Foods"),
        ]):
            await session.execute(text("""
                INSERT INTO mess_units (id, college_id, name, mess_type, capacity,
                    vendor_name, monthly_fee, is_active)
                VALUES (:id, :cid, :name, :mtype, :cap, :vendor, 480000, true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": uid("mess", mi), "cid": cid, "name": mname,
                "mtype": mtype, "cap": cap, "vendor": vendor,
            })
        counts["mess_units"] = 2

        # ================================================================
        # 20. LIBRARY BOOKS (200)
        # ================================================================
        book_idx = 0
        # Use 60 real titles, repeat with different editions to get 200
        for edition_round in range(4):  # 4 rounds x 60 = 240, take 200
            for title, author, publisher, dept in BOOKS:
                book_idx += 1
                if book_idx > 200:
                    break
                ed = edition_round + random.randint(1, 5)
                yr = 2015 + edition_round + random.randint(0, 5)
                copies = random.randint(3, 15)
                avail = random.randint(1, copies)
                await session.execute(text("""
                    INSERT INTO library_books (id, college_id, accession_number, title,
                        author, publisher, year_of_publication, edition, subject,
                        department_id, total_copies, available_copies, status, price)
                    VALUES (:id, :cid, :acc, :title, :author, :pub, :yr, :ed, :subj,
                        :dept, :copies, :avail, 'available', :price)
                    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
                """), {
                    "id": uid("book", book_idx), "cid": cid,
                    "acc": f"SIMSRC/LIB/{book_idx:05d}",
                    "title": f"{title}" if edition_round == 0 else f"{title} ({ed}th Ed.)",
                    "author": author, "pub": publisher, "yr": yr,
                    "ed": f"{ed}th", "subj": DEPT_SPEC_MAP.get(dept, dept),
                    "dept": DEPT_IDS.get(dept), "copies": copies, "avail": avail,
                    "price": random.randint(50000, 500000),
                })
            if book_idx >= 200:
                break
        counts["library_books"] = min(book_idx, 200)

        # ================================================================
        # 21. LIBRARY JOURNALS (30)
        # ================================================================
        for ji, (jname, jpub, issn, jtype) in enumerate(JOURNALS[:30]):
            await session.execute(text("""
                INSERT INTO library_journals (id, college_id, name, publisher, issn,
                    journal_type, subscription_status, subscription_start, subscription_end,
                    annual_cost, is_online, indexed_in)
                VALUES (:id, :cid, :name, :pub, :issn, :jtype, 'active',
                    '2025-01-01', '2025-12-31', :cost, :online, CAST(:indexed AS jsonb))
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": uid("journal", ji), "cid": cid, "name": jname,
                "pub": jpub, "issn": issn, "jtype": jtype,
                "cost": random.randint(200000, 5000000),
                "online": jtype == "international",
                "indexed": json.dumps(["PubMed", "Scopus"] if jtype == "international" else ["IndMed"]),
            })
        counts["library_journals"] = 30

        # ================================================================
        # 22. LIBRARY ISSUANCES (50)
        # ================================================================
        for ii in range(50):
            book_id = uid("book", random.randint(1, 200))
            borrower = random.choice(all_student_ids[:200])
            issued = TODAY - timedelta(days=random.randint(1, 30))
            due = issued + timedelta(days=14)
            returned = issued + timedelta(days=random.randint(5, 20)) if random.random() < 0.6 else None
            fine = max(0, ((returned or TODAY) - due).days) * 500 if returned and returned > due else 0
            await session.execute(text("""
                INSERT INTO library_issuances (id, college_id, book_id, borrower_id,
                    borrower_type, issued_date, due_date, returned_date, fine_amount, status)
                VALUES (:id, :cid, :bid, :bor, 'student', :issued, :due, :ret, :fine, :st)
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
            """), {
                "id": uid("libissue", ii), "cid": cid, "bid": book_id,
                "bor": borrower, "issued": issued, "due": due,
                "ret": returned if returned else None, "fine": fine,
                "st": "returned" if returned else "issued",
            })
        counts["library_issuances"] = 50

        # ================================================================
        # 23. INFRASTRUCTURE (20)
        # ================================================================
        infra_items = [
            ("Main Lecture Hall 1", "lecture_hall", "Academic Block", 0, 250, "ANAT"),
            ("Main Lecture Hall 2", "lecture_hall", "Academic Block", 0, 250, "PHYS"),
            ("Seminar Hall A", "seminar_hall", "Academic Block", 1, 100, None),
            ("Anatomy Dissection Hall", "laboratory", "Preclinical Block", 0, 80, "ANAT"),
            ("Physiology Lab", "laboratory", "Preclinical Block", 1, 60, "PHYS"),
            ("Biochemistry Lab", "laboratory", "Preclinical Block", 1, 60, "BCHM"),
            ("Pathology Lab", "laboratory", "Paraclinical Block", 0, 60, "PATH"),
            ("Microbiology Lab", "laboratory", "Paraclinical Block", 0, 60, "MCBIO"),
            ("Pharmacology Lab", "laboratory", "Paraclinical Block", 1, 40, "PHARM"),
            ("Clinical Skills Lab", "skill_lab", "Hospital Block", 1, 30, "MED"),
            ("Central Library", "library", "Admin Block", 0, 200, None),
            ("Auditorium", "auditorium", "Admin Block", 0, 800, None),
            ("Examination Hall", "exam_hall", "Academic Block", 1, 300, None),
            ("OPD Block - Medicine", "opd_room", "Hospital Block", 0, 50, "MED"),
            ("OPD Block - Surgery", "opd_room", "Hospital Block", 0, 40, "SURG"),
            ("Operation Theatre Complex", "operation_theatre", "Hospital Block", 2, 6, "SURG"),
            ("ICU", "icu", "Hospital Block", 2, 20, "MED"),
            ("Emergency Department", "emergency", "Hospital Block", 0, 30, "MED"),
            ("Anatomy Museum", "museum", "Preclinical Block", 0, 50, "ANAT"),
            ("Tutorial Room 1", "tutorial_room", "Academic Block", 1, 30, "BCHM"),
        ]
        for ii, (name, cat, bldg, floor, cap, dept) in enumerate(infra_items):
            await session.execute(text("""
                INSERT INTO infrastructure (id, college_id, name, category, building,
                    floor, capacity, department_id, has_ac, has_projector, condition, is_active)
                VALUES (:id, :cid, :name, :cat, :bldg, :floor, :cap, :dept,
                    :ac, true, 'good', true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": uid("infra", ii), "cid": cid, "name": name, "cat": cat,
                "bldg": bldg, "floor": floor, "cap": cap,
                "dept": DEPT_IDS.get(dept) if dept else None,
                "ac": cat in ("lecture_hall", "seminar_hall", "icu", "operation_theatre", "library"),
            })
        counts["infrastructure"] = len(infra_items)

        # ================================================================
        # 24. EQUIPMENT (30)
        # ================================================================
        equip_items = [
            ("Compound Microscope", "ANAT", 50000_00), ("Dissection Kit", "ANAT", 8000_00),
            ("Spirometer", "PHYS", 120000_00), ("ECG Machine", "PHYS", 250000_00),
            ("Spectrophotometer", "BCHM", 300000_00), ("Centrifuge", "BCHM", 80000_00),
            ("Histopathology Processor", "PATH", 800000_00), ("Cryostat", "PATH", 500000_00),
            ("Autoclave", "MCBIO", 150000_00), ("Laminar Air Flow", "MCBIO", 200000_00),
            ("Organ Bath", "PHARM", 180000_00), ("Plethysmograph", "PHARM", 250000_00),
            ("Ventilator", "MED", 1500000_00), ("Defibrillator", "MED", 300000_00),
            ("Cardiac Monitor", "MED", 400000_00), ("Pulse Oximeter", "MED", 25000_00),
            ("Cautery Machine", "SURG", 250000_00), ("Laparoscopic Tower", "SURG", 2500000_00),
            ("Fetal Doppler", "OBGY", 80000_00), ("CTG Machine", "OBGY", 500000_00),
            ("Infant Warmer", "PED", 150000_00), ("Phototherapy Unit", "PED", 80000_00),
            ("C-arm", "ORTH", 3000000_00), ("Bone Drill", "ORTH", 200000_00),
            ("Slit Lamp", "OPTH", 400000_00), ("Direct Ophthalmoscope", "OPTH", 50000_00),
            ("Pure Tone Audiometer", "ENT", 300000_00), ("Endoscope", "ENT", 600000_00),
            ("Anaesthesia Workstation", "ANAES", 2000000_00),
            ("X-ray Machine Digital", "RAD", 5000000_00),
        ]
        for ei, (ename, edept, cost) in enumerate(equip_items):
            pdate = date(random.randint(2018, 2024), random.randint(1, 12), random.randint(1, 28))
            await session.execute(text("""
                INSERT INTO equipment (id, college_id, name, department_id, serial_number,
                    purchase_date, purchase_cost, condition, is_nmc_required, nmc_specification_met)
                VALUES (:id, :cid, :name, :dept, :serial, :pdate, :cost, 'working', true, true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": uid("equip", ei), "cid": cid, "name": ename,
                "dept": DEPT_IDS[edept], "serial": f"SIMSRC/EQ/{ei+1:04d}",
                "pdate": pdate, "cost": cost,
            })
        counts["equipment"] = len(equip_items)

        # ================================================================
        # 25. VEHICLES (3) + 26. ROUTES (2)
        # ================================================================
        vehicles = [
            ("KA-06-AB-1234", "bus", 52, "Tata Starbus", "Raju M", "+919876543201"),
            ("KA-06-CD-5678", "bus", 40, "Ashok Leyland Viking", "Suresh K", "+919876543202"),
            ("KA-06-EF-9012", "minivan", 12, "Force Traveller", "Mohan R", "+919876543203"),
        ]
        vehicle_ids = []
        for vi, (vno, vtype, cap, make, driver, dphone) in enumerate(vehicles):
            vid = uid("vehicle", vi)
            vehicle_ids.append(vid)
            await session.execute(text("""
                INSERT INTO vehicles (id, college_id, vehicle_number, vehicle_type, capacity,
                    make_model, driver_name, driver_phone, status)
                VALUES (:id, :cid, :vno, :vtype, :cap, :make, :driver, :dphone, 'active')
                ON CONFLICT (id) DO UPDATE SET vehicle_number = EXCLUDED.vehicle_number
            """), {
                "id": vid, "cid": cid, "vno": vno, "vtype": vtype, "cap": cap,
                "make": make, "driver": driver, "dphone": dphone,
            })

        routes = [
            ("Tumkur City Route", "daily_shuttle", "SIMSRC Campus", "Tumkur Bus Stand", 8.5),
            ("Bangalore Express Route", "weekly", "SIMSRC Campus", "Majestic Bus Station, Bangalore", 75.0),
        ]
        for ri, (rname, rtype, origin, dest, dist) in enumerate(routes):
            await session.execute(text("""
                INSERT INTO transport_routes (id, college_id, name, route_type,
                    origin, destination, distance_km, vehicle_id, is_active,
                    schedule)
                VALUES (:id, :cid, :name, :rtype, :origin, :dest, :dist, :vid, true, CAST(:sched AS jsonb))
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": uid("route", ri), "cid": cid, "name": rname, "rtype": rtype,
                "origin": origin, "dest": dest, "dist": dist,
                "vid": vehicle_ids[ri] if ri < len(vehicle_ids) else None,
                "sched": json.dumps({"departure": "07:30", "return": "17:30"}) if ri == 0 else json.dumps({"departure": "06:00", "return": "20:00", "days": ["Saturday"]}),
            })
        counts["vehicles"] = len(vehicles)
        counts["transport_routes"] = len(routes)

        # ================================================================
        # 27. NOTICES (15)
        # ================================================================
        notice_data = [
            ("Phase I Foundation Course Schedule 2025-26", "academic", "urgent"),
            ("AEBAS Biometric Registration - All Faculty", "administrative", "urgent"),
            ("NMC Inspection Preparation Meeting", "administrative", "high"),
            ("Internal Assessment Schedule - Phase II", "academic", "normal"),
            ("Anti-Ragging Committee Meeting Notice", "mandatory", "high"),
            ("Library Book Return Reminder", "general", "low"),
            ("RGUHS University Exam Timetable Dec 2025", "academic", "urgent"),
            ("Annual Sports Day Registration Open", "event", "normal"),
            ("Faculty Development Programme - Jan 2026", "academic", "normal"),
            ("Hostel Mess Menu Revision", "general", "low"),
            ("Clinical Posting Schedule - Phase III", "academic", "normal"),
            ("Research Committee Meeting", "administrative", "normal"),
            ("World AIDS Day - Guest Lecture", "event", "normal"),
            ("Fee Payment Reminder - 2nd Installment", "administrative", "high"),
            ("Campus Wi-Fi Maintenance Downtime", "general", "low"),
        ]
        for ni, (title, ntype, priority) in enumerate(notice_data):
            pub_at = NOW - timedelta(days=random.randint(0, 30))
            posted_by = random.choice(all_faculty_ids[:20])
            await session.execute(text("""
                INSERT INTO notices (id, college_id, title, content, notice_type,
                    priority, target_audience, posted_by, published_at,
                    status, read_count, total_recipients)
                VALUES (:id, :cid, :title, :content, :ntype, :prio,
                    CAST(:audience AS jsonb), :posted, :pub_at,
                    'published', :reads, :total)
                ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
            """), {
                "id": uid("notice", ni), "cid": cid, "title": title,
                "content": f"This is the detailed content for: {title}. All concerned are requested to take note and act accordingly. For queries, contact the administrative office.",
                "ntype": ntype, "prio": priority,
                "audience": json.dumps(["all_faculty", "all_students"]),
                "posted": posted_by,
                "pub_at": pub_at,
                "reads": random.randint(50, 500),
                "total": random.randint(300, 765),
            })
        counts["notices"] = len(notice_data)

        # ================================================================
        # 28-29. COMMITTEES (8) + MEMBERS (~40)
        # ================================================================
        committees = [
            ("Anti-Ragging Committee", "statutory", True, "monthly"),
            ("Internal Complaints Committee", "statutory", True, "quarterly"),
            ("Institutional Ethics Committee", "statutory", True, "monthly"),
            ("Medical Education Unit", "academic", True, "monthly"),
            ("IQAC (Internal Quality Assurance Cell)", "quality", True, "quarterly"),
            ("Grievance Redressal Committee", "statutory", True, "monthly"),
            ("Library Committee", "academic", False, "quarterly"),
            ("Sports & Cultural Committee", "co_curricular", False, "monthly"),
        ]
        committee_ids = []
        for ci_idx, (cname, ctype, mandated, freq) in enumerate(committees):
            cmid = uid("committee", ci_idx)
            committee_ids.append(cmid)
            chair_fac = all_faculty_ids[ci_idx * 5] if len(all_faculty_ids) > ci_idx * 5 else all_faculty_ids[0]
            await session.execute(text("""
                INSERT INTO committees (id, college_id, name, committee_type, is_nmc_mandated,
                    chairperson_name, meeting_frequency, last_meeting_date, status)
                VALUES (:id, :cid, :name, :ctype, :mandated, :chair, :freq, :lmd, 'active')
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": cmid, "cid": cid, "name": cname, "ctype": ctype,
                "mandated": mandated, "chair": f"Dr. Faculty {ci_idx + 1}",
                "freq": freq,
                "lmd": TODAY - timedelta(days=random.randint(5, 45)),
            })

        # Committee members (~5 per committee = 40)
        mem_idx = 0
        roles = ["Chairperson", "Member Secretary", "Member", "Member", "External Member"]
        for cmid in committee_ids:
            for mi in range(5):
                mem_idx += 1
                fid = all_faculty_ids[(mem_idx * 3) % len(all_faculty_ids)]
                await session.execute(text("""
                    INSERT INTO committee_members (id, college_id, committee_id,
                        member_name, member_role, member_type, user_id, is_active)
                    VALUES (:id, :cid, :cmid, :name, :role, :mtype, :uid, true)
                    ON CONFLICT (id) DO UPDATE SET member_name = EXCLUDED.member_name
                """), {
                    "id": uid("commember", mem_idx), "cid": cid, "cmid": cmid,
                    "name": f"Dr. Faculty Member {mem_idx}",
                    "role": roles[mi % len(roles)],
                    "mtype": "external" if mi == 4 else "faculty",
                    "uid": fid if mi < 4 else None,
                })
        counts["committees"] = len(committees)
        counts["committee_members"] = mem_idx

        # ================================================================
        # 30. GRIEVANCES (12)
        # ================================================================
        grievance_data = [
            ("Hostel water supply irregular", "infrastructure", "medium", "resolved"),
            ("Lab equipment not functioning", "academic", "high", "under_review"),
            ("Mess food quality complaint", "hostel", "medium", "resolved"),
            ("Ragging incident report", "anti_ragging", "critical", "resolved"),
            ("Library access hours too short", "academic", "low", "acknowledged"),
            ("Faculty not completing syllabus", "academic", "medium", "under_review"),
            ("Exam paper leak allegation", "examination", "critical", "hearing_scheduled"),
            ("Scholarship disbursement delayed", "financial", "medium", "resolved"),
            ("Sexual harassment complaint", "icc", "critical", "under_review"),
            ("Transport bus timing issue", "infrastructure", "low", "resolved"),
            ("Wi-Fi connectivity in hostel", "infrastructure", "low", "filed"),
            ("Clinical posting scheduling conflict", "academic", "medium", "acknowledged"),
        ]
        for gi, (desc, category, priority, status) in enumerate(grievance_data):
            filed_by = random.choice(all_student_ids[:100])
            await session.execute(text("""
                INSERT INTO grievances (id, college_id, ticket_number, filed_by,
                    filed_by_name, filed_by_role, is_anonymous, category,
                    description, priority, status,
                    assigned_committee_id, timeline)
                VALUES (:id, :cid, :ticket, :filed, :fname, 'student', :anon,
                    :cat, :desc, :prio, :st, :cmid, CAST(:timeline AS jsonb))
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
            """), {
                "id": uid("grievance", gi), "cid": cid,
                "ticket": f"GRV-SIMSRC-{gi+1:03d}",
                "filed": filed_by, "fname": f"Student {gi+1}",
                "anon": category in ("anti_ragging", "icc"),
                "cat": category, "desc": desc, "prio": priority, "st": status,
                "cmid": committee_ids[5] if category != "icc" else committee_ids[1],
                "timeline": json.dumps([
                    {"action": "filed", "date": str(TODAY - timedelta(days=random.randint(5, 30)))},
                    {"action": "acknowledged", "date": str(TODAY - timedelta(days=random.randint(1, 5)))},
                ]),
            })
        counts["grievances"] = len(grievance_data)

        # ================================================================
        # 31-32. WORKFLOWS (5 defs + 10 instances)
        # ================================================================
        wf_defs = [
            ("Leave Approval", "leave_request",
             [{"step": 1, "role": "HOD", "auto_escalate_days": 3},
              {"step": 2, "role": "Dean", "auto_escalate_days": 5}]),
            ("Certificate Request", "certificate_request",
             [{"step": 1, "role": "Admin", "auto_escalate_days": 2}]),
            ("Purchase Order", "purchase_order",
             [{"step": 1, "role": "HOD"}, {"step": 2, "role": "Admin"}, {"step": 3, "role": "Dean"}]),
            ("Fee Waiver", "fee_waiver",
             [{"step": 1, "role": "Accounts"}, {"step": 2, "role": "Dean"}]),
            ("Faculty Recruitment", "recruitment",
             [{"step": 1, "role": "HOD"}, {"step": 2, "role": "Dean"}, {"step": 3, "role": "Trust"}]),
        ]
        wf_def_ids = []
        for wi, (wname, wtype, chain) in enumerate(wf_defs):
            wid = uid("wfdef", wi)
            wf_def_ids.append(wid)
            await session.execute(text("""
                INSERT INTO workflow_definitions (id, college_id, name, workflow_type,
                    approval_chain, is_active)
                VALUES (:id, :cid, :name, :wtype, CAST(:chain AS jsonb), true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": wid, "cid": cid, "name": wname, "wtype": wtype,
                "chain": json.dumps(chain),
            })

        # 10 workflow instances
        wf_titles = [
            "CL for Dr. Rajesh - 3 days", "Bonafide Certificate - Aarav Kumar",
            "Microscope purchase - Anatomy", "Fee waiver - SC student merit",
            "Associate Professor - Pathology", "EL for Dr. Sunita - 10 days",
            "Transfer Certificate - Vivaan Sharma", "Projector purchase - LH1",
            "Fee waiver - EWS student", "Professor - General Medicine",
        ]
        for ii in range(10):
            def_id = wf_def_ids[ii % len(wf_def_ids)]
            approver = random.choice(all_faculty_ids[:30])
            await session.execute(text("""
                INSERT INTO workflow_instances (id, college_id, definition_id,
                    workflow_type, requested_by, requested_by_name,
                    title, current_step, current_approver_id,
                    status, priority, due_date)
                VALUES (:id, :cid, :def_id, :wtype, :req, :reqname,
                    :title, :step, :approver, :st, :prio, :due)
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
            """), {
                "id": uid("wfinst", ii), "cid": cid, "def_id": def_id,
                "wtype": wf_defs[ii % len(wf_defs)][1],
                "req": random.choice(all_faculty_ids),
                "reqname": f"Dr. Faculty {ii+1}",
                "title": wf_titles[ii],
                "step": random.randint(1, 2),
                "approver": approver,
                "st": random.choice(["pending", "in_progress", "approved", "rejected"]),
                "prio": random.choice(["normal", "high", "urgent"]),
                "due": TODAY + timedelta(days=random.randint(1, 14)),
            })
        counts["workflow_definitions"] = len(wf_defs)
        counts["workflow_instances"] = 10

        # ================================================================
        # 33. ACADEMIC CALENDAR EVENTS (20)
        # ================================================================
        cal_events = [
            ("Foundation Course Begins", "academic", "2025-08-01", "2025-08-14", '["Phase I"]'),
            ("Phase I Classes Start", "academic", "2025-08-16", None, '["Phase I"]'),
            ("Independence Day", "holiday", "2025-08-15", None, None),
            ("Gandhi Jayanti", "holiday", "2025-10-02", None, None),
            ("Dussehra", "holiday", "2025-10-02", "2025-10-04", None),
            ("Deepavali", "holiday", "2025-10-20", "2025-10-22", None),
            ("Internal Assessment 1 - Phase I", "examination", "2025-10-15", "2025-10-20", '["Phase I"]'),
            ("Internal Assessment 1 - Phase II", "examination", "2025-10-16", "2025-10-21", '["Phase II"]'),
            ("Kannada Rajyotsava", "holiday", "2025-11-01", None, None),
            ("Christmas Break", "holiday", "2025-12-24", "2025-12-26", None),
            ("Internal Assessment 2 - Phase I", "examination", "2026-01-10", "2026-01-15", '["Phase I"]'),
            ("Republic Day", "holiday", "2026-01-26", None, None),
            ("RGUHS University Exams Phase I", "examination", "2026-02-10", "2026-02-28", '["Phase I"]'),
            ("Holi", "holiday", "2026-03-14", None, None),
            ("Annual Day", "event", "2026-03-01", None, None),
            ("Sports Day", "event", "2026-02-15", None, None),
            ("NMC Foundation Day Lecture", "event", "2025-09-25", None, None),
            ("Clinical Posting Rotation Start", "academic", "2025-08-01", None, '["Phase III","CRMI"]'),
            ("Ugadi", "holiday", "2026-03-29", None, None),
            ("Summer Vacation Begins", "holiday", "2026-04-15", "2026-05-31", None),
        ]
        for ci_cal, (title, etype, start_s, end_s, phases) in enumerate(cal_events):
            start_d = date.fromisoformat(start_s)
            end_d = date.fromisoformat(end_s) if end_s else None
            await session.execute(text("""
                INSERT INTO academic_calendar_events (id, college_id, title, event_type,
                    start_date, end_date, affects_phases, academic_year, is_teaching_day)
                VALUES (:id, :cid, :title, :etype, :start, :end, CAST(:phases AS jsonb),
                    '2025-26', :teach)
                ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
            """), {
                "id": uid("calevent", ci_cal), "cid": cid, "title": title,
                "etype": etype, "start": start_d, "end": end_d,
                "phases": phases,
                "teach": etype not in ("holiday", "event"),
            })
        counts["academic_calendar_events"] = len(cal_events)

        # ================================================================
        # 34. TIMETABLE SLOTS (36 = 6 days x 6 slots for Phase I)
        # ================================================================
        tt_subjects = [
            ("Anatomy", "ANAT", "lecture"), ("Physiology", "PHYS", "lecture"),
            ("Biochemistry", "BCHM", "lecture"), ("Anatomy Dissection", "ANAT", "practical"),
            ("Physiology Practical", "PHYS", "practical"), ("Biochemistry Practical", "BCHM", "practical"),
        ]
        times = [("08:00", "09:00"), ("09:00", "10:00"), ("10:15", "11:15"),
                 ("11:15", "12:15"), ("14:00", "15:00"), ("15:00", "16:00")]
        tt_idx = 0
        for day in range(6):  # Mon-Sat
            for slot_i, (start, end) in enumerate(times):
                tt_idx += 1
                subj, dept, stype = tt_subjects[(day + slot_i) % len(tt_subjects)]
                fid = faculty_ids.get(dept, all_faculty_ids[:3])[0] if faculty_ids.get(dept) else all_faculty_ids[0]
                await session.execute(text("""
                    INSERT INTO timetable_slots (id, college_id, academic_year, phase,
                        batch_id, day_of_week, start_time, end_time,
                        subject, department_id, faculty_id, session_type, is_active)
                    VALUES (:id, :cid, '2025-26', 'Phase I', :bid, :day, :start, :end,
                        :subj, :dept, :fid, :stype, true)
                    ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject
                """), {
                    "id": uid("ttslot", tt_idx), "cid": cid,
                    "bid": BATCH_IDS[2025], "day": day,
                    "start": start, "end": end,
                    "subj": subj, "dept": DEPT_IDS[dept], "fid": fid, "stype": stype,
                })
        counts["timetable_slots"] = tt_idx

        # ================================================================
        # 35. CLINICAL ROTATIONS (Batch 2022, 4 groups x 4 depts)
        # ================================================================
        rotation_depts = ["MED", "SURG", "OBGY", "PED"]
        batch_2022_students = all_student_ids[:150]  # first 150 = batch 2022
        group_size = 150 // 4  # ~37 per group
        rot_idx = 0
        for group_no in range(4):
            start_idx = group_no * group_size
            end_idx = min(start_idx + group_size, 150)
            for dept_offset, dept_code in enumerate(rotation_depts):
                # Each group rotates through depts sequentially
                rot_dept = rotation_depts[(group_no + dept_offset) % 4]
                # Spread rotations: Aug, Nov, Feb, May (wrapping into 2026)
                rot_month = 8 + dept_offset * 3  # 8, 11, 14, 17
                rot_year = 2025 + (rot_month - 1) // 12
                rot_month = ((rot_month - 1) % 12) + 1
                rot_start = date(rot_year, rot_month, 1)
                rot_end = rot_start + timedelta(days=89)
                supervisor = faculty_ids.get(rot_dept, [all_faculty_ids[0]])[0]

                for si in range(start_idx, end_idx):
                    rot_idx += 1
                    await session.execute(text("""
                        INSERT INTO clinical_rotations (id, college_id, student_id,
                            department_id, batch_id, rotation_group, phase,
                            start_date, end_date, required_hours,
                            completed_hours, supervisor_faculty_id, status,
                            attendance_percentage, is_crmi)
                        VALUES (:id, :cid, :sid, :dept, :bid, :grp, 'CRMI',
                            :start, :end, 240, :done, :sup, :st, :att, true)
                        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
                    """), {
                        "id": uid("rotation", rot_idx), "cid": cid,
                        "sid": batch_2022_students[si],
                        "dept": DEPT_IDS[rot_dept], "bid": BATCH_IDS[2022],
                        "grp": f"Group {group_no + 1}",
                        "start": rot_start, "end": rot_end,
                        "done": random.randint(180, 240) if dept_offset < 2 else random.randint(0, 120),
                        "sup": supervisor,
                        "st": "completed" if dept_offset < 2 else "in_progress",
                        "att": round(random.uniform(75, 98), 1),
                    })
        counts["clinical_rotations"] = rot_idx

        # ================================================================
        # 36. QR ACTION POINTS (12)
        # ================================================================
        qr_points = [
            ("Main Mess Entrance", "mess_entry", "mess_main_1", "mode_b", "Mess Block", 0),
            ("Veg Mess Entrance", "mess_entry", "mess_veg_1", "mode_b", "Mess Block", 0),
            ("Library Desk 1", "library_visit", "lib_desk_1", "mode_b", "Admin Block", 0),
            ("Library Checkout", "library_checkout", "lib_checkout_1", "mode_a", "Admin Block", 0),
            ("Anatomy Lecture Hall 1", "attendance_mark", "anat_lh_1", "mode_b", "Academic Block", 0),
            ("Physiology Lecture Hall 2", "attendance_mark", "phys_lh_2", "mode_b", "Academic Block", 0),
            ("Main Gate Entry", "hostel_checkin", "main_gate_1", "mode_a", "Campus", 0),
            ("Boys Hostel Gate", "hostel_checkin", "hostel_boys_1", "mode_a", "Boys Hostel A", 0),
            ("Girls Hostel Gate", "hostel_checkin", "hostel_girls_1", "mode_a", "Girls Hostel A", 0),
            ("OPD Block Entry", "clinical_posting", "opd_entry_1", "mode_b", "Hospital Block", 0),
            ("Exam Hall Entrance", "exam_hall_entry", "exam_hall_1", "mode_a", "Academic Block", 1),
            ("Skills Lab Entry", "clinical_posting", "skills_lab_1", "mode_b", "Hospital Block", 1),
        ]
        qr_point_ids = []
        for qi, (qname, atype, loc_code, mode, bldg, floor) in enumerate(qr_points):
            qpid = uid("qrpoint", qi)
            qr_point_ids.append(qpid)
            await session.execute(text("""
                INSERT INTO qr_action_points (id, college_id, name, action_type,
                    location_code, qr_mode, building, floor,
                    gps_latitude, gps_longitude, geo_radius_meters,
                    qr_rotation_minutes, duplicate_window_minutes,
                    security_level, active_hours_start, active_hours_end, is_active)
                VALUES (:id, :cid, :name, :atype, :loc, :mode, :bldg, :floor,
                    :lat, :lng, 100, :rot, 30, 'standard', '06:00', '22:00', true)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """), {
                "id": qpid, "cid": cid, "name": qname, "atype": atype,
                "loc": loc_code, "mode": mode, "bldg": bldg, "floor": floor,
                "lat": 13.3379 + random.uniform(-0.002, 0.002),
                "lng": 77.1173 + random.uniform(-0.002, 0.002),
                "rot": 5 if mode == "mode_b" else 0,
            })
        counts["qr_action_points"] = len(qr_points)

        # ================================================================
        # 37. QR SCAN LOGS (500, last 7 days)
        # ================================================================
        for sl_i in range(500):
            qpid = random.choice(qr_point_ids)
            qp_idx = qr_point_ids.index(qpid)
            atype = qr_points[qp_idx][1]
            mode = qr_points[qp_idx][3]
            user = random.choice(all_student_ids[:300])
            scan_time = NOW - timedelta(
                days=random.randint(0, 6),
                hours=random.randint(6, 21),
                minutes=random.randint(0, 59),
            )
            await session.execute(text("""
                INSERT INTO qr_scan_logs (id, college_id, user_id, user_type,
                    action_type, action_point_id, qr_mode,
                    scan_latitude, scan_longitude, geo_validated,
                    device_validated, validation_result, scanned_at)
                VALUES (:id, :cid, :uid, 'stu', :atype, :qpid, :mode,
                    :lat, :lng, true, true, 'success', :ts)
                ON CONFLICT (id) DO UPDATE SET scanned_at = EXCLUDED.scanned_at
            """), {
                "id": uid("scanlog", sl_i), "cid": cid, "uid": user,
                "atype": atype, "qpid": qpid, "mode": mode,
                "lat": 13.3379 + random.uniform(-0.003, 0.003),
                "lng": 77.1173 + random.uniform(-0.003, 0.003),
                "ts": scan_time,
            })
        counts["qr_scan_logs"] = 500

        # ================================================================
        # 38. CERTIFICATES (10)
        # ================================================================
        cert_types = [
            ("bonafide", "Bank loan application"), ("bonafide", "Passport application"),
            ("character", "PG admission"), ("fee_paid", "Scholarship application"),
            ("noc", "Conference attendance"), ("bonafide", "Railway concession"),
            ("transfer", "College transfer"), ("course_completion", "Internship"),
            ("bonafide", "Visa application"), ("character", "Government exam"),
        ]
        for ci_cert, (ctype, purpose) in enumerate(cert_types):
            sid = random.choice(all_student_ids[:200])
            await session.execute(text("""
                INSERT INTO certificates (id, college_id, student_id, certificate_type,
                    certificate_number, purpose, status, issued_date)
                VALUES (:id, :cid, :sid, :ctype, :cno, :purpose, 'issued', :issued)
                ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
            """), {
                "id": uid("cert", ci_cert), "cid": cid, "sid": sid,
                "ctype": ctype, "cno": f"SIMSRC/CERT/{ci_cert+1:04d}",
                "purpose": purpose,
                "issued": TODAY - timedelta(days=random.randint(1, 60)),
            })
        counts["certificates"] = len(cert_types)

        # ================================================================
        # 39. DOCUMENTS (15)
        # ================================================================
        doc_data = [
            ("NMC Recognition Letter 2024", "nmc", "recognition"),
            ("RGUHS Affiliation Certificate", "university", "affiliation"),
            ("KFRC Fee Structure Approval", "regulatory", "fee_approval"),
            ("NAAC Accreditation Certificate", "accreditation", "naac"),
            ("Fire Safety Certificate", "compliance", "safety"),
            ("Hospital Registration Certificate", "hospital", "registration"),
            ("Anti-Ragging Policy Document", "policy", "anti_ragging"),
            ("Faculty Handbook 2025-26", "academic", "handbook"),
            ("Student Handbook 2025-26", "academic", "handbook"),
            ("Annual Report 2024-25", "administrative", "annual_report"),
            ("NMC MSR Self-Assessment 2024", "nmc", "self_assessment"),
            ("AQAR 2024-25", "accreditation", "aqar"),
            ("Research Publication Policy", "policy", "research"),
            ("Exam Regulations", "academic", "examination"),
            ("Leave Policy Document", "policy", "hr"),
        ]
        for di, (dtitle, dcat, dsub) in enumerate(doc_data):
            await session.execute(text("""
                INSERT INTO documents (id, college_id, title, category, sub_category,
                    file_url, file_name, uploaded_by_name, access_level, academic_year)
                VALUES (:id, :cid, :title, :cat, :sub,
                    :url, :fname, 'Admin Office', 'admin_only', '2025-26')
                ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
            """), {
                "id": uid("doc", di), "cid": cid, "title": dtitle,
                "cat": dcat, "sub": dsub,
                "url": f"https://r2.simsrc.edu.in/docs/{dsub}_{di+1}.pdf",
                "fname": f"{dsub}_{di+1}.pdf",
            })
        counts["documents"] = len(doc_data)

        # ================================================================
        # 40. AUDIT LOG (50)
        # ================================================================
        audit_actions = [
            ("create", "student", "New student admission"), ("update", "student", "Updated phone number"),
            ("create", "faculty", "New faculty onboarded"), ("update", "faculty", "Updated designation"),
            ("create", "fee_payment", "Fee payment recorded"), ("create", "fee_payment", "Fee payment recorded"),
            ("update", "department", "Updated HOD assignment"), ("create", "notice", "Published notice"),
            ("create", "leave_request", "Leave request submitted"), ("update", "leave_request", "Leave approved"),
            ("create", "certificate", "Certificate generated"), ("create", "grievance", "Grievance filed"),
            ("update", "hostel_allocation", "Room allocated"), ("create", "workflow_instance", "Workflow started"),
            ("update", "fee_payment", "Payment status updated"),
        ]
        for ai in range(50):
            action, entity, desc = audit_actions[ai % len(audit_actions)]
            actor = random.choice(all_faculty_ids[:20])
            await session.execute(text("""
                INSERT INTO audit_log (id, college_id, user_id, action, entity_type,
                    entity_id, changes, ip_address)
                VALUES (:id, :cid, :uid, :action, :etype, :eid,
                    CAST(:changes AS jsonb), :ip)
                ON CONFLICT (id) DO UPDATE SET action = EXCLUDED.action
            """), {
                "id": uid("audit", ai), "cid": cid, "uid": actor,
                "action": action, "etype": entity,
                "eid": random.choice(all_student_ids[:50]),
                "changes": json.dumps({"description": desc}),
                "ip": f"10.0.{random.randint(1,10)}.{random.randint(1,254)}",
            })
        counts["audit_log"] = 50

        # ================================================================
        # COMMIT
        # ================================================================
        await session.commit()

        # Print summary
        print("\n" + "=" * 60)
        print("SIMSRC Seed Complete!")
        print("=" * 60)
        total = 0
        for table, count in sorted(counts.items()):
            print(f"  {table:30s} {count:>6,}")
            total += count
        print(f"  {'─' * 36}")
        print(f"  {'TOTAL':30s} {total:>6,}")
        print(f"\n  College ID: {COLLEGE_ID}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
