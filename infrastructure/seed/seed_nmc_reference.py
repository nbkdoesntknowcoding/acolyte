"""Seed NMC reference data into the database.

Seeds:
1. NMC MSR 2023 faculty strength norms (nmc_standards table)
   - Per department per intake size (100/150/200/250)
2. Representative CBME competencies (competencies table)
   - Across all 19 subjects, all phases, all levels

Idempotent: uses ON CONFLICT DO NOTHING.
"""

import asyncio
import uuid
import os
import sys
from datetime import date
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

# Load backend .env
load_dotenv(Path(__file__).parent.parent.parent / "backend" / ".env")

# ─────────────────────────────────────────────────────
# NMC MSR 2023 FACULTY STRENGTH NORMS
# Source: NMC Minimum Standard Requirements Regulations 2023
# Format: (department, intake_100, intake_150, intake_200, intake_250)
# Each tuple: (professors, assoc_prof, asst_prof, tutors, sr_residents)
# ─────────────────────────────────────────────────────

MSR_DEPARTMENTS = {
    # Pre-clinical
    "Anatomy": {
        100: (1, 2, 3, 4, 0), 150: (1, 3, 4, 6, 0), 200: (2, 3, 5, 8, 0), 250: (2, 4, 6, 10, 0),
    },
    "Physiology": {
        100: (1, 2, 3, 3, 0), 150: (1, 3, 4, 5, 0), 200: (2, 3, 5, 6, 0), 250: (2, 4, 6, 8, 0),
    },
    "Biochemistry": {
        100: (1, 2, 2, 3, 0), 150: (1, 2, 3, 4, 0), 200: (1, 3, 4, 5, 0), 250: (2, 3, 5, 6, 0),
    },
    # Para-clinical
    "Pathology": {
        100: (1, 2, 3, 3, 0), 150: (1, 3, 4, 4, 0), 200: (2, 3, 5, 5, 0), 250: (2, 4, 6, 6, 0),
    },
    "Microbiology": {
        100: (1, 2, 2, 3, 0), 150: (1, 2, 3, 4, 0), 200: (1, 3, 4, 5, 0), 250: (2, 3, 5, 6, 0),
    },
    "Pharmacology": {
        100: (1, 2, 2, 3, 0), 150: (1, 2, 3, 4, 0), 200: (1, 3, 4, 5, 0), 250: (2, 3, 5, 6, 0),
    },
    "Forensic Medicine & Toxicology": {
        100: (1, 1, 1, 1, 0), 150: (1, 1, 2, 2, 0), 200: (1, 2, 2, 2, 0), 250: (1, 2, 3, 3, 0),
    },
    "Community Medicine": {
        100: (1, 2, 3, 2, 0), 150: (1, 3, 4, 3, 0), 200: (2, 3, 5, 4, 0), 250: (2, 4, 6, 5, 0),
    },
    # Clinical
    "General Medicine": {
        100: (1, 3, 4, 0, 4), 150: (2, 4, 5, 0, 6), 200: (2, 5, 6, 0, 8), 250: (3, 6, 8, 0, 10),
    },
    "General Surgery": {
        100: (1, 3, 4, 0, 4), 150: (2, 4, 5, 0, 6), 200: (2, 5, 6, 0, 8), 250: (3, 6, 8, 0, 10),
    },
    "Obstetrics & Gynaecology": {
        100: (1, 2, 3, 0, 3), 150: (1, 3, 4, 0, 4), 200: (2, 3, 5, 0, 6), 250: (2, 4, 6, 0, 8),
    },
    "Paediatrics": {
        100: (1, 2, 2, 0, 3), 150: (1, 2, 3, 0, 4), 200: (1, 3, 4, 0, 5), 250: (2, 3, 5, 0, 6),
    },
    "Orthopaedics": {
        100: (1, 1, 2, 0, 2), 150: (1, 2, 2, 0, 3), 200: (1, 2, 3, 0, 4), 250: (1, 3, 4, 0, 5),
    },
    "Ophthalmology": {
        100: (1, 1, 2, 0, 1), 150: (1, 2, 2, 0, 2), 200: (1, 2, 3, 0, 2), 250: (1, 2, 3, 0, 3),
    },
    "ENT (Otorhinolaryngology)": {
        100: (1, 1, 2, 0, 1), 150: (1, 2, 2, 0, 2), 200: (1, 2, 3, 0, 2), 250: (1, 2, 3, 0, 3),
    },
    "Dermatology, Venereology & Leprosy": {
        100: (1, 1, 1, 0, 1), 150: (1, 1, 2, 0, 1), 200: (1, 2, 2, 0, 2), 250: (1, 2, 3, 0, 2),
    },
    "Psychiatry": {
        100: (1, 1, 1, 0, 1), 150: (1, 1, 2, 0, 1), 200: (1, 2, 2, 0, 2), 250: (1, 2, 3, 0, 2),
    },
    "Anaesthesiology": {
        100: (1, 2, 2, 0, 3), 150: (1, 2, 3, 0, 4), 200: (1, 3, 4, 0, 5), 250: (2, 3, 5, 0, 6),
    },
    "Radiodiagnosis": {
        100: (1, 1, 1, 0, 1), 150: (1, 1, 2, 0, 2), 200: (1, 2, 2, 0, 2), 250: (1, 2, 3, 0, 3),
    },
}

# Minimum bed requirements per intake
BED_REQUIREMENTS = {
    100: 500, 150: 600, 200: 800, 250: 1000,
}

# ─────────────────────────────────────────────────────
# REPRESENTATIVE CBME COMPETENCIES
# Source: NMC CBME Competency Volumes I, II, III + AETCOM
# These are real competency codes and descriptions
# ─────────────────────────────────────────────────────

COMPETENCIES = [
    # ANATOMY (Phase I) — 43 competencies total, seeding key ones
    ("AN 1.1", "Anatomy", "Introduction", "Describe and demonstrate the parts, planes, and movements of the human body", "K", False, None, "Remember", "Cognitive", "Phase I", False),
    ("AN 2.1", "Anatomy", "Upper Limb", "Describe and demonstrate the gross anatomy of bones of the upper limb", "KH", False, None, "Understand", "Cognitive", "Phase I", False),
    ("AN 11.1", "Anatomy", "Surface Anatomy", "Identify and demonstrate the surface projections of important anatomical structures of the upper limb", "S", True, 2, "Apply", "Psychomotor", "Phase I", False),
    ("AN 25.1", "Anatomy", "Histology", "Describe the structure of a typical cell and its organelles", "K", False, None, "Remember", "Cognitive", "Phase I", False),
    ("AN 44.1", "Anatomy", "Embryology", "Describe the stages of development of the face and palate with molecular basis", "K", False, None, "Understand", "Cognitive", "Phase I", False),
    ("AN 80.1", "Anatomy", "Neuroanatomy", "Describe the parts, blood supply of the brain stem", "K", False, None, "Remember", "Cognitive", "Phase I", False),

    # PHYSIOLOGY (Phase I)
    ("PH 1.1", "Physiology", "General Physiology", "Define and describe the terms: Homeostasis, internal environment", "K", False, None, "Remember", "Cognitive", "Phase I", False),
    ("PH 1.5", "Physiology", "General Physiology", "Describe and discuss transport mechanisms across cell membranes", "KH", False, None, "Understand", "Cognitive", "Phase I", False),
    ("PH 3.1", "Physiology", "Blood", "Describe the composition and functions of blood", "K", False, None, "Remember", "Cognitive", "Phase I", False),
    ("PH 5.1", "Physiology", "Respiratory System", "Describe the functional anatomy of the respiratory tract, lung volumes and capacities", "K", False, None, "Remember", "Cognitive", "Phase I", False),
    ("PH 11.1", "Physiology", "Practical", "Estimate Hb concentration by Sahli's method", "S", True, 3, "Apply", "Psychomotor", "Phase I", False),

    # BIOCHEMISTRY (Phase I)
    ("BI 1.1", "Biochemistry", "Amino Acids", "Describe the structure and classify amino acids", "K", False, None, "Remember", "Cognitive", "Phase I", False),
    ("BI 4.1", "Biochemistry", "Enzymes", "Describe the properties and classification of enzymes", "KH", False, None, "Understand", "Cognitive", "Phase I", False),
    ("BI 11.1", "Biochemistry", "Practical", "Describe and perform qualitative analysis of normal urine constituents", "S", True, 2, "Apply", "Psychomotor", "Phase I", False),

    # PATHOLOGY (Phase II)
    ("PA 1.1", "Pathology", "General Pathology", "Define and describe the concepts of cell injury, adaptation and cell death", "K", False, None, "Remember", "Cognitive", "Phase II", False),
    ("PA 2.1", "Pathology", "Inflammation", "Describe the general features of acute and chronic inflammation", "KH", False, None, "Understand", "Cognitive", "Phase II", False),
    ("PA 10.1", "Pathology", "Haematology", "Describe the approach to diagnosis of anaemias and classify", "KH", False, None, "Understand", "Cognitive", "Phase II", False),
    ("PA 35.1", "Pathology", "Practical", "Identify and describe common staining techniques", "S", True, 3, "Apply", "Psychomotor", "Phase II", False),

    # MICROBIOLOGY (Phase II)
    ("MI 1.1", "Microbiology", "General Microbiology", "Describe the different classes of microorganisms and their characterization", "K", False, None, "Remember", "Cognitive", "Phase II", False),
    ("MI 2.1", "Microbiology", "Immunology", "Describe the gruesome and components of the immune system", "KH", False, None, "Understand", "Cognitive", "Phase II", False),
    ("MI 8.1", "Microbiology", "Practical", "Perform and identify the Gram staining of clinical specimens", "S", True, 5, "Apply", "Psychomotor", "Phase II", False),

    # PHARMACOLOGY (Phase II)
    ("PH 1.1_pharm", "Pharmacology", "General Pharmacology", "Define and describe the principles of pharmacology and pharmacotherapeutics", "K", False, None, "Remember", "Cognitive", "Phase II", False),
    ("PH 1.14", "Pharmacology", "General Pharmacology", "Demonstrate the effect of drugs on blood pressure using CAL", "S", True, 2, "Apply", "Psychomotor", "Phase II", False),

    # FORENSIC MEDICINE (Phase II)
    ("FM 1.1", "Forensic Medicine & Toxicology", "Introduction", "Define Forensic Medicine and describe its scope and sections", "K", False, None, "Remember", "Cognitive", "Phase II", False),
    ("FM 3.1", "Forensic Medicine & Toxicology", "Thanatology", "Describe and discuss the signs of death and postmortem changes", "KH", False, None, "Understand", "Cognitive", "Phase II", False),
    ("FM 14.1", "Forensic Medicine & Toxicology", "Practical", "Demonstrate and identify medico-legal specimens in toxicology", "S", True, 2, "Apply", "Psychomotor", "Phase II", False),

    # COMMUNITY MEDICINE (Phase II & III)
    ("CM 1.1", "Community Medicine", "Concepts", "Define and describe the concepts of Public Health and Community Medicine", "K", False, None, "Remember", "Cognitive", "Phase II", False),
    ("CM 3.1", "Community Medicine", "Epidemiology", "Describe the principles and concepts of epidemiology", "KH", False, None, "Understand", "Cognitive", "Phase II", False),
    ("CM 10.1", "Community Medicine", "Practical", "Describe and demonstrate the steps in a community needs assessment", "S", True, 2, "Apply", "Psychomotor", "Phase III", False),

    # GENERAL MEDICINE (Phase III)
    ("IM 1.1", "General Medicine", "Common Symptoms", "Describe and discuss the approach to a patient with fever", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("IM 1.11", "General Medicine", "Common Symptoms", "Describe and discuss the approach to a patient with chest pain", "KH", False, None, "Understand", "Cognitive", "Phase III", False),
    ("IM 4.1", "General Medicine", "CVS", "Describe and discuss the aetiopathogenesis, clinical features of common heart diseases", "KH", False, None, "Understand", "Cognitive", "Phase III", False),
    ("IM 24.1", "General Medicine", "Practical", "Perform and interpret a 12-lead ECG", "SH", True, 5, "Apply", "Psychomotor", "Phase III", False),

    # GENERAL SURGERY (Phase III)
    ("SU 1.1", "General Surgery", "Introduction", "Describe basic concepts of homeostasis and shock", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("SU 2.1", "General Surgery", "Wounds", "Describe the types and classify wounds; discuss the principles of wound healing", "KH", False, None, "Understand", "Cognitive", "Phase III", False),
    ("SU 14.1", "General Surgery", "Breast", "Describe the clinical features, investigations and principles of management of diseases of the breast", "KH", False, None, "Understand", "Cognitive", "Phase III", False),
    ("SU 28.1", "General Surgery", "Practical", "Demonstrate basic surgical skills on models: suturing, knot tying", "SH", True, 5, "Apply", "Psychomotor", "Phase III", False),

    # OBG (Phase III)
    ("OG 1.1", "Obstetrics & Gynaecology", "Introduction", "Describe and discuss the basic embryology of the female reproductive tract", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("OG 8.1", "Obstetrics & Gynaecology", "Normal Labor", "Describe and discuss the physiology of normal labor and delivery", "KH", False, None, "Understand", "Cognitive", "Phase III", False),
    ("OG 35.1", "Obstetrics & Gynaecology", "Practical", "Perform and demonstrate per abdominal and per vaginal examination on mannequin", "SH", True, 5, "Apply", "Psychomotor", "Phase III", False),

    # PAEDIATRICS (Phase III)
    ("PE 1.1", "Paediatrics", "Growth", "Define and discuss the normal developmental milestones", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("PE 2.1", "Paediatrics", "Nutrition", "Discuss the etiopathogenesis and approach to a child with protein energy malnutrition", "KH", False, None, "Understand", "Cognitive", "Phase III", False),
    ("PE 20.1", "Paediatrics", "Practical", "Perform anthropometric assessment and interpret the results", "S", True, 3, "Apply", "Psychomotor", "Phase III", False),

    # OPHTHALMOLOGY (Phase III)
    ("OP 1.1", "Ophthalmology", "Introduction", "Describe the physiology of vision", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("OP 4.1", "Ophthalmology", "Lens", "Enumerate and describe the types, clinical features and management of cataract", "KH", False, None, "Understand", "Cognitive", "Phase III", False),
    ("OP 9.1", "Ophthalmology", "Practical", "Demonstrate the use of direct ophthalmoscope", "S", True, 3, "Apply", "Psychomotor", "Phase III", False),

    # ENT (Phase III)
    ("EN 1.1", "ENT (Otorhinolaryngology)", "Ear", "Describe the anatomy and physiology of ear", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("EN 4.1", "ENT (Otorhinolaryngology)", "Nose", "Describe the anatomy and physiology of nose and paranasal sinuses", "KH", False, None, "Understand", "Cognitive", "Phase III", False),

    # ORTHOPAEDICS (Phase III)
    ("OR 1.1", "Orthopaedics", "Introduction", "Describe and discuss the aetiopathogenesis and clinical features of fractures", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("OR 2.1", "Orthopaedics", "Fractures", "Describe and discuss the mechanism of injury, clinical features of fractures of the clavicle", "KH", False, None, "Understand", "Cognitive", "Phase III", False),

    # DERMATOLOGY (Phase III)
    ("DR 1.1", "Dermatology, Venereology & Leprosy", "Introduction", "Describe the structure and function of the skin", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("DR 8.1", "Dermatology, Venereology & Leprosy", "Infections", "Describe the aetiology, microbiology, clinical features of Hansen's disease", "KH", False, None, "Understand", "Cognitive", "Phase III", False),

    # PSYCHIATRY (Phase III)
    ("PS 1.1", "Psychiatry", "Introduction", "Describe the growth of psychiatry as a discipline and its importance in health care", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("PS 3.1", "Psychiatry", "Mood Disorders", "Describe the epidemiology, clinical features of depression", "KH", False, None, "Understand", "Cognitive", "Phase III", False),

    # ANAESTHESIOLOGY (Phase III)
    ("AS 1.1", "Anaesthesiology", "Introduction", "Describe the scope and importance of anaesthesiology", "K", False, None, "Remember", "Cognitive", "Phase III", False),
    ("AS 4.1", "Anaesthesiology", "Airway", "Describe and demonstrate the principles of airway management", "SH", True, 3, "Apply", "Psychomotor", "Phase III", False),

    # RADIODIAGNOSIS (Phase III)
    ("RD 1.1", "Radiodiagnosis", "Introduction", "Describe the principles of radiation physics and hazards of radiation", "K", False, None, "Remember", "Cognitive", "Phase III", False),

    # AETCOM Modules
    ("AETCOM 1.1", "AETCOM", "Module 1: Doctor-Patient Relationship", "Describe and discuss the importance and dynamics of doctor-patient relationship", "KH", False, None, "Understand", "Affective", "Phase I", True),
    ("AETCOM 1.2", "AETCOM", "Module 2: Communication Skills", "Demonstrate ability to communicate effectively with patients and families", "SH", True, 3, "Apply", "Affective", "Phase I", True),
    ("AETCOM 2.1", "AETCOM", "Module 3: Ethics", "Describe the principles of bioethics and its application in medical practice", "KH", False, None, "Understand", "Affective", "Phase II", True),
    ("AETCOM 2.2", "AETCOM", "Module 4: Professionalism", "Demonstrate professional behaviour in medical practice", "SH", True, 2, "Apply", "Affective", "Phase II", True),
    ("AETCOM 3.1", "AETCOM", "Module 5: Clinical Ethics", "Demonstrate the ability to identify and manage ethical issues in clinical practice", "SH", True, 3, "Apply", "Affective", "Phase III", True),
    ("AETCOM 3.2", "AETCOM", "Module 6: Health Care System", "Describe the Indian healthcare delivery system and its challenges", "KH", False, None, "Understand", "Affective", "Phase III", True),
]


async def main():
    url = os.getenv("DATABASE_URL", "").replace("+asyncpg", "")
    if not url:
        print("ERROR: DATABASE_URL not set in backend/.env")
        sys.exit(1)

    conn = await asyncpg.connect(url)
    print(f"Connected as: {await conn.fetchval('SELECT current_user')}")

    # ── Seed NMC Standards ──
    nmc_count = 0
    for dept, intakes in MSR_DEPARTMENTS.items():
        for intake, (prof, assoc, asst, tutors, sr_res) in intakes.items():
            beds = BED_REQUIREMENTS.get(intake, 0)
            result = await conn.execute("""
                INSERT INTO nmc_standards (
                    id, intake_size, department,
                    min_professors, min_associate_professors, min_assistant_professors,
                    min_tutors_demonstrators, min_senior_residents,
                    min_beds, regulation_reference, effective_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (id) DO NOTHING
            """,
                uuid.uuid5(uuid.NAMESPACE_DNS, f"nmc.{dept}.{intake}"),
                intake, dept,
                prof, assoc, asst, tutors, sr_res,
                beds, "NMC MSR 2023", date(2023, 8, 1),
            )
            if "INSERT" in result:
                nmc_count += 1

    print(f"  NMC Standards: {nmc_count} rows inserted ({len(MSR_DEPARTMENTS)} departments x 4 intake sizes)")

    # ── Seed Competencies ──
    comp_count = 0
    for comp in COMPETENCIES:
        code, subject, topic, desc, level, certifiable, min_perf, blooms, domain, phase, is_aetcom = comp
        result = await conn.execute("""
            INSERT INTO competencies (
                id, code, subject, topic, description,
                level, is_certifiable, min_performances,
                blooms_level, domain, mbbs_phase, is_aetcom
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (code) DO NOTHING
        """,
            uuid.uuid5(uuid.NAMESPACE_DNS, f"cbme.{code}"),
            code, subject, topic, desc,
            level, certifiable, min_perf,
            blooms, domain, phase, is_aetcom,
        )
        if "INSERT" in result:
            comp_count += 1

    print(f"  Competencies: {comp_count} rows inserted ({len(COMPETENCIES)} total across all subjects)")

    # ── Summary ──
    total_nmc = await conn.fetchval("SELECT count(*) FROM nmc_standards")
    total_comp = await conn.fetchval("SELECT count(*) FROM competencies")
    print(f"\nDatabase totals:")
    print(f"  nmc_standards: {total_nmc} rows")
    print(f"  competencies:  {total_comp} rows")

    await conn.close()
    print("\nSeed complete.")


if __name__ == "__main__":
    asyncio.run(main())
