"""Seed Compliance Standards Template — JSON examples for Jason.

This script provides example ComplianceStandard JSON structures.
Jason uses these as templates when entering NMC/NAAC/NBA rules.

Usage:
    # Print the template JSON:
    python -m scripts.seed_compliance_standards_template

    # Or import and use in code:
    from scripts.seed_compliance_standards_template import EXAMPLE_STANDARDS

NOTE: These are EXAMPLES only. Do NOT insert them into production.
Jason will create actual standards based on his NMC/NAAC/NBA audit.
"""

import json

EXAMPLE_STANDARDS = [
    # -----------------------------------------------------------------------
    # Example 1: Student attendance (min_percentage)
    # -----------------------------------------------------------------------
    {
        "standard_code": "ATT.1.1",
        "category": "attendance",
        "subcategory": "student_attendance",
        "title": "Minimum Student Attendance for Exam Eligibility",
        "description": (
            "As per GMER 2023, students must maintain ≥75% attendance "
            "to be eligible for university examinations. Colleges with "
            "aggregate attendance below this threshold face NMC show-cause."
        ),
        "data_source": "attendance_records",
        "data_query_config": {
            "source": "attendance_records",
            "metric": "percentage",
            "aggregation": "avg",
            "group_by": "department",
            "person_type": "student",
            "time_window_days": 30,
        },
        "threshold_type": "min_percentage",
        "threshold_value": "75",
        "comparison_operator": "gte",
        "buffer_warning_pct": 10.0,
        "severity_if_breached": "show_cause",
        "regulatory_body": "nmc",
        "source_document": "GMER 2023 Regulation 4.2",
        "effective_from": "2023-08-01",
        "effective_until": None,
        "priority": 2,
    },
    # -----------------------------------------------------------------------
    # Example 2: Faculty MSR ratio (min_count)
    # -----------------------------------------------------------------------
    {
        "standard_code": "MSR.3.2.1",
        "category": "faculty",
        "subcategory": "faculty_strength",
        "title": "Minimum Faculty MSR Requirement — Professors",
        "description": (
            "As per UG-MSR 2023, each department must maintain the "
            "minimum number of professors as specified per intake size. "
            "A shortfall below threshold triggers seat reduction."
        ),
        "data_source": "faculty_roster",
        "data_query_config": {
            "source": "faculty_roster",
            "metric": "count",
            "designation": "professor",
            "group_by": "department",
            "filters": {
                "employment_status": "active",
            },
        },
        "threshold_type": "min_count",
        "threshold_value": "3",
        "comparison_operator": "gte",
        "buffer_warning_pct": 15.0,
        "severity_if_breached": "seat_reduction",
        "regulatory_body": "nmc",
        "source_document": "UG-MSR 2023 Table 3",
        "effective_from": "2023-08-01",
        "effective_until": None,
        "priority": 1,
    },
    # -----------------------------------------------------------------------
    # Example 3: Hospital bed occupancy (min_percentage)
    # -----------------------------------------------------------------------
    {
        "standard_code": "INFRA.5.1",
        "category": "infrastructure",
        "subcategory": "hospital_beds",
        "title": "Teaching Hospital Bed Occupancy Rate",
        "description": (
            "Teaching hospitals must maintain adequate bed occupancy "
            "rates to demonstrate clinical exposure for students."
        ),
        "data_source": "infrastructure_inventory",
        "data_query_config": {
            "source": "infrastructure_inventory",
            "metric": "percentage",
            "resource_type": "hospital_bed",
            "calculation": "occupied / total * 100",
        },
        "threshold_type": "min_percentage",
        "threshold_value": "60",
        "comparison_operator": "gte",
        "buffer_warning_pct": 10.0,
        "severity_if_breached": "warning",
        "regulatory_body": "nmc",
        "source_document": "UG-MSR 2023 Hospital Standards",
        "effective_from": None,
        "effective_until": None,
        "priority": 5,
    },
    # -----------------------------------------------------------------------
    # Example 4: AEBAS faculty attendance (boolean-ish min_percentage)
    # -----------------------------------------------------------------------
    {
        "standard_code": "AEBAS.1.1",
        "category": "attendance",
        "subcategory": "faculty_attendance",
        "title": "Faculty AEBAS Attendance Compliance",
        "description": (
            "Faculty must maintain ≥75% attendance as captured by AEBAS "
            "(or parallel capture system). NMC mandated GPS geofencing "
            "from May 2025."
        ),
        "data_source": "attendance_records",
        "data_query_config": {
            "source": "attendance_records",
            "metric": "percentage",
            "aggregation": "avg",
            "group_by": "department",
            "person_type": "faculty",
            "time_window_days": 30,
        },
        "threshold_type": "min_percentage",
        "threshold_value": "75",
        "comparison_operator": "gte",
        "buffer_warning_pct": 8.0,
        "severity_if_breached": "show_cause",
        "regulatory_body": "nmc",
        "source_document": "AEBAS Circular 2024, NMC GMER 2023",
        "effective_from": "2024-01-01",
        "effective_until": None,
        "priority": 2,
    },
]


def main() -> None:
    """Print the template JSON to stdout."""
    print("=" * 70)
    print("Compliance Standards Template — JSON Examples for Jason")
    print("=" * 70)
    print()
    print("Copy these examples and modify for actual NMC/NAAC/NBA rules.")
    print("POST them to /api/v1/compliance/standards/import as a JSON array.")
    print()
    print(json.dumps(EXAMPLE_STANDARDS, indent=2, default=str))
    print()
    print(f"Total examples: {len(EXAMPLE_STANDARDS)}")
    print()
    print("data_source types (register fetchers for these):")
    sources = sorted(set(s["data_source"] for s in EXAMPLE_STANDARDS))
    for src in sources:
        print(f"  - {src}")


if __name__ == "__main__":
    main()
