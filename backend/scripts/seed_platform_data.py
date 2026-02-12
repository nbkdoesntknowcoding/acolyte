"""Seed platform admin data for development.

Creates real rows in the database so the platform dashboard works immediately:
- 3 colleges (with realistic Karnataka medical college data)
- 3 licenses (pilot, starter, professional — different statuses)
- 60 usage snapshots (30 days × 2 active licenses)
- 5 platform alerts
- 5 audit log entries
- ~2000 system health metrics (24h at 5-min intervals)

Usage:
    cd backend && python -m scripts.seed_platform_data
"""

import asyncio
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text

from app.core.database import async_session_factory

# Deterministic UUIDs so re-running is idempotent
COLLEGE_1_ID = uuid.UUID("a0000001-0001-4000-8000-000000000001")
COLLEGE_2_ID = uuid.UUID("a0000001-0002-4000-8000-000000000002")
COLLEGE_3_ID = uuid.UUID("a0000001-0003-4000-8000-000000000003")
LICENSE_1_ID = uuid.UUID("b0000001-0001-4000-8000-000000000001")
LICENSE_2_ID = uuid.UUID("b0000001-0002-4000-8000-000000000002")
LICENSE_3_ID = uuid.UUID("b0000001-0003-4000-8000-000000000003")
ADMIN_USER_ID = uuid.UUID("c0000001-0001-4000-8000-000000000001")

NOW = datetime.now(timezone.utc)
TODAY = date.today()


async def seed():
    async with async_session_factory() as session:
        # ---------------------------------------------------------------
        # 0. Upsert colleges (required FK for licenses)
        # ---------------------------------------------------------------
        colleges = [
            {
                "id": COLLEGE_1_ID,
                "name": "Sri Devaraj Urs Medical College, Tamaka",
                "code": "KA-MCI-042",
                "state": "Karnataka",
                "district": "Kolar",
                "university_affiliation": "RGUHS",
                "nmc_recognition_status": "recognized",
                "total_intake": 150,
                "intake_year_started": 1986,
            },
            {
                "id": COLLEGE_2_ID,
                "name": "Mandya Institute of Medical Sciences",
                "code": "KA-MCI-078",
                "state": "Karnataka",
                "district": "Mandya",
                "university_affiliation": "RGUHS",
                "nmc_recognition_status": "recognized",
                "total_intake": 250,
                "intake_year_started": 1963,
            },
            {
                "id": COLLEGE_3_ID,
                "name": "Bangalore Medical College and Research Institute",
                "code": "KA-MCI-001",
                "state": "Karnataka",
                "district": "Bangalore Urban",
                "university_affiliation": "RGUHS",
                "nmc_recognition_status": "recognized",
                "total_intake": 250,
                "intake_year_started": 1955,
            },
        ]
        for c in colleges:
            await session.execute(
                text(
                    """INSERT INTO colleges (id, name, code, state, district,
                       university_affiliation, nmc_recognition_status,
                       total_intake, intake_year_started)
                       VALUES (:id, :name, :code, :state, :district,
                       :university_affiliation, :nmc_recognition_status,
                       :total_intake, :intake_year_started)
                       ON CONFLICT (id) DO NOTHING"""
                ),
                c,
            )
        print(f"  Upserted {len(colleges)} colleges")

        # ---------------------------------------------------------------
        # 1. Upsert licenses
        # ---------------------------------------------------------------
        licenses_data = [
            {
                "id": LICENSE_1_ID,
                "college_id": COLLEGE_1_ID,
                "plan_tier": "pilot",
                "plan_name": "Pilot Plan — Sri Devaraj Urs",
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
                "max_students": 100,
                "max_faculty": 50,
                "max_storage_gb": 20.0,
                "monthly_ai_token_budget": 50,
                "billing_cycle": "quarterly",
                "price_inr": 25000000,  # ₹2.5L in paise
                "status": "active",
                "activated_at": NOW - timedelta(days=30),
                "expires_at": NOW + timedelta(days=60),
                "sales_contact": "Nischay",
                "notes": "First pilot college. Dean Dr. Shivaram very engaged.",
            },
            {
                "id": LICENSE_2_ID,
                "college_id": COLLEGE_2_ID,
                "plan_tier": "starter",
                "plan_name": "Starter Plan — Mandya Institute",
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
                "max_students": 500,
                "max_faculty": 300,
                "max_storage_gb": 50.0,
                "monthly_ai_token_budget": 150,
                "billing_cycle": "annual",
                "price_inr": 450000000,  # ₹45L in paise
                "status": "active",
                "activated_at": NOW - timedelta(days=15),
                "expires_at": NOW + timedelta(days=350),
                "sales_contact": "Nischay",
                "notes": "Signed after demo. Compliance engine pending Jason's audit.",
            },
            {
                "id": LICENSE_3_ID,
                "college_id": COLLEGE_3_ID,
                "plan_tier": "professional",
                "plan_name": "Professional Plan — Bangalore Medical",
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
                "max_students": 750,
                "max_faculty": 600,
                "max_storage_gb": 100.0,
                "monthly_ai_token_budget": 300,
                "billing_cycle": "annual",
                "price_inr": 750000000,  # ₹75L in paise
                "status": "draft",
                "expires_at": NOW + timedelta(days=380),
                "sales_contact": "Nischay",
                "notes": "Government college. Largest opportunity. Contract pending approval.",
            },
        ]

        import json

        for lic in licenses_data:
            params = {**lic}
            params["enabled_engines"] = json.dumps(params["enabled_engines"])
            params["enabled_features"] = json.dumps(params["enabled_features"])
            # Ensure optional fields have defaults
            params.setdefault("activated_at", None)
            params.setdefault("expires_at", None)
            params.setdefault("price_inr", None)
            params.setdefault("sales_contact", None)
            params.setdefault("notes", None)
            await session.execute(
                text(
                    """INSERT INTO licenses (
                        id, college_id, plan_tier, plan_name,
                        enabled_engines, enabled_features,
                        max_students, max_faculty, max_storage_gb,
                        monthly_ai_token_budget, billing_cycle, price_inr,
                        status, activated_at, expires_at,
                        sales_contact, notes
                    ) VALUES (
                        :id, :college_id, :plan_tier, :plan_name,
                        CAST(:enabled_engines AS jsonb), CAST(:enabled_features AS jsonb),
                        :max_students, :max_faculty, :max_storage_gb,
                        :monthly_ai_token_budget, :billing_cycle, :price_inr,
                        :status, :activated_at, :expires_at,
                        :sales_contact, :notes
                    ) ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        updated_at = NOW()"""
                ),
                params,
            )
        print(f"  Upserted {len(licenses_data)} licenses")

        # ---------------------------------------------------------------
        # 2. Usage snapshots — 30 days for each active license
        # ---------------------------------------------------------------
        random.seed(42)  # Reproducible data
        snapshot_count = 0

        active_licenses = [
            (LICENSE_1_ID, 100, 50, 50),   # id, max_students, max_faculty, ai_budget
            (LICENSE_2_ID, 500, 300, 150),
        ]

        for lic_id, max_stu, max_fac, ai_budget in active_licenses:
            cumulative_ai = 0
            for days_ago in range(30, 0, -1):
                snap_date = TODAY - timedelta(days=days_ago)
                base_students = int(max_stu * 0.6)
                base_faculty = int(max_fac * 0.35)
                daily_ai = random.randint(1, int(ai_budget * 0.05) + 1)
                cumulative_ai += daily_ai

                await session.execute(
                    text(
                        """INSERT INTO license_usage_snapshots (
                            id, license_id, snapshot_date,
                            active_students, active_faculty, total_users,
                            ai_tokens_used, ai_tokens_month_to_date,
                            ai_requests_count, storage_used_gb,
                            api_requests_count, feature_usage
                        ) VALUES (
                            :id, :license_id, :snapshot_date,
                            :active_students, :active_faculty, :total_users,
                            :ai_tokens_used, :ai_tokens_month_to_date,
                            :ai_requests_count, :storage_used_gb,
                            :api_requests_count, CAST(:feature_usage AS jsonb)
                        ) ON CONFLICT ON CONSTRAINT uq_license_usage_snapshot
                          DO UPDATE SET
                            active_students = EXCLUDED.active_students,
                            ai_tokens_month_to_date = EXCLUDED.ai_tokens_month_to_date"""
                    ),
                    {
                        "id": uuid.uuid4(),
                        "license_id": lic_id,
                        "snapshot_date": snap_date,
                        "active_students": base_students + random.randint(-5, 5),
                        "active_faculty": base_faculty + random.randint(-2, 2),
                        "total_users": base_students + base_faculty + 3,
                        "ai_tokens_used": daily_ai,
                        "ai_tokens_month_to_date": cumulative_ai,
                        "ai_requests_count": random.randint(200, 800),
                        "storage_used_gb": round(random.uniform(5.0, 15.0), 1),
                        "api_requests_count": random.randint(500, 2000),
                        "feature_usage": json.dumps(
                            {
                                "socratic_study_buddy": random.randint(50, 150),
                                "practice_questions": random.randint(30, 100),
                                "flashcards": random.randint(20, 80),
                                "exam_question_generator": random.randint(5, 20),
                            }
                        ),
                    },
                )
                snapshot_count += 1

        print(f"  Upserted {snapshot_count} usage snapshots")

        # ---------------------------------------------------------------
        # 3. Platform alerts
        # ---------------------------------------------------------------
        alerts_data = [
            {
                "id": uuid.UUID("d0000001-0001-4000-8000-000000000001"),
                "severity": "warning",
                "category": "license",
                "title": "License expiring in 60 days",
                "details": f"Sri Devaraj Urs Medical College pilot license expires on {TODAY + timedelta(days=60)}. Contact dean Dr. Shivaram for renewal discussion.",
                "college_id": COLLEGE_1_ID,
                "license_id": LICENSE_1_ID,
                "source_component": "license_checker",
                "status": "active",
            },
            {
                "id": uuid.UUID("d0000001-0002-4000-8000-000000000002"),
                "severity": "info",
                "category": "license",
                "title": "Onboarding in progress for 15 days",
                "details": "Mandya Institute of Medical Sciences onboarding started 15 days ago. Compliance engine setup pending.",
                "college_id": COLLEGE_2_ID,
                "license_id": LICENSE_2_ID,
                "source_component": "onboarding_tracker",
                "status": "active",
            },
            {
                "id": uuid.UUID("d0000001-0003-4000-8000-000000000003"),
                "severity": "warning",
                "category": "ai_budget",
                "title": "AI budget at 70% utilization",
                "details": "Sri Devaraj Urs has used 70% of monthly AI token budget with 10 days remaining. Consider budget adjustment.",
                "college_id": COLLEGE_1_ID,
                "license_id": LICENSE_1_ID,
                "source_component": "budget_monitor",
                "status": "active",
            },
            {
                "id": uuid.UUID("d0000001-0004-4000-8000-000000000004"),
                "severity": "error",
                "category": "system",
                "title": "Redis latency spike detected",
                "details": "Redis p95 latency exceeded 50ms threshold at 14:30 UTC. May impact real-time features. Auto-recovered at 14:45 UTC.",
                "source_component": "redis",
                "status": "acknowledged",
                "acknowledged_by": ADMIN_USER_ID,
                "acknowledged_at": NOW - timedelta(hours=6),
            },
            {
                "id": uuid.UUID("d0000001-0005-4000-8000-000000000005"),
                "severity": "critical",
                "category": "system",
                "title": "AI Gateway error rate above 5%",
                "details": "LiteLLM proxy returning 5.2% error rate (threshold: 5%). Mostly 429 rate limits from Anthropic. Retry logic handling most failures.",
                "source_component": "ai_gateway",
                "trigger_data": json.dumps({"error_rate": 5.2, "threshold": 5.0}),
                "status": "active",
            },
        ]

        for alert in alerts_data:
            params = {**alert}
            # Ensure optional fields have defaults
            params.setdefault("college_id", None)
            params.setdefault("license_id", None)
            params.setdefault("source_component", None)
            params.setdefault("trigger_data", None)
            params.setdefault("acknowledged_by", None)
            params.setdefault("acknowledged_at", None)
            await session.execute(
                text(
                    """INSERT INTO platform_alerts (
                        id, severity, category, title, details,
                        college_id, license_id, source_component,
                        trigger_data, status, acknowledged_by, acknowledged_at
                    ) VALUES (
                        :id, :severity, :category, :title, :details,
                        :college_id, :license_id, :source_component,
                        CAST(:trigger_data AS jsonb), :status, :acknowledged_by, :acknowledged_at
                    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status"""
                ),
                params,
            )
        print(f"  Upserted {len(alerts_data)} alerts")

        # ---------------------------------------------------------------
        # 4. Audit log entries
        # ---------------------------------------------------------------
        audit_entries = [
            {
                "id": uuid.UUID("e0000001-0001-4000-8000-000000000001"),
                "actor_id": ADMIN_USER_ID,
                "actor_email": "nischaybk@theboringpeople.in",
                "action": "license.create",
                "entity_type": "license",
                "entity_id": LICENSE_1_ID,
                "changes": json.dumps(
                    {"plan_tier": "pilot", "college": "Sri Devaraj Urs"}
                ),
                "created_at": NOW - timedelta(days=30),
            },
            {
                "id": uuid.UUID("e0000001-0002-4000-8000-000000000002"),
                "actor_id": ADMIN_USER_ID,
                "actor_email": "nischaybk@theboringpeople.in",
                "action": "license.activate",
                "entity_type": "license",
                "entity_id": LICENSE_1_ID,
                "changes": json.dumps(
                    {"status": {"old": "draft", "new": "active"}}
                ),
                "created_at": NOW - timedelta(days=30),
            },
            {
                "id": uuid.UUID("e0000001-0003-4000-8000-000000000003"),
                "actor_id": ADMIN_USER_ID,
                "actor_email": "nischaybk@theboringpeople.in",
                "action": "license.create",
                "entity_type": "license",
                "entity_id": LICENSE_2_ID,
                "changes": json.dumps(
                    {"plan_tier": "starter", "college": "Mandya Institute"}
                ),
                "created_at": NOW - timedelta(days=15),
            },
            {
                "id": uuid.UUID("e0000001-0004-4000-8000-000000000004"),
                "actor_id": ADMIN_USER_ID,
                "actor_email": "nischaybk@theboringpeople.in",
                "action": "license.activate",
                "entity_type": "license",
                "entity_id": LICENSE_2_ID,
                "changes": json.dumps(
                    {"status": {"old": "draft", "new": "active"}}
                ),
                "created_at": NOW - timedelta(days=15),
            },
            {
                "id": uuid.UUID("e0000001-0005-4000-8000-000000000005"),
                "actor_id": ADMIN_USER_ID,
                "actor_email": "nischaybk@theboringpeople.in",
                "action": "license.create",
                "entity_type": "license",
                "entity_id": LICENSE_3_ID,
                "changes": json.dumps(
                    {
                        "plan_tier": "professional",
                        "college": "Bangalore Medical College",
                        "status": "draft",
                    }
                ),
                "created_at": NOW - timedelta(days=5),
            },
        ]

        for entry in audit_entries:
            params = {**entry}
            params.setdefault("entity_id", None)
            await session.execute(
                text(
                    """INSERT INTO platform_audit_log (
                        id, actor_id, actor_email, action,
                        entity_type, entity_id, changes, created_at
                    ) VALUES (
                        :id, :actor_id, :actor_email, :action,
                        :entity_type, :entity_id, CAST(:changes AS jsonb), :created_at
                    ) ON CONFLICT (id) DO NOTHING"""
                ),
                params,
            )
        print(f"  Upserted {len(audit_entries)} audit log entries")

        # ---------------------------------------------------------------
        # 5. System health metrics — 24h at 5-min intervals
        # ---------------------------------------------------------------
        random.seed(42)
        metric_count = 0
        components_metrics = [
            ("database", "total_connections", "count", 5, 25),
            ("database", "query_latency_ms", "ms", 2, 15),
            ("redis", "ping_latency_ms", "ms", 0.5, 8),
            ("redis", "memory_used_mb", "mb", 30, 90),
            ("ai_gateway", "avg_latency_ms", "ms", 800, 3000),
            ("ai_gateway", "error_rate_pct", "percent", 0.1, 4.0),
            ("ai_gateway", "cache_hit_rate_pct", "percent", 60, 95),
            ("celery", "queue_depth", "count", 0, 15),
            ("celery", "active_workers", "count", 1, 4),
            ("api", "response_time_p50_ms", "ms", 40, 150),
            ("api", "response_time_p95_ms", "ms", 100, 500),
            ("permify", "latency_ms", "ms", 5, 30),
        ]

        # Delete old metrics first to avoid duplicates on re-run
        await session.execute(
            text(
                "DELETE FROM system_health_metrics WHERE recorded_at > :cutoff"
            ),
            {"cutoff": NOW - timedelta(hours=25)},
        )

        for minutes_ago in range(0, 1440, 5):  # Every 5 min for 24h
            ts = NOW - timedelta(minutes=minutes_ago)
            for comp, metric, unit, lo, hi in components_metrics:
                val = round(random.uniform(lo, hi), 2)
                # Determine status from value
                status = "healthy"
                if metric == "error_rate_pct" and val > 3.0:
                    status = "degraded"
                elif metric == "error_rate_pct" and val > 5.0:
                    status = "unhealthy"
                elif metric == "total_connections" and val > 20:
                    status = "degraded"
                elif "latency" in metric and val > hi * 0.8:
                    status = "degraded"

                await session.execute(
                    text(
                        """INSERT INTO system_health_metrics (
                            id, component, metric_name, value, unit,
                            status, recorded_at
                        ) VALUES (
                            :id, :component, :metric_name, :value, :unit,
                            :status, :recorded_at
                        )"""
                    ),
                    {
                        "id": uuid.uuid4(),
                        "component": comp,
                        "metric_name": metric,
                        "value": val,
                        "unit": unit,
                        "status": status,
                        "recorded_at": ts,
                    },
                )
                metric_count += 1

        print(f"  Inserted {metric_count} health metrics")

        # ---------------------------------------------------------------
        # Commit everything
        # ---------------------------------------------------------------
        await session.commit()
        print("\nSeed complete!")


async def verify():
    """Verify seeded data counts."""
    async with async_session_factory() as session:
        tables = [
            ("licenses", 3),
            ("license_usage_snapshots", 60),
            ("platform_alerts", 5),
            ("platform_audit_log", 5),
            ("system_health_metrics", 3456),
        ]
        print("\nVerification:")
        for table, expected in tables:
            r = await session.execute(text(f"SELECT count(*) FROM {table}"))
            count = r.scalar()
            status = "OK" if count >= expected else "LOW"
            print(f"  {table:35s} {count:>6d} rows (expected ~{expected}) [{status}]")


if __name__ == "__main__":
    print("Seeding platform data...")
    asyncio.run(seed())
    asyncio.run(verify())
