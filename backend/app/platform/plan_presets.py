"""License plan tier presets.

Each preset defines the default limits and feature flags for a plan tier.
When creating a license with ``LicenseCreate(plan_tier="professional")``,
any fields not explicitly overridden are filled from the preset.

Plan tiers (ascending):
  pilot       → small colleges evaluating the platform (100 students)
  starter     → mid-size adoption (500 students, +compliance)
  professional → full deployment (750 students, all features)
  enterprise  → large institutions / multi-campus (2000 students, custom)
"""

from typing import Any

PLAN_PRESETS: dict[str, dict[str, Any]] = {
    "pilot": {
        "plan_name": "Pilot Plan",
        "max_students": 100,
        "max_faculty": 50,
        "max_admin_users": 5,
        "max_departments": 10,
        "monthly_ai_token_budget": 50,  # thousands of tokens
        "max_storage_gb": 20.0,
        "enabled_engines": {
            "student_engine": True,
            "faculty_engine": True,
            "compliance_engine": False,
            "admin_engine": False,
            "integration_engine": False,
            "ai_engine": True,
        },
        "enabled_features": {
            "socratic_study_buddy": True,
            "practice_questions": True,
            "neet_pg_prep": False,
            "flashcards": True,
            "recommendations": False,
            "exam_question_generator": True,
            "saf_generator": False,
            "compliance_monitoring": False,
            "metacognitive_analytics": True,
            "admin_copilot": False,
            "medical_ppt_generator": False,
            "assessment_grading": False,
            "aebas_integration": False,
            "university_portal_integration": False,
        },
    },
    "starter": {
        "plan_name": "Starter Plan",
        "max_students": 500,
        "max_faculty": 300,
        "max_admin_users": 10,
        "max_departments": 20,
        "monthly_ai_token_budget": 150,
        "max_storage_gb": 50.0,
        "enabled_engines": {
            "student_engine": True,
            "faculty_engine": True,
            "compliance_engine": True,
            "admin_engine": False,
            "integration_engine": False,
            "ai_engine": True,
        },
        "enabled_features": {
            "socratic_study_buddy": True,
            "practice_questions": True,
            "neet_pg_prep": True,
            "flashcards": True,
            "recommendations": True,
            "exam_question_generator": True,
            "saf_generator": False,
            "compliance_monitoring": True,
            "metacognitive_analytics": True,
            "admin_copilot": False,
            "medical_ppt_generator": False,
            "assessment_grading": True,
            "aebas_integration": False,
            "university_portal_integration": False,
        },
    },
    "professional": {
        "plan_name": "Professional Plan",
        "max_students": 750,
        "max_faculty": 600,
        "max_admin_users": 20,
        "max_departments": 25,
        "monthly_ai_token_budget": 300,
        "max_storage_gb": 100.0,
        "enabled_engines": {
            "student_engine": True,
            "faculty_engine": True,
            "compliance_engine": True,
            "admin_engine": True,
            "integration_engine": True,
            "ai_engine": True,
        },
        "enabled_features": {
            "socratic_study_buddy": True,
            "practice_questions": True,
            "neet_pg_prep": True,
            "flashcards": True,
            "recommendations": True,
            "exam_question_generator": True,
            "saf_generator": True,
            "compliance_monitoring": True,
            "metacognitive_analytics": True,
            "admin_copilot": True,
            "medical_ppt_generator": True,
            "assessment_grading": True,
            "aebas_integration": True,
            "university_portal_integration": True,
        },
    },
    "enterprise": {
        "plan_name": "Enterprise Plan",
        "max_students": 2000,
        "max_faculty": 1500,
        "max_admin_users": 50,
        "max_departments": 40,
        "monthly_ai_token_budget": 1000,
        "max_storage_gb": 500.0,
        "enabled_engines": {
            "student_engine": True,
            "faculty_engine": True,
            "compliance_engine": True,
            "admin_engine": True,
            "integration_engine": True,
            "ai_engine": True,
        },
        "enabled_features": {
            "socratic_study_buddy": True,
            "practice_questions": True,
            "neet_pg_prep": True,
            "flashcards": True,
            "recommendations": True,
            "exam_question_generator": True,
            "saf_generator": True,
            "compliance_monitoring": True,
            "metacognitive_analytics": True,
            "admin_copilot": True,
            "medical_ppt_generator": True,
            "assessment_grading": True,
            "aebas_integration": True,
            "university_portal_integration": True,
        },
    },
}


def get_preset(plan_tier: str) -> dict[str, Any]:
    """Get the plan preset for a tier. Raises KeyError if unknown."""
    return PLAN_PRESETS[plan_tier]


def get_plan_tiers() -> list[str]:
    """Return available plan tier names in ascending order."""
    return list(PLAN_PRESETS.keys())
