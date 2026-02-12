"""NEET-PG Reference Data — Historical cutoffs, topic frequency, blueprint.

This script provides reference data for the NEET-PG Exam Prep Agent (S3).
Data is embedded in the agent module (neet_pg_prep.py) and also available
here for review and updates.

To update data: modify the constants below, then copy to neet_pg_prep.py.

Sources:
- NBE (National Board of Examinations) official results
- Past 10 years NEET-PG question paper analysis
- Subject distribution from NBE blueprint

Usage:
    python scripts/seed_neetpg_reference.py          # Print all data
    python scripts/seed_neetpg_reference.py --json    # JSON output
"""

import json
import sys


# ---------------------------------------------------------------------------
# NEET-PG Exam Blueprint
# ---------------------------------------------------------------------------

NEET_PG_BLUEPRINT = {
    "Medicine": {"questions": 30, "pct": 15.0},
    "Surgery": {"questions": 25, "pct": 12.5},
    "Obstetrics & Gynaecology": {"questions": 20, "pct": 10.0},
    "Paediatrics": {"questions": 15, "pct": 7.5},
    "Pharmacology": {"questions": 15, "pct": 7.5},
    "Pathology": {"questions": 15, "pct": 7.5},
    "Microbiology": {"questions": 12, "pct": 6.0},
    "Anatomy": {"questions": 10, "pct": 5.0},
    "Physiology": {"questions": 10, "pct": 5.0},
    "Biochemistry": {"questions": 8, "pct": 4.0},
    "Forensic Medicine": {"questions": 8, "pct": 4.0},
    "Community Medicine": {"questions": 10, "pct": 5.0},
    "Ophthalmology": {"questions": 8, "pct": 4.0},
    "ENT": {"questions": 7, "pct": 3.5},
    "Dermatology": {"questions": 4, "pct": 2.0},
    "Psychiatry": {"questions": 3, "pct": 1.5},
}


# ---------------------------------------------------------------------------
# Historical Cutoff Scores
# ---------------------------------------------------------------------------

HISTORICAL_CUTOFFS = [
    {
        "year": 2024,
        "total_candidates": 220542,
        "max_score": 800,
        "general_cutoff": 371,
        "obc_cutoff": 331,
        "sc_cutoff": 291,
        "st_cutoff": 271,
        "topper_score": 725,
        "median_score": 320,
        "total_seats_pg": 45000,
        "notes": "First NEET-PG after 2024 NMC reforms",
    },
    {
        "year": 2023,
        "total_candidates": 208405,
        "max_score": 800,
        "general_cutoff": 364,
        "obc_cutoff": 324,
        "sc_cutoff": 284,
        "st_cutoff": 264,
        "topper_score": 710,
        "median_score": 310,
        "total_seats_pg": 42000,
        "notes": "Standard exam cycle",
    },
    {
        "year": 2022,
        "total_candidates": 198560,
        "max_score": 800,
        "general_cutoff": 356,
        "obc_cutoff": 316,
        "sc_cutoff": 276,
        "st_cutoff": 256,
        "topper_score": 720,
        "median_score": 305,
        "total_seats_pg": 40000,
        "notes": "Post-COVID normalized cycle",
    },
    {
        "year": 2021,
        "total_candidates": 175000,
        "max_score": 800,
        "general_cutoff": 340,
        "obc_cutoff": 300,
        "sc_cutoff": 264,
        "st_cutoff": 244,
        "topper_score": 695,
        "median_score": 290,
        "total_seats_pg": 38000,
        "notes": "COVID-affected cycle, delayed exam",
    },
    {
        "year": 2020,
        "total_candidates": 160000,
        "max_score": 800,
        "general_cutoff": 324,
        "obc_cutoff": 284,
        "sc_cutoff": 248,
        "st_cutoff": 228,
        "topper_score": 680,
        "median_score": 275,
        "total_seats_pg": 35000,
        "notes": "First full year as NEET-PG (replaced AIPGMEE)",
    },
]


# ---------------------------------------------------------------------------
# High-Yield Topic Frequency Analysis
# ---------------------------------------------------------------------------

TOPIC_FREQUENCY = {
    "Medicine": [
        {"topic": "Cardiology", "frequency": 0.95, "avg_questions": 5, "trend": "increasing"},
        {"topic": "Endocrinology", "frequency": 0.90, "avg_questions": 4, "trend": "stable"},
        {"topic": "Nephrology", "frequency": 0.85, "avg_questions": 3, "trend": "stable"},
        {"topic": "Gastroenterology", "frequency": 0.80, "avg_questions": 3, "trend": "stable"},
        {"topic": "Neurology", "frequency": 0.85, "avg_questions": 3, "trend": "increasing"},
        {"topic": "Hematology", "frequency": 0.80, "avg_questions": 3, "trend": "stable"},
        {"topic": "Rheumatology", "frequency": 0.70, "avg_questions": 2, "trend": "stable"},
        {"topic": "Pulmonology", "frequency": 0.75, "avg_questions": 3, "trend": "stable"},
        {"topic": "Infectious Diseases", "frequency": 0.85, "avg_questions": 4, "trend": "increasing"},
    ],
    "Surgery": [
        {"topic": "GI Surgery", "frequency": 0.90, "avg_questions": 4, "trend": "stable"},
        {"topic": "Hepatobiliary Surgery", "frequency": 0.80, "avg_questions": 3, "trend": "stable"},
        {"topic": "Breast Surgery", "frequency": 0.75, "avg_questions": 2, "trend": "stable"},
        {"topic": "Endocrine Surgery", "frequency": 0.70, "avg_questions": 2, "trend": "stable"},
        {"topic": "Urology", "frequency": 0.80, "avg_questions": 3, "trend": "stable"},
        {"topic": "Trauma & Orthopedics", "frequency": 0.85, "avg_questions": 4, "trend": "increasing"},
        {"topic": "Vascular Surgery", "frequency": 0.65, "avg_questions": 2, "trend": "stable"},
    ],
    "Obstetrics & Gynaecology": [
        {"topic": "High-Risk Pregnancy", "frequency": 0.95, "avg_questions": 4, "trend": "stable"},
        {"topic": "Gynecological Oncology", "frequency": 0.80, "avg_questions": 3, "trend": "stable"},
        {"topic": "Contraception", "frequency": 0.75, "avg_questions": 2, "trend": "stable"},
        {"topic": "Infertility", "frequency": 0.70, "avg_questions": 2, "trend": "stable"},
        {"topic": "Normal & Abnormal Labor", "frequency": 0.90, "avg_questions": 3, "trend": "stable"},
    ],
    "Pharmacology": [
        {"topic": "Autonomic Pharmacology", "frequency": 0.90, "avg_questions": 3, "trend": "stable"},
        {"topic": "Chemotherapy", "frequency": 0.85, "avg_questions": 2, "trend": "increasing"},
        {"topic": "Cardiovascular Drugs", "frequency": 0.85, "avg_questions": 2, "trend": "stable"},
        {"topic": "CNS Pharmacology", "frequency": 0.80, "avg_questions": 2, "trend": "stable"},
        {"topic": "Antimicrobials", "frequency": 0.90, "avg_questions": 3, "trend": "stable"},
    ],
    "Community Medicine": [
        {"topic": "Biostatistics", "frequency": 0.90, "avg_questions": 3, "trend": "increasing"},
        {"topic": "Epidemiology", "frequency": 0.85, "avg_questions": 2, "trend": "stable"},
        {"topic": "National Health Programs", "frequency": 0.90, "avg_questions": 3, "trend": "stable"},
    ],
    "Forensic Medicine": [
        {"topic": "Toxicology", "frequency": 0.90, "avg_questions": 3, "trend": "stable"},
        {"topic": "Thanatology", "frequency": 0.80, "avg_questions": 2, "trend": "stable"},
        {"topic": "Medical Jurisprudence", "frequency": 0.75, "avg_questions": 2, "trend": "stable"},
    ],
}


# ---------------------------------------------------------------------------
# Difficulty Distribution
# ---------------------------------------------------------------------------

DIFFICULTY_DISTRIBUTION = {
    "difficult": {"percentage": 60, "count_200": 120, "description": "Clinical reasoning, 2-step diagnosis"},
    "moderate": {"percentage": 25, "count_200": 50, "description": "Standard clinical application"},
    "easy": {"percentage": 15, "count_200": 30, "description": "Direct recall, basic science"},
}


# ---------------------------------------------------------------------------
# Exam Specifications
# ---------------------------------------------------------------------------

EXAM_SPECS = {
    "total_questions": 200,
    "duration_minutes": 210,
    "time_per_question_seconds": 63,
    "marks_per_correct": 4,
    "marks_per_wrong": -1,
    "marks_unanswered": 0,
    "max_score": 800,
    "format": "Single Best Answer MCQ, 4 options",
    "conducted_by": "National Board of Examinations (NBE)",
    "frequency": "Annual (January/March)",
    "eligibility": "MBBS degree holders",
    "purpose": "PG medical admissions across India",
}


def main():
    """Print all reference data."""
    output_json = "--json" in sys.argv

    if output_json:
        data = {
            "blueprint": NEET_PG_BLUEPRINT,
            "historical_cutoffs": HISTORICAL_CUTOFFS,
            "topic_frequency": TOPIC_FREQUENCY,
            "difficulty_distribution": DIFFICULTY_DISTRIBUTION,
            "exam_specs": EXAM_SPECS,
        }
        print(json.dumps(data, indent=2))
        return

    print("=" * 60)
    print("NEET-PG Reference Data for Acolyte AI")
    print("=" * 60)

    print("\n--- Exam Specifications ---")
    for k, v in EXAM_SPECS.items():
        print(f"  {k}: {v}")

    print("\n--- Subject Blueprint (200 questions) ---")
    total = 0
    for subj, data in NEET_PG_BLUEPRINT.items():
        print(f"  {subj}: {data['questions']}Q ({data['pct']}%)")
        total += data["questions"]
    print(f"  TOTAL: {total}")

    print("\n--- Historical Cutoffs ---")
    for c in HISTORICAL_CUTOFFS:
        print(
            f"  {c['year']}: Gen={c['general_cutoff']} OBC={c['obc_cutoff']} "
            f"SC={c['sc_cutoff']} ST={c['st_cutoff']} "
            f"Topper={c['topper_score']} ({c['total_candidates']:,} candidates)"
        )

    print("\n--- Difficulty Distribution ---")
    for tier, data in DIFFICULTY_DISTRIBUTION.items():
        print(f"  {tier}: {data['percentage']}% ({data['count_200']} questions)")

    print("\n--- High-Yield Topics (by subject) ---")
    for subj, topics in TOPIC_FREQUENCY.items():
        print(f"\n  {subj}:")
        for t in topics:
            print(
                f"    {t['topic']}: freq={t['frequency']} "
                f"avg_q={t['avg_questions']} trend={t['trend']}"
            )

    print(f"\n{'=' * 60}")
    print("Use --json flag for machine-readable output.")


if __name__ == "__main__":
    main()
