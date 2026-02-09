# ACOLYTE AI — Technical Architecture Blueprint

**Version:** 1.0 | **Date:** February 2026 | **Status:** Implementation-Ready
**Authors:** Nischay (AI Lead), Subha (CTO), Jason (Compliance Dev)
**Purpose:** This is the coding reference for the Acolyte AI platform. Every architectural decision, schema definition, API contract, and implementation detail lives here. If it's not in this document, it hasn't been decided.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Database Architecture](#3-database-architecture)
4. [Central AI Engine](#4-central-ai-engine)
5. [Engine Specifications](#5-engine-specifications)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Mobile Architecture](#7-mobile-architecture)
8. [Integration Architecture](#8-integration-architecture)
9. [DevOps & Infrastructure](#9-devops--infrastructure)
10. [Security & Compliance](#10-security--compliance)
11. [Team Allocation & Workflow](#11-team-allocation--workflow)
12. [API Contracts Between Engines](#12-api-contracts-between-engines)
13. [Cost Model](#13-cost-model)

---

## 1. Architecture Overview

### 1.1 The Pattern: Modular Monolith

Six logical engines exist as **Python packages within a single FastAPI application**, deployed as one unit. Each engine owns its own models, routes, and business logic behind defined public interfaces. Inter-engine communication uses direct function calls (zero network overhead) with an in-process event bus (Redis Pub/Sub) for async notifications.

**Why not microservices:** 3 developers. A 2024 DZone study found teams spent 35% more time debugging in microservices architectures. Shopify runs a 2.8M-line modular monolith with 37 components. We follow DHH's "Citadel + Outposts" pattern — monolith at center, extract services only when specific performance demands justify it.

**The one planned extraction:** Central AI Engine. LangGraph agents are CPU-intensive and long-running. When scaling demands it (likely Year 2), extract to a separate Fly.io app communicating via NATS over Fly.io's 6PN private networking.

### 1.2 The Six Engines

| Engine | Owner | Purpose | Dependencies |
|--------|-------|---------|-------------|
| **Student Engine** | Subha | Learning experience, PDF viewer, flashcards, practice tests, Socratic AI chat, metacognitive analytics | Central AI Engine |
| **Faculty Engine** | Subha (web) / Jason (backend logic) | Assessment lifecycle, CBME logbook, lesson plans, clinical rotation management, student performance dashboards | Central AI Engine, Compliance Engine |
| **Compliance Engine** | Jason | NMC/NAAC/NBA compliance monitoring, SAF auto-generation, inspection readiness, faculty MSR tracking | Integration Engine (AEBAS data), Admin Engine (faculty roster) |
| **Admin Engine** | Jason | SIS, fee management, HR/payroll, hostel/transport, certificate management, communication platform | Integration Engine (payment gateways) |
| **Integration Engine** | Jason | AEBAS parallel capture, HMIS data bridge, payment gateway connectors, university portal adapters | External systems |
| **Central AI Engine** | Nischay | LangGraph agent orchestration, LiteLLM gateway, RAG pipeline, medical knowledge graph, AI safety pipeline | All engines call into this |

### 1.3 Deployment Topology

```
┌──────────────────────────────────────────────────────────────┐
│                     VERCEL (Global CDN)                       │
│               Next.js 15 Frontend (All Roles)                │
│     Student │ Faculty │ HOD │ Dean │ Admin │ Compliance       │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS (REST + JSON)
┌──────────────────────────▼───────────────────────────────────┐
│                FLY.IO — Mumbai (bom) Region                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │             FASTAPI MODULAR MONOLITH                    │ │
│  │                                                         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐              │ │
│  │  │ Student  │ │ Faculty  │ │   Admin   │              │ │
│  │  │ Engine   │ │ Engine   │ │  Engine   │              │ │
│  │  └────┬─────┘ └────┬─────┘ └─────┬─────┘              │ │
│  │       │             │             │                     │ │
│  │  ┌────▼─────┐ ┌────▼──────┐ ┌────▼──────┐             │ │
│  │  │Compliance│ │Integration│ │Central AI │             │ │
│  │  │ Engine   │ │  Engine   │ │  Engine   │             │ │
│  │  └──────────┘ └───────────┘ └───────────┘             │ │
│  │                                                         │ │
│  │         Event Bus (Redis Pub/Sub)                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐       │
│  │   Celery   │  │   LiteLLM    │  │     Redis      │       │
│  │  Workers   │  │  AI Gateway  │  │  Cache/Queue   │       │
│  └────────────┘  └──────────────┘  └────────────────┘       │
└──────────────────────────┬───────────────────────────────────┘
                           │
    ┌──────────────────────▼──────────────────┐
    │      NEON POSTGRESQL (Singapore)         │
    │    Shared Schema + RLS per college       │
    │    pgvector │ pg_partman │ pgcrypto      │
    └─────────────────────────────────────────┘
    ┌──────────────────────────────────────────┐
    │      CLOUDFLARE R2 + STREAM              │
    │    PDFs │ DICOM │ WSI │ Video │ Docs     │
    └──────────────────────────────────────────┘
```

### 1.4 Technology Stack — Final Decisions

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Backend** | FastAPI (Python) | 3.11+ | Production-tested in QuickQuote; best AI/ML ecosystem; 37 LangGraph agents already in Python |
| **Frontend** | Next.js | 15 (App Router) | Team knows it; React 19 support; Turbopack; server components for dashboards |
| **Mobile** | Expo (React Native) | SDK 52+ | TypeScript sharing with web; Hermes engine for low-end Android; New Architecture default |
| **Database** | Neon PostgreSQL | Serverless | Branching for dev workflow; pgvector; PgBouncer pooling; auto-scaling |
| **Vector Search** | pgvector (in Neon) | HNSW indexes | No separate vector DB needed; co-located with relational data |
| **Cache/Broker** | Upstash Redis | HTTP-based, TLS | Celery broker + app cache + event bus; no persistent connections |
| **Object Storage** | Cloudflare R2 | S3-compatible | Zero egress fees; critical for TB-scale medical imaging |
| **Video** | Cloudflare Stream | HLS adaptive | $5/1K min stored; integrates with R2 |
| **AI Orchestration** | LangGraph | StateGraph | 37+ agents; best state management; graph-based workflows |
| **AI Gateway** | LiteLLM Proxy | Self-hosted on Fly.io | 100+ LLM support; multi-tenant budgets; 8ms P95 latency |
| **AI Models** | Claude Sonnet 4 (primary), GPT-4o (extraction), Haiku (routing) | API-only at launch | Self-hosted medical models deferred to Year 2 |
| **Embeddings** | OpenAI text-embedding-3-large | 1536 dimensions, API | $0.13/M tokens; no GPU needed; migrate to MedCPT in Year 2 |
| **Offline Sync** | PowerSync | Paid from Day 1 | Direct Neon integration; production-ready sync rules |
| **PDF (Mobile)** | react-native-pdf-jsi | JSI-based | 80x faster than react-native-pdf; 2MB constant memory |
| **Auth** | Clerk | RS256 JWT, JWKS | Already in production; Next.js + mobile SDK |
| **Authorization** | Permify | Zanzibar-style ReBAC | Models college hierarchy; acquired by FusionAuth |
| **UI (Web)** | shadcn/ui + Tremor | Tailwind-based | Full ownership; Tremor for dashboards |
| **UI (Mobile)** | gluestack-ui v2 + NativeWind | Tailwind-based | 99ms avg render; shadcn/ui-inspired; bridges web/mobile |
| **Charts** | Tremor + Recharts | — | Dashboard-specific; Vercel-native |
| **Monorepo** | Turborepo | — | 15-min setup; Vercel-native; sufficient for 3 devs |
| **CI/CD** | GitHub Actions | — | Native Vercel/Fly.io integrations; monorepo path filtering |
| **Monitoring** | Sentry + BetterStack | — | Error tracking + uptime monitoring; free tiers sufficient |
| **AI Monitoring** | Langfuse (self-hosted) | — | Open-source; 50K events free; medical compliance compatible |
| **Feature Flags** | Unleash | Self-hosted | Decouple deployment from release; tier-based feature access |
| **Payment** | Razorpay | — | Best developer APIs; education-specific features; Smart Collect |
| **Real-time** | Server-Sent Events (SSE) | — | Sufficient for dashboards/notifications; simpler than WebSocket |

### 1.5 Critical Data Flow: Compliance Pathway

```
Biometric Device → NMC Portal (no API)
                         ↓
         ┌───────────────┴────────────────┐
         │  PARALLEL CAPTURE              │
         │  Acolyte's Integration Engine  │
         │  (faculty marks attendance in  │
         │   both systems during          │
         │   transition period)           │
         └───────────────┬────────────────┘
                         │
              Redis Pub/Sub: "attendance.recorded"
                         │
         ┌───────────────▼────────────────┐
         │  COMPLIANCE ENGINE             │
         │  Recalculates rolling metrics  │
         │  per department, per faculty   │
         │  Prophet forecasting on 90-day │
         │  rolling window               │
         └───────────────┬────────────────┘
                         │
              Redis Pub/Sub: "compliance.alert"
                         │
         ┌───────────────▼────────────────┐
         │  ADMIN ENGINE                  │
         │  Delivers notifications to     │
         │  Dean/HOD via SSE + push       │
         └────────────────────────────────┘
```

---

## 2. Monorepo Structure

```
acolyte/
├── apps/
│   ├── web/                          # Next.js 15 frontend (all roles)
│   │   ├── app/
│   │   │   ├── (auth)/               # Clerk auth pages
│   │   │   ├── (dashboard)/          # Shared dashboard layout
│   │   │   │   ├── student/          # Student-specific routes
│   │   │   │   ├── faculty/          # Faculty/HOD routes
│   │   │   │   ├── admin/            # Admin routes
│   │   │   │   ├── compliance/       # Compliance officer routes
│   │   │   │   └── management/       # Dean/Trust management routes
│   │   │   └── api/                  # Next.js API routes (BFF pattern)
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── dashboard/            # Tremor dashboard components
│   │   │   └── shared/               # Cross-role components
│   │   ├── lib/
│   │   │   ├── api-client.ts         # Generated from OpenAPI spec
│   │   │   ├── auth.ts               # Clerk utilities
│   │   │   └── permissions.ts        # Permify client-side checks
│   │   └── next.config.ts
│   │
│   └── mobile/                       # Expo React Native app
│       ├── app/                      # Expo Router (file-based routing)
│       │   ├── (auth)/
│       │   ├── (tabs)/               # Main tab navigation
│       │   │   ├── home/
│       │   │   ├── study/            # PDF viewer, flashcards
│       │   │   ├── practice/         # Tests, MCQ practice
│       │   │   ├── logbook/          # Competency logbook (offline-capable)
│       │   │   └── profile/
│       │   └── _layout.tsx
│       ├── components/
│       │   ├── ui/                   # gluestack-ui v2 components
│       │   └── shared/
│       ├── lib/
│       │   ├── powersync/            # PowerSync setup + sync rules
│       │   ├── storage/              # MMKV for fast KV storage
│       │   └── api-client.ts
│       └── app.config.ts
│
├── packages/
│   ├── shared/                       # Shared TypeScript types + utilities
│   │   ├── types/                    # API response types, shared interfaces
│   │   ├── validators/               # Zod schemas (shared web + mobile)
│   │   └── constants/                # NMC competency codes, config constants
│   ├── ui-tokens/                    # Design tokens (colors, spacing, typography)
│   │   └── tokens.ts                 # Shared between web shadcn + mobile gluestack
│   └── api-client/                   # Generated API client from OpenAPI
│       └── generated/
│
├── backend/                          # FastAPI modular monolith
│   ├── alembic/                      # Database migrations (single owner)
│   │   ├── versions/
│   │   └── env.py
│   ├── app/
│   │   ├── main.py                   # FastAPI app initialization
│   │   ├── config.py                 # Settings (Pydantic BaseSettings)
│   │   ├── middleware/
│   │   │   ├── auth.py               # Clerk JWT validation
│   │   │   ├── tenant.py             # Multi-tenant context (sets college_id)
│   │   │   ├── rate_limit.py
│   │   │   └── cors.py
│   │   ├── core/
│   │   │   ├── database.py           # AsyncSession, engine, RLS setup
│   │   │   ├── events.py             # Redis Pub/Sub event bus
│   │   │   ├── permissions.py        # Permify integration
│   │   │   ├── storage.py            # Cloudflare R2 client
│   │   │   └── celery_app.py         # Celery configuration
│   │   │
│   │   ├── engines/                  # THE SIX ENGINES
│   │   │   ├── student/
│   │   │   │   ├── __init__.py       # Public interface (what other engines can call)
│   │   │   │   ├── models.py         # SQLAlchemy models
│   │   │   │   ├── routes.py         # FastAPI routes (/api/v1/student/...)
│   │   │   │   ├── schemas.py        # Pydantic request/response schemas
│   │   │   │   ├── service.py        # Business logic
│   │   │   │   └── tasks.py          # Celery tasks
│   │   │   ├── faculty/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py
│   │   │   │   ├── routes.py
│   │   │   │   ├── schemas.py
│   │   │   │   ├── service.py
│   │   │   │   ├── tasks.py
│   │   │   │   └── agents/           # Faculty-specific AI agents
│   │   │   │       ├── mcq_generator.py
│   │   │   │       ├── saq_rubric_generator.py
│   │   │   │       ├── lesson_plan_generator.py
│   │   │   │       └── rotation_scheduler.py
│   │   │   ├── compliance/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py
│   │   │   │   ├── routes.py
│   │   │   │   ├── schemas.py
│   │   │   │   ├── service.py
│   │   │   │   ├── tasks.py
│   │   │   │   ├── nmc_standards.py  # NMC MSR thresholds, CBME rules
│   │   │   │   ├── naac_metrics.py   # NAAC 109 metrics calculator
│   │   │   │   └── saf_generator.py  # SAF AI/AII/AIII form generator
│   │   │   ├── admin/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py
│   │   │   │   ├── routes.py
│   │   │   │   ├── schemas.py
│   │   │   │   ├── service.py
│   │   │   │   ├── tasks.py
│   │   │   │   └── fee_engine.py     # Multi-quota fee calculation
│   │   │   ├── integration/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py
│   │   │   │   ├── routes.py
│   │   │   │   ├── aebas/            # AEBAS parallel capture module
│   │   │   │   │   ├── capture.py
│   │   │   │   │   ├── reconciliation.py
│   │   │   │   │   └── report_generator.py
│   │   │   │   ├── hmis/             # Hospital data bridge
│   │   │   │   │   ├── adapters/     # Per-HMIS-vendor adapters
│   │   │   │   │   └── fallback.py   # CSV import fallback
│   │   │   │   ├── payments/         # Razorpay + others
│   │   │   │   └── university/       # Per-university adapters
│   │   │   │       ├── base.py       # Common interface
│   │   │   │       └── adapters/     # RGUHS, VTU, etc.
│   │   │   └── ai/                   # Central AI Engine
│   │   │       ├── __init__.py
│   │   │       ├── gateway.py        # LiteLLM proxy configuration
│   │   │       ├── router.py         # Request classification + routing
│   │   │       ├── rag/
│   │   │       │   ├── pipeline.py   # Hybrid search (vector + BM25 + RRF)
│   │   │       │   ├── embeddings.py # OpenAI embedding client
│   │   │       │   ├── chunker.py    # Medical-aware text chunking
│   │   │       │   └── reranker.py   # Cross-encoder reranking
│   │   │       ├── safety/
│   │   │       │   ├── hallucination_checker.py
│   │   │       │   ├── confidence_scorer.py
│   │   │       │   └── medical_validator.py
│   │   │       ├── agents/
│   │   │       │   ├── socratic_tutor.py
│   │   │       │   ├── compliance_monitor.py
│   │   │       │   ├── content_extractor.py
│   │   │       │   └── flashcard_generator.py
│   │   │       └── prompts/
│   │   │           ├── registry.py   # Versioned prompt management
│   │   │           └── templates/    # Prompt templates per agent
│   │   │
│   │   └── shared/
│   │       ├── models.py             # Base model with college_id, timestamps
│   │       ├── schemas.py            # Shared Pydantic schemas
│   │       └── exceptions.py         # Custom exceptions
│   │
│   ├── tests/
│   │   ├── conftest.py               # Fixtures: test tenants, RLS verification
│   │   ├── test_tenant_isolation.py  # CRITICAL: cross-tenant leak tests
│   │   └── engines/                  # Per-engine test directories
│   │
│   ├── Dockerfile
│   ├── fly.toml
│   ├── requirements.txt
│   └── CLAUDE.md                     # Architecture decisions for Claude Code
│
├── infrastructure/
│   ├── docker-compose.dev.yml        # Local development stack
│   ├── seed/                         # NMC competency database seed data
│   │   ├── competencies_vol1.json    # 1,118 competencies (preclinical)
│   │   ├── competencies_vol2.json    # 1,299 competencies (clinical)
│   │   ├── competencies_vol3.json    # ~900 competencies (surgical)
│   │   ├── aetcom_modules.json       # 27 AETCOM modules, 54 competencies
│   │   ├── nmc_msr_thresholds.json   # Faculty requirements per intake size
│   │   └── naac_metrics.json         # 109 NAAC metrics definitions
│   └── scripts/
│       ├── seed_competencies.py
│       └── create_test_tenant.py
│
├── turbo.json                        # Turborepo configuration
├── package.json                      # Root workspace
└── CLAUDE.md                         # Root-level architecture context
```

### 2.1 Module Boundary Rules

**CRITICAL — enforced via linting and code review:**

1. **Engines NEVER import directly from other engines' internal modules.** All inter-engine calls go through the `__init__.py` public interface.

```python
# ✅ CORRECT — using public interface
from app.engines.compliance import get_compliance_score

# ❌ WRONG — reaching into internal modules
from app.engines.compliance.service import _calculate_msr_ratio
```

2. **Only the Central AI Engine imports LangGraph/LiteLLM.** Other engines call AI through the Central AI Engine's public interface.

```python
# ✅ CORRECT — Faculty Engine requests AI through Central AI Engine
from app.engines.ai import generate_mcq, generate_rubric

# ❌ WRONG — Faculty Engine directly calling LLMs
from langchain_anthropic import ChatAnthropic
```

3. **Shared models/utilities go in `app/shared/`.** If two engines need the same thing, it belongs in shared, not duplicated.

4. **Events are the ONLY way engines communicate asynchronously.** Direct function calls for synchronous requests, Redis Pub/Sub events for fire-and-forget notifications.

---

## 3. Database Architecture

### 3.1 Multi-Tenancy with Row-Level Security

Every table carries `college_id UUID NOT NULL`. FastAPI middleware extracts the tenant from the Clerk JWT and sets the PostgreSQL session variable.

```python
# backend/app/core/database.py

from sqlalchemy.ext.asyncio import AsyncSession

class TenantMiddleware:
    """Sets college_id on every database session for RLS enforcement."""
    
    async def __call__(self, request, call_next):
        college_id = request.state.college_id  # Extracted from Clerk JWT
        
        # Set RLS context for this request
        async with get_session() as session:
            await session.execute(
                text(f"SET app.current_college_id = '{college_id}'")
            )
            request.state.db = session
        
        response = await call_next(request)
        return response
```

```sql
-- RLS policy applied to every table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON students
    USING (college_id = current_setting('app.current_college_id')::uuid);

-- Superadmin bypass for cross-tenant operations (analytics, support)
CREATE POLICY admin_access ON students
    USING (current_setting('app.is_superadmin', true)::boolean = true);
```

### 3.2 Base Model

```python
# backend/app/shared/models.py

from sqlalchemy import Column, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase
import uuid

class Base(DeclarativeBase):
    pass

class TenantModel(Base):
    """Base for all tenant-scoped models."""
    __abstract__ = True
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("colleges.id"), 
        nullable=False, 
        index=True
    )
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))
```

### 3.3 Core Schema — College Configuration

```python
# backend/app/engines/admin/models.py

class College(Base):
    """Top-level tenant entity. NOT tenant-scoped itself."""
    __tablename__ = "colleges"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)  # NMC college code
    
    # Location & Affiliation
    state = Column(String(100), nullable=False)  # Determines fee rules, PT slabs
    district = Column(String(100))
    university_affiliation = Column(String(255))  # e.g., "RGUHS", "MUHS"
    nmc_recognition_status = Column(String(50))   # "Recognized", "Permitted", "Derecognized"
    
    # Intake Configuration
    total_intake = Column(Integer, nullable=False)  # 100, 150, 200, 250
    intake_year_started = Column(Integer)
    
    # NMC Compliance Thresholds (from MSR 2023)
    required_faculty = Column(Integer)     # Calculated from intake
    required_tutors = Column(Integer)      # Calculated from intake
    required_beds = Column(Integer)        # Min 300 for 100 intake
    
    # Feature Flags (tier-based access)
    features = Column(JSONB, default={
        "compliance_engine": True,        # Always on
        "student_engine": False,          # Tier 2
        "faculty_engine": False,          # Tier 2
        "admin_engine": False,            # Tier 2
        "ai_mcq_generator": False,        # Tier 2
        "ai_socratic_tutor": False,       # Tier 3
        "naac_automation": False,         # Tier 3
        "nba_automation": False,          # Tier 3
    })
    
    # College-specific configuration
    config = Column(JSONB, default={
        "fee_regulatory_authority": None,  # "KFRC", "MFRA", etc.
        "academic_calendar_start": "August",
        "exam_pattern": "university",      # "university" or "autonomous"
        "languages": ["en", "hi"],
        "timezone": "Asia/Kolkata",
    })
    
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
```

### 3.4 Core Schema — Per Engine

#### Compliance Engine Tables

```python
# backend/app/engines/compliance/models.py

class ComplianceSnapshot(TenantModel):
    """Daily compliance score snapshot per department."""
    __tablename__ = "compliance_snapshots"
    __table_args__ = (
        UniqueConstraint('college_id', 'department_id', 'snapshot_date'),
        # Partition by month for time-series queries
    )
    
    department_id = Column(UUID, ForeignKey("departments.id"))
    snapshot_date = Column(Date, nullable=False)
    
    # Faculty MSR Compliance
    faculty_required = Column(Integer)
    faculty_actual = Column(Integer)
    faculty_ratio = Column(Float)  # actual/required
    faculty_status = Column(String(10))  # "green", "yellow", "orange", "red"
    
    # Attendance Compliance (from AEBAS data)
    avg_faculty_attendance_pct = Column(Float)
    avg_student_attendance_pct = Column(Float)
    attendance_status = Column(String(10))
    
    # Hospital Infrastructure
    bed_occupancy_pct = Column(Float)
    opd_daily_avg = Column(Integer)
    ipd_daily_avg = Column(Integer)
    
    # Overall Score (weighted composite)
    compliance_score = Column(Float)  # 0-100
    risk_level = Column(String(10))   # "low", "medium", "high", "critical"
    
    # Predictions (from Prophet forecasting)
    predicted_score_30d = Column(Float)
    predicted_score_60d = Column(Float)


class NMCStandard(Base):
    """Reference table: NMC MSR thresholds by intake size. NOT tenant-scoped."""
    __tablename__ = "nmc_standards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intake_size = Column(Integer, nullable=False)  # 100, 150, 200, 250
    department = Column(String(100))
    
    # Faculty Requirements
    min_professors = Column(Integer)
    min_associate_professors = Column(Integer)
    min_assistant_professors = Column(Integer)
    min_tutors_demonstrators = Column(Integer)
    min_senior_residents = Column(Integer)
    
    # Infrastructure Requirements
    min_beds = Column(Integer)
    min_opd_per_day = Column(Integer)
    min_lecture_hall_capacity = Column(Integer)
    min_library_books = Column(Integer)
    min_indian_journals = Column(Integer)
    min_foreign_journals = Column(Integer)
    
    regulation_reference = Column(String(255))  # "UG-MSR 2023, Clause 3.1"
    effective_date = Column(Date)


class SAFSubmission(TenantModel):
    """Tracks SAF form generation and submission status."""
    __tablename__ = "saf_submissions"
    
    form_type = Column(String(10), nullable=False)  # "AI", "AII", "AIII"
    academic_year = Column(String(10))  # "2025-26"
    status = Column(String(20), default="draft")  # draft → generated → reviewed → submitted
    
    # Auto-generated form data (JSONB — complete SAF fields)
    form_data = Column(JSONB)
    
    # Discrepancies detected by AI
    discrepancies = Column(JSONB, default=[])
    
    # Review trail
    generated_at = Column(DateTime(timezone=True))
    generated_by = Column(UUID)  # AI or user who triggered generation
    reviewed_by = Column(UUID)
    reviewed_at = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True))
```

#### Faculty Engine Tables

```python
# backend/app/engines/faculty/models.py

class Competency(Base):
    """NMC CBME competency definitions. NOT tenant-scoped (shared reference)."""
    __tablename__ = "competencies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(20), unique=True, nullable=False)  # "PH 1.5", "AN 2.3"
    subject = Column(String(100), nullable=False)
    topic = Column(String(255))
    description = Column(Text, nullable=False)
    
    # NMC Classification
    level = Column(String(5), nullable=False)  # K, KH, S, SH, P
    is_certifiable = Column(Boolean, default=False)  # True for SH and P
    min_performances = Column(Integer)  # Required count for SH/P competencies
    
    # Bloom's Taxonomy
    blooms_level = Column(String(20))  # Remember, Understand, Apply, Analyze, Evaluate, Create
    domain = Column(String(20))  # Cognitive, Psychomotor, Affective
    
    # Integration Mappings
    horizontal_integrations = Column(JSONB, default=[])  # [{"subject": "Physiology", "competency_codes": ["PY 1.2"]}]
    vertical_integrations = Column(JSONB, default=[])
    
    # Phase
    mbbs_phase = Column(String(10))  # "Phase I", "Phase II", "Phase III"
    
    # AETCOM flag
    is_aetcom = Column(Boolean, default=False)


class LogbookEntry(TenantModel):
    """Student competency logbook entries — the CBME tracking core."""
    __tablename__ = "logbook_entries"
    
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    competency_id = Column(UUID, ForeignKey("competencies.id"), nullable=False)
    
    # Activity Record
    date = Column(Date, nullable=False)
    activity_type = Column(String(20))  # "observation", "assist", "perform"
    performance_count = Column(Integer, default=1)  # How many times performed
    clinical_setting = Column(String(100))  # Ward, OPD, OT, etc.
    patient_consent_obtained = Column(Boolean)
    
    # Evidence
    evidence_url = Column(String(500))  # R2 URL for photo/video evidence
    notes = Column(Text)
    
    # Faculty Verification
    verified_by = Column(UUID, ForeignKey("faculty.id"))
    verified_at = Column(DateTime(timezone=True))
    verification_method = Column(String(20))  # "manual", "qr_code", "batch"
    
    # Sync metadata (for offline mobile entries)
    created_offline = Column(Boolean, default=False)
    synced_at = Column(DateTime(timezone=True))


class QuestionBankItem(TenantModel):
    """Institutional question bank — MCQs, SAQs, LAQs with psychometrics."""
    __tablename__ = "question_bank_items"
    
    # Classification
    question_type = Column(String(20), nullable=False)  # "MCQ", "SAQ", "LAQ", "EMQ", "OSCE"
    competency_id = Column(UUID, ForeignKey("competencies.id"))
    subject = Column(String(100), nullable=False)
    topic = Column(String(255))
    organ_system = Column(String(100))
    
    # Bloom's & Difficulty
    blooms_level = Column(String(20), nullable=False)
    difficulty_rating = Column(Integer)  # 1-5
    
    # Question Content
    stem = Column(Text, nullable=False)  # Clinical vignette
    lead_in = Column(Text)  # "What is the most likely diagnosis?"
    options = Column(JSONB)  # For MCQs: [{text, is_correct, explanation}]
    correct_answer = Column(Text)  # For SAQ/LAQ: model answer
    
    # Rubric (for SAQ/LAQ)
    rubric = Column(JSONB)  # [{criterion, max_marks, description, expected_points}]
    total_marks = Column(Integer)
    
    # Provenance
    source = Column(String(20), default="human")  # "human", "ai_assisted", "ai_generated"
    created_by = Column(UUID)  # Faculty who created/approved
    
    # Lifecycle
    status = Column(String(20), default="draft")  # draft → peer_reviewed → approved → active → retired
    version = Column(Integer, default=1)
    
    # Psychometric Data (populated after use in exams)
    times_used = Column(Integer, default=0)
    difficulty_index = Column(Float)  # p-value: optimal 0.3-0.7
    discrimination_index = Column(Float)  # ≥0.20 acceptable
    point_biserial = Column(Float)
    non_functional_distractors = Column(Integer)
    
    # AETCOM flag
    is_aetcom = Column(Boolean, default=False)
    
    # NMC Compliance
    nmc_compliant = Column(Boolean, default=True)  # Checked against MCQ 20% cap, etc.


class ClinicalRotation(TenantModel):
    """Student clinical posting/rotation schedule."""
    __tablename__ = "clinical_rotations"
    
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    department_id = Column(UUID, ForeignKey("departments.id"), nullable=False)
    batch_id = Column(UUID, ForeignKey("batches.id"))
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    # NMC Requirements
    required_hours = Column(Integer)
    completed_hours = Column(Integer, default=0)
    
    # Assessment
    posting_assessment_score = Column(Float)
    assessed_by = Column(UUID, ForeignKey("faculty.id"))
    assessed_at = Column(DateTime(timezone=True))
    
    status = Column(String(20), default="scheduled")  # scheduled → active → completed → assessed
```

#### Admin Engine Tables

```python
# backend/app/engines/admin/models.py

class Student(TenantModel):
    """Student master record."""
    __tablename__ = "students"
    
    # Personal
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    date_of_birth = Column(Date)
    gender = Column(String(20))
    aadhaar_hash = Column(String(64))  # SHA-256 hash, never store raw Aadhaar
    
    # Admission
    neet_roll_number = Column(String(20))
    neet_score = Column(Integer)
    neet_rank = Column(Integer)
    neet_percentile = Column(Float)
    admission_quota = Column(String(30))  # "AIQ", "State", "Management", "NRI", "Institutional"
    admission_year = Column(Integer)
    
    # Academic
    current_phase = Column(String(10))  # "Phase I", "Phase II", "Phase III", "CRMI"
    current_semester = Column(Integer)
    enrollment_number = Column(String(50))
    university_registration_number = Column(String(50))
    
    # Status
    status = Column(String(20), default="active")  # active, suspended, rusticated, graduated, dropped
    
    # Clerk auth
    clerk_user_id = Column(String(255), unique=True)


class Faculty(TenantModel):
    """Faculty master record."""
    __tablename__ = "faculty"
    
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    
    # NMC Classification
    designation = Column(String(50))  # Professor, Associate Prof, Assistant Prof, Tutor, SR
    department_id = Column(UUID, ForeignKey("departments.id"), nullable=False)
    qualification = Column(String(100))  # MD, MS, DNB, PhD
    specialization = Column(String(100))
    
    # NMC Compliance Fields
    nmc_faculty_id = Column(String(50))  # NMC portal faculty ID
    aebas_id = Column(String(50))  # AEBAS biometric ID
    date_of_joining = Column(Date)
    date_of_birth = Column(Date)
    retirement_date = Column(Date)  # Calculated: DOB + 70 years
    
    # Experience
    teaching_experience_years = Column(Float)
    clinical_experience_years = Column(Float)
    
    # Qualification Validation (NMC Faculty Qualification Rules 2025)
    qualification_validated = Column(Boolean, default=False)
    is_eligible_per_nmc = Column(Boolean, default=True)
    validation_notes = Column(Text)
    
    # Status
    status = Column(String(20), default="active")
    employment_type = Column(String(20))  # "permanent", "contractual", "visiting", "adjunct"
    
    clerk_user_id = Column(String(255), unique=True)


class FeeStructure(TenantModel):
    """Fee configuration per quota per academic year."""
    __tablename__ = "fee_structures"
    
    academic_year = Column(String(10), nullable=False)  # "2025-26"
    quota = Column(String(30), nullable=False)  # "AIQ", "State", "Management", "NRI"
    
    # Fee Components (all in INR)
    tuition_fee = Column(BigInteger, nullable=False)
    development_fee = Column(BigInteger, default=0)
    hostel_fee = Column(BigInteger, default=0)
    mess_fee = Column(BigInteger, default=0)
    exam_fee = Column(BigInteger, default=0)
    library_fee = Column(BigInteger, default=0)
    lab_fee = Column(BigInteger, default=0)
    caution_deposit = Column(BigInteger, default=0)  # Refundable
    admission_charges = Column(BigInteger, default=0)  # One-time
    
    # Regulatory
    fee_regulatory_cap = Column(BigInteger)  # State FRC cap if applicable
    approved_by = Column(String(255))  # "KFRC", "KEA", etc.
    
    
class FeePayment(TenantModel):
    """Individual fee payment records."""
    __tablename__ = "fee_payments"
    
    student_id = Column(UUID, ForeignKey("students.id"), nullable=False)
    fee_structure_id = Column(UUID, ForeignKey("fee_structures.id"))
    
    amount = Column(BigInteger, nullable=False)  # In paisa for precision
    payment_method = Column(String(20))  # "upi", "netbanking", "card", "neft", "dd", "cash"
    razorpay_payment_id = Column(String(100))
    razorpay_order_id = Column(String(100))
    
    status = Column(String(20), default="pending")  # pending → captured → refunded → failed
    
    fee_component = Column(String(50))  # "tuition", "hostel", "exam", etc.
    semester = Column(Integer)
    installment_number = Column(Integer)
    
    receipt_number = Column(String(50), unique=True)
    receipt_url = Column(String(500))  # R2 URL to generated receipt PDF
```

### 3.5 Schema Organization

```
PostgreSQL (Neon)
├── public schema (all tables)
│   ├── colleges (not tenant-scoped)
│   ├── competencies (not tenant-scoped — shared NMC reference data)
│   ├── nmc_standards (not tenant-scoped)
│   ├── naac_metrics (not tenant-scoped)
│   │
│   ├── students (tenant-scoped via college_id + RLS)
│   ├── faculty (tenant-scoped)
│   ├── departments (tenant-scoped)
│   ├── logbook_entries (tenant-scoped)
│   ├── question_bank_items (tenant-scoped)
│   ├── clinical_rotations (tenant-scoped)
│   ├── compliance_snapshots (tenant-scoped + partitioned by month)
│   ├── attendance_records (tenant-scoped + partitioned by month)
│   ├── fee_structures (tenant-scoped)
│   ├── fee_payments (tenant-scoped)
│   ├── saf_submissions (tenant-scoped)
│   │
│   ├── document_embeddings (tenant-scoped — pgvector)
│   │   └── HNSW index on embedding column
│   │
│   └── audit_log (tenant-scoped + partitioned by month)
│       └── Immutable append-only table
│
├── Extensions
│   ├── pgvector
│   ├── pg_partman
│   ├── pgcrypto
│   └── pg_trgm (trigram for fuzzy search)
```

### 3.6 Estimated Table Count Per Engine

| Engine | Tables | Key Tables |
|--------|--------|-----------|
| Admin | ~25 | students, faculty, departments, batches, fee_structures, fee_payments, scholarships, certificates, hostel_rooms, hostel_allocations |
| Faculty | ~20 | competencies, logbook_entries, question_bank_items, clinical_rotations, lesson_plans, assessments, assessment_results, osce_stations, exam_papers |
| Compliance | ~10 | compliance_snapshots, saf_submissions, nmc_standards, inspection_readiness, discrepancy_reports |
| Student | ~15 | study_sessions, flashcards, flashcard_reviews, practice_tests, test_attempts, pdf_annotations, chat_sessions, metacognitive_events |
| Integration | ~8 | attendance_records, hmis_data_points, payment_transactions, university_sync_logs |
| AI | ~5 | ai_requests, ai_responses, prompt_versions, embedding_chunks, feedback_logs |
| Shared | ~5 | colleges, users, roles, audit_log, notifications |
| **Total** | **~88** | |

---

## 4. Central AI Engine

### 4.1 Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  Layer 1: LiteLLM Proxy (AI Gateway)            │
│  Unified API → routes to Claude/GPT/Haiku       │
│  Per-tenant cost tracking + budgets              │
│  Retry/fallback + model load balancing           │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Layer 2: Request Router (LangGraph)             │
│  Classifies incoming request → routes to agent   │
│  Uses Haiku/GPT-4o-mini (fast, cheap)            │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Layer 3: Specialized Agents (LangGraph)         │
│  Each agent = StateGraph with typed state,       │
│  conditional edges, human-in-the-loop checkpoints│
│                                                  │
│  Student Agents:                                 │
│    Socratic Tutor, Flashcard Generator,          │
│    Practice Test Generator, Content Extractor     │
│                                                  │
│  Faculty Agents:                                 │
│    MCQ Generator, SAQ/LAQ + Rubric Generator,    │
│    Lesson Plan Generator, Rotation Scheduler,    │
│    OSCE Scenario Creator                         │
│                                                  │
│  Compliance Agents:                              │
│    Compliance Monitor, SAF Auto-Generator,       │
│    Discrepancy Detector, Prediction Engine        │
│                                                  │
│  Admin Agents:                                   │
│    Scholarship Matcher, Document OCR,            │
│    Circular Drafter, Report Generator             │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Layer 4: Shared Services                        │
│  Medical RAG Pipeline (pgvector + BM25 + RRF)   │
│  AI Safety Pipeline (hallucination checker)      │
│  Prompt Registry (versioned, tenant-customizable)│
│  Cost Manager (per-tenant budgets)               │
└─────────────────────────────────────────────────┘
```

### 4.2 Model Selection Strategy

| Task | Model | Approx Cost/1M tokens | Rationale |
|------|-------|----------------------|-----------|
| Clinical reasoning, MCQ generation, Socratic tutoring | **Claude Sonnet 4** | ~$3 in / $15 out | Best instruction-following + safety for medical content |
| Medical content validation (Year 2) | Self-hosted medical LLM | Inference cost | Deferred — API models for launch |
| Data extraction, structured output (SAF forms, fee calc) | **GPT-4o** | ~$2.50 in / $10 out | Strong schema adherence for compliance reports |
| Intent classification, routing, simple tagging | **Claude Haiku / GPT-4o-mini** | ~$0.25 in / $1.25 out | Fast + cheap; sufficient for routing |
| Embeddings | **OpenAI text-embedding-3-large** | $0.13/M tokens | 1536 dims; no GPU; migrate to MedCPT Year 2 |
| Batch MCQ generation, report processing | **Claude Batch API** | 50% discount | Non-urgent bulk operations |

### 4.3 LiteLLM Configuration

```python
# backend/app/engines/ai/gateway.py

LITELLM_CONFIG = {
    "model_list": [
        {
            "model_name": "medical-reasoning",
            "litellm_params": {
                "model": "anthropic/claude-sonnet-4-20250514",
                "api_key": "os.environ/ANTHROPIC_API_KEY",
                "max_tokens": 4096,
            }
        },
        {
            "model_name": "structured-extraction",
            "litellm_params": {
                "model": "openai/gpt-4o",
                "api_key": "os.environ/OPENAI_API_KEY",
            }
        },
        {
            "model_name": "fast-classification",
            "litellm_params": {
                "model": "anthropic/claude-haiku",
                "api_key": "os.environ/ANTHROPIC_API_KEY",
            }
        },
    ],
    "general_settings": {
        "master_key": "os.environ/LITELLM_MASTER_KEY",
    },
    "litellm_settings": {
        "cache": True,
        "cache_params": {
            "type": "redis",
            "host": "os.environ/REDIS_HOST",
        },
        # Per-tenant budgets
        "max_budget": 100,  # Default $100/month per tenant
        "budget_duration": "1mo",
    }
}
```

### 4.4 Medical RAG Pipeline

```python
# backend/app/engines/ai/rag/pipeline.py

class MedicalRAGPipeline:
    """Hybrid search: vector + BM25 + Reciprocal Rank Fusion."""
    
    async def retrieve(
        self,
        query: str,
        college_id: uuid.UUID,
        filters: dict = None,  # subject, competency_code, blooms_level, organ_system
        top_k: int = 10,
    ) -> list[RetrievedChunk]:
        
        # 1. Generate query embedding
        query_embedding = await self.embed(query)  # OpenAI text-embedding-3-large
        
        # 2. Vector search (pgvector HNSW)
        vector_results = await self.vector_search(
            embedding=query_embedding,
            college_id=college_id,
            filters=filters,
            limit=top_k * 3,  # Over-retrieve for RRF
        )
        
        # 3. BM25 sparse search (PostgreSQL FTS)
        bm25_results = await self.bm25_search(
            query=query,
            college_id=college_id,
            filters=filters,
            limit=top_k * 3,
        )
        
        # 4. Reciprocal Rank Fusion
        fused = self.reciprocal_rank_fusion(
            vector_results, bm25_results, k=60
        )
        
        # 5. Return top_k
        return fused[:top_k]
    
    def reciprocal_rank_fusion(self, *result_lists, k=60):
        """RRF score = Σ(1/(k + rank_i)). No parameter tuning needed."""
        scores = {}
        for results in result_lists:
            for rank, doc in enumerate(results):
                if doc.id not in scores:
                    scores[doc.id] = {"doc": doc, "score": 0}
                scores[doc.id]["score"] += 1 / (k + rank + 1)
        
        return sorted(scores.values(), key=lambda x: x["score"], reverse=True)
```

**Chunking strategy:** 512-1024 tokens with 20% overlap, tagged with:
- `college_id` (tenant isolation)
- `subject` (Anatomy, Pharmacology, etc.)
- `competency_code` (NMC code e.g., "PH 1.5")
- `organ_system` (cardiovascular, respiratory, etc.)
- `content_type` (textbook, lecture_note, clinical_case, guideline)
- `blooms_level` (for filtered retrieval during MCQ generation)

### 4.5 AI Safety Pipeline

```python
# backend/app/engines/ai/safety/pipeline.py

class MedicalAISafetyPipeline:
    """Multi-layer safety for medical content generation."""
    
    async def validate(self, content: AIGeneratedContent) -> SafetyResult:
        # Layer 1: Source verification
        source_check = await self.verify_against_sources(
            content.text, content.rag_sources
        )
        
        # Layer 2: Confidence scoring (multi-model ensemble variance)
        confidence = await self.score_confidence(content)
        
        # Layer 3: Route by confidence
        if confidence.score > 0.95:
            return SafetyResult(
                status="auto_approved",
                confidence=confidence.score,
                for_review=False,
                content_type="formative"  # Only auto-approve formative
            )
        elif confidence.score > 0.80:
            return SafetyResult(
                status="needs_review",
                confidence=confidence.score,
                for_review=True,
                review_reason=confidence.low_confidence_areas
            )
        else:
            return SafetyResult(
                status="rejected",
                confidence=confidence.score,
                for_review=False,
                rejection_reason=confidence.failure_reasons
            )
    
    async def score_confidence(self, content: AIGeneratedContent) -> ConfidenceScore:
        """CHECK-style ensemble: run same content through 2+ models, measure variance."""
        responses = await asyncio.gather(
            self.litellm.complete("medical-reasoning", content.verification_prompt),
            self.litellm.complete("structured-extraction", content.verification_prompt),
        )
        
        # High variance between models = low confidence
        agreement = self.calculate_agreement(responses)
        return ConfidenceScore(score=agreement, details=responses)
```

### 4.6 Key Agent: MCQ Generation

```python
# backend/app/engines/faculty/agents/mcq_generator.py

from langgraph.graph import StateGraph, END

class MCQGeneratorState(TypedDict):
    competency_code: str
    target_difficulty: int  # 1-5
    target_blooms: str
    question_type: str  # "MCQ", "SAQ", "LAQ"
    college_id: str
    
    # Pipeline outputs
    rag_context: list[str]
    generated_question: dict
    quality_gates: dict
    safety_result: dict
    final_output: dict

def build_mcq_generator_graph():
    graph = StateGraph(MCQGeneratorState)
    
    # Nodes
    graph.add_node("retrieve_context", retrieve_medical_context)
    graph.add_node("generate_question", generate_question_with_llm)
    graph.add_node("check_item_writing", check_nbme_item_writing_standards)
    graph.add_node("check_medical_accuracy", check_medical_accuracy)
    graph.add_node("check_blooms_alignment", verify_blooms_level)
    graph.add_node("safety_check", run_safety_pipeline)
    graph.add_node("format_output", format_final_output)
    
    # Edges
    graph.add_edge("retrieve_context", "generate_question")
    graph.add_edge("generate_question", "check_item_writing")
    graph.add_edge("check_item_writing", "check_medical_accuracy")
    graph.add_edge("check_medical_accuracy", "check_blooms_alignment")
    graph.add_edge("check_blooms_alignment", "safety_check")
    
    # Conditional: safety passed → format, failed → regenerate (max 3 attempts)
    graph.add_conditional_edges(
        "safety_check",
        lambda state: "format_output" if state["safety_result"]["status"] != "rejected" else "generate_question",
    )
    graph.add_edge("format_output", END)
    
    graph.set_entry_point("retrieve_context")
    return graph.compile()
```

### 4.7 Key Agent: SAQ/LAQ Rubric Generation

```python
# backend/app/engines/faculty/agents/saq_rubric_generator.py

async def generate_saq_with_rubric(
    competency_code: str,
    question_type: str,  # "SAQ" (5 marks) or "LAQ" (10 marks)
    blooms_level: str,
    college_id: str,
) -> dict:
    """
    Bridge Layer approach to assessment:
    - AI generates question + structured rubric
    - Student crafts their own answer
    - Rubric serves as self-assessment tool AND faculty evaluation guide
    """
    
    # 1. Retrieve competency details + relevant medical content
    competency = await get_competency(competency_code)
    rag_context = await rag_pipeline.retrieve(
        query=f"{competency.subject} {competency.topic} {competency.description}",
        college_id=college_id,
        filters={"competency_code": competency_code},
    )
    
    # 2. Generate question stem (clinical vignette for higher Bloom's)
    # 3. Generate structured rubric
    
    prompt = f"""Generate a {question_type} ({5 if question_type == 'SAQ' else 10} marks) for:
    Competency: {competency.code} — {competency.description}
    Bloom's Level: {blooms_level}
    Subject: {competency.subject}
    
    Medical Context:
    {format_rag_context(rag_context)}
    
    Output JSON with:
    1. "question_stem": Clinical vignette appropriate to Bloom's level
    2. "rubric": Array of marking criteria, each with:
       - "criterion": What is being evaluated
       - "max_marks": Points for this criterion
       - "expected_points": Array of specific points the answer should cover
       - "depth_expected": How much detail is needed
    3. "model_answer_outline": Key points (NOT a full answer — just structure)
    4. "common_mistakes": What students typically get wrong
    """
    
    result = await litellm_complete("medical-reasoning", prompt)
    
    return {
        "question": result["question_stem"],
        "rubric": result["rubric"],
        "model_answer_outline": result["model_answer_outline"],
        "common_mistakes": result["common_mistakes"],
        "competency_code": competency_code,
        "blooms_level": blooms_level,
        "total_marks": 5 if question_type == "SAQ" else 10,
        "source": "ai_generated",
        "safety_status": "needs_review",  # Always faculty review for assessment content
    }
```

### 4.8 Cost Management

**Prompt caching:** Structure prompts with static medical guidelines/NMC competency data as cached prefix (90% cost reduction on cached tokens), dynamic content as suffix.

**Per-tenant budgets via LiteLLM:**
- Student Engine: 60% of budget (highest usage — Socratic tutor, practice tests)
- Faculty Engine: 20% (MCQ generation, rubrics, lesson plans)
- Compliance Engine: 10% (SAF generation, monitoring — mostly batch)
- Admin Engine: 10% (document OCR, circular drafting)

**Automatic model downgrade:** When tenant approaches monthly budget, LiteLLM routes Sonnet requests to Haiku. Critical compliance requests exempt from downgrade.

### 4.9 Langfuse Monitoring

Self-hosted Langfuse on Fly.io for AI observability:
- Trace every agent execution (input, output, duration, cost)
- Track quality metrics per agent (acceptance rate, revision rate)
- Monitor token usage per tenant, per engine
- Alert on anomalies (sudden cost spike, low confidence scores)
- 50K free events/month on self-hosted tier

---

## 5. Engine Specifications

### 5.1 Compliance Engine — Jason's Starting Point

**Why this ships first:** 349 colleges have received show-cause notices. 500+ fail MSR requirements. A single 50-seat reduction costs ₹16-82 crore. This is the fear that opens the door.

**Tier 1 Features (Build First):**

| Feature | What It Does | Data Sources | Build Complexity |
|---------|-------------|-------------|-----------------|
| Faculty MSR Dashboard | Real-time faculty count vs NMC requirements per department | Faculty table + nmc_standards | Low |
| AEBAS Compliance Dashboard | Attendance % per department with threshold alerts | attendance_records (parallel capture) | Moderate |
| SAF Auto-Generator | Pre-populates SAF AI/AII/AIII forms from platform data | All engines via public interfaces | High |
| Inspection Readiness Score | Composite compliance score with prediction | compliance_snapshots + Prophet | Moderate |

**Standalone Operation:** Compliance Engine must deliver value WITHOUT student/faculty engines being active. When other engines are absent, it ingests data from:
- CSV uploads (faculty roster, attendance exports)
- Manual dashboard entry (bed count, OPD numbers)
- API pulls from existing systems (if available)

When Acolyte's own engines are present, it seamlessly consumes their data through public interfaces. The API contracts in Section 12 define both paths.

### 5.2 Student Engine — Subha's Domain

**Core Features:**

| Feature | Mobile Priority | Offline Required |
|---------|----------------|-----------------|
| PDF Viewer + Annotations | Critical | Yes (chapter-level caching) |
| Flashcard System (spaced repetition) | Critical | Yes |
| Practice Tests (AI-generated) | High | Partial (cache generated tests) |
| Socratic AI Chat | High | No (requires AI) |
| Competency Logbook | Critical | Yes (sync on reconnect) |
| Metacognitive Analytics Dashboard | Medium | No |
| Clinical Procedure Logger | High | Yes |

### 5.3 Faculty Engine — Split Between Subha (Frontend) and Jason (Backend Logic)

**Assessment Lifecycle:**
Faculty selects competency + Bloom's level + question type → AI generates question + rubric → Faculty reviews/edits → Enters question bank → Used in exam paper assembly → Post-exam psychometric analysis runs automatically.

**CBME Logbook Management:**
Batch sign-off capability (one faculty → 150+ students). QR-code verification at point of care. Competency heat maps per student/cohort/department.

---

## 6. Frontend Architecture

### 6.1 Next.js 15 — Role-Based Routing

```
app/
├── (auth)/
│   ├── sign-in/
│   └── sign-up/
├── (dashboard)/
│   ├── layout.tsx          # Shared sidebar + header, role-based navigation
│   │
│   ├── student/
│   │   ├── dashboard/      # Overview: attendance, upcoming tests, competency progress
│   │   ├── study/          # PDF viewer, notes, flashcards
│   │   ├── practice/       # AI practice tests, performance analytics
│   │   ├── logbook/        # Competency tracking
│   │   └── chat/           # Socratic AI tutor
│   │
│   ├── faculty/
│   │   ├── dashboard/      # Teaching load, pending reviews, class overview
│   │   ├── assessments/    # Question bank, exam paper builder, psychometrics
│   │   ├── logbook/        # Batch logbook sign-off
│   │   ├── rotations/      # Clinical posting management
│   │   ├── students/       # Student performance, at-risk alerts
│   │   └── content/        # Lesson plans, study materials
│   │
│   ├── admin/
│   │   ├── dashboard/      # Operational overview
│   │   ├── students/       # SIS: admission, enrollment, records
│   │   ├── faculty/        # HR: faculty roster, qualifications, payroll
│   │   ├── fees/           # Fee management, scholarships, receipts
│   │   └── hostel/         # Room allocation, mess management
│   │
│   ├── compliance/
│   │   ├── dashboard/      # Compliance score, risk heatmap
│   │   ├── msr/            # Faculty MSR tracker
│   │   ├── attendance/     # AEBAS compliance analytics
│   │   ├── saf/            # SAF form generator + submission tracker
│   │   ├── inspection/     # Inspection readiness simulator
│   │   └── naac/           # NAAC metric tracker + SSR generator
│   │
│   └── management/         # Dean / Trust Chairman view
│       ├── dashboard/      # Executive summary: revenue, compliance, rankings
│       ├── analytics/      # Cross-department comparisons
│       └── reports/        # Generated reports, board presentations
```

### 6.2 Key Frontend Libraries

```json
{
  "dependencies": {
    "next": "^15",
    "@clerk/nextjs": "latest",
    "@tanstack/react-query": "^5",
    "@tremor/react": "latest",
    "recharts": "^2",
    "zod": "^3",
    "react-hook-form": "^7",
    "@hookform/resolvers": "latest"
  }
}
```

### 6.3 Real-Time Updates via SSE

Compliance dashboard, attendance counts, and notification streams use Server-Sent Events (not WebSocket — simpler, sufficient for our use case).

```typescript
// apps/web/lib/sse-client.ts
export function useComplianceStream(collegeId: string) {
  const [score, setScore] = useState<ComplianceScore | null>(null);
  
  useEffect(() => {
    const eventSource = new EventSource(
      `${API_URL}/api/v1/compliance/stream?college_id=${collegeId}`
    );
    
    eventSource.onmessage = (event) => {
      setScore(JSON.parse(event.data));
    };
    
    return () => eventSource.close();
  }, [collegeId]);
  
  return score;
}
```

---

## 7. Mobile Architecture

### 7.1 Expo (React Native) SDK 52+ with New Architecture

**Target devices:** ₹8K-15K Android phones (2-3GB RAM, Android 10+)
**Target APK:** Under 30MB

**Key optimizations:**
- Hermes AOT compilation (default in SDK 52+)
- New Architecture (Fabric + TurboModules) — 20-40% faster startup, 30% less memory
- ProGuard/R8 for APK shrinkage
- FlatList with `windowSize={5}`, `maxToRenderPerBatch={5}`
- `InteractionManager.runAfterInteractions()` for deferred heavy work
- `react-native-mmkv` for fast key-value storage

### 7.2 Offline-First with PowerSync

```typescript
// apps/mobile/lib/powersync/schema.ts

import { column, Schema, Table } from '@powersync/react-native';

const logbookEntries = new Table({
  competency_code: column.text,
  activity_type: column.text,
  performance_count: column.integer,
  date: column.text,
  clinical_setting: column.text,
  notes: column.text,
  verified: column.integer, // 0 or 1
  created_offline: column.integer,
}, { indexes: { by_competency: ['competency_code'] } });

const flashcardReviews = new Table({
  flashcard_id: column.text,
  is_correct: column.integer,
  time_spent: column.integer,
  difficulty: column.text,
  reviewed_date: column.text,
});

const studyMaterials = new Table({
  subject: column.text,
  topic: column.text,
  content_type: column.text,
  r2_url: column.text,
  local_path: column.text, // Cached file location
  downloaded: column.integer,
});

export const AppSchema = new Schema({
  logbook_entries: logbookEntries,
  flashcard_reviews: flashcardReviews,
  study_materials: studyMaterials,
});
```

**Sync rules:** Bidirectional for logbook entries, flashcard progress, clinical logs. Server-to-client for study materials, practice questions. Local-only for user preferences (MMKV).

**Conflict resolution:** Logbook entries use last-write-wins (student is sole author). Attendance is server-authoritative (faculty confirms). Practice test responses are immutable once submitted.

### 7.3 PDF Rendering for Medical Textbooks

**Problem:** Harrison's at 200MB+ won't load on a 2GB RAM phone.

**Solution:** Server-side chapter splitting.

```python
# backend/app/engines/student/service.py

async def process_textbook_upload(file: UploadFile, college_id: str):
    """Split large PDFs into chapters, upload individually to R2."""
    
    # 1. Split by bookmarks/chapters using PyMuPDF
    chapters = split_pdf_by_bookmarks(file)  # Returns list of chapter PDFs (2-20MB each)
    
    # 2. Upload each chapter to R2
    for chapter in chapters:
        r2_key = f"{college_id}/textbooks/{file.filename}/{chapter.name}.pdf"
        await r2_client.upload(r2_key, chapter.data)
    
    # 3. Generate embeddings for each chapter
    for chapter in chapters:
        chunks = chunk_text(chapter.text, chunk_size=1024, overlap=0.2)
        embeddings = await embed_batch(chunks)
        await store_embeddings(embeddings, college_id, metadata={
            "source": file.filename,
            "chapter": chapter.name,
        })
```

Mobile renders with `react-native-pdf-jsi` — 80x faster than `react-native-pdf`, constant ~2MB memory via on-demand page rendering.

### 7.4 Hindi/English Bilingual

```typescript
// apps/mobile/lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: require('./locales/en.json') },
    hi: { translation: require('./locales/hi.json') },
  },
  lng: 'en',
  fallbackLng: 'en',
});

// expo-font loads Noto Sans Devanagari for consistent Hindi rendering
```

---

## 8. Integration Architecture

### 8.1 AEBAS — Parallel Capture Strategy

**No public API exists.** This is confirmed. No existing ERP has direct integration either.

**Our approach (the moat):**

```
┌──────────────────────────────────────────┐
│  AEBAS (NMC System)                      │
│  Face-based auth + GPS geofencing        │
│  Data flows to NMC portal only           │
│  Colleges access via college subdomain   │
└──────────┬───────────────────────────────┘
           │ (No API — manual data only)
           │
┌──────────▼───────────────────────────────┐
│  ACOLYTE PARALLEL CAPTURE                │
│                                          │
│  Option A: Faculty marks attendance in   │
│  Acolyte app simultaneously (dual entry) │
│                                          │
│  Option B: CSV/PDF export from AEBAS     │
│  portal → upload to Acolyte → parsed     │
│                                          │
│  Option C: Automated browser scraping    │
│  of college AEBAS portal (Year 2)        │
│                                          │
│  All options feed into:                  │
│  attendance_records table                │
└──────────┬───────────────────────────────┘
           │
┌──────────▼───────────────────────────────┐
│  RECONCILIATION DASHBOARD                │
│  Side-by-side: Acolyte records vs        │
│  AEBAS data (manually uploaded)          │
│  Flags discrepancies for review          │
└──────────────────────────────────────────┘
```

**AEBAS data fields we capture in parallel:**
- `faculty_id` / `student_id`
- `timestamp`
- `verification_method` ("face", "fingerprint", "manual")
- `gps_latitude`, `gps_longitude`
- `department_id`
- `shift` ("morning", "afternoon", "evening")
- `aebas_sync_status` ("pending", "synced", "discrepancy")

### 8.2 HMIS (Hospital) Integration

```python
# backend/app/engines/integration/hmis/base.py

class HMISAdapter(ABC):
    """Abstract base for hospital data integration.
    Each HMIS vendor gets its own adapter implementation."""
    
    @abstractmethod
    async def get_bed_count(self, department: str = None) -> BedCount:
        """Current bed occupancy."""
        pass
    
    @abstractmethod
    async def get_opd_count(self, date_range: DateRange) -> OPDStats:
        """OPD patient count per department."""
        pass
    
    @abstractmethod
    async def get_ipd_count(self, date_range: DateRange) -> IPDStats:
        """IPD admissions per department."""
        pass
    
    @abstractmethod
    async def get_surgery_count(self, date_range: DateRange) -> SurgeryStats:
        """Surgeries by type per department."""
        pass


class CSVFallbackAdapter(HMISAdapter):
    """When hospital HMIS has no API — CSV upload fallback.
    Admin uploads monthly data via CSV template we provide."""
    
    async def import_csv(self, file: UploadFile) -> ImportResult:
        df = pd.read_csv(file.file)
        validated = self.validate_schema(df)
        records = self.transform_to_hmis_records(validated)
        await self.bulk_insert(records)
        return ImportResult(imported=len(records), errors=validated.errors)


class ManualDashboardAdapter(HMISAdapter):
    """Real-time manual entry dashboard for hospitals with no digital system."""
    
    # Admin enters daily: bed count, OPD count, IPD count, surgery count
    # per department via a simple form
    pass
```

### 8.3 Payment Gateway (Razorpay)

```python
# backend/app/engines/integration/payments/razorpay_client.py

class AcolytePaymentGateway:
    """Fee collection via Razorpay with multi-quota support."""
    
    async def create_fee_order(
        self,
        student_id: str,
        fee_components: list[FeeComponent],
        college_id: str,
    ) -> RazorpayOrder:
        """Creates Razorpay order for fee payment."""
        
        total = sum(fc.amount for fc in fee_components)
        
        order = await razorpay.order.create({
            "amount": total * 100,  # Razorpay uses paisa
            "currency": "INR",
            "receipt": f"FEE-{college_id[:8]}-{student_id[:8]}-{timestamp}",
            "notes": {
                "college_id": college_id,
                "student_id": student_id,
                "components": [fc.name for fc in fee_components],
            }
        })
        
        return order
    
    async def handle_webhook(self, payload: dict):
        """Razorpay webhook: payment.captured, payment.failed, refund.processed."""
        event = payload["event"]
        
        if event == "payment.captured":
            await self.record_payment(payload["payload"]["payment"])
            await self.generate_receipt(payload)  # PDF receipt to R2
            await self.publish_event("payment.captured", payload)
        
        elif event == "refund.processed":
            await self.record_refund(payload)
```

### 8.4 University Portal Adapters

```python
# backend/app/engines/integration/university/base.py

class UniversityAdapter(ABC):
    """Per-university adapter. Most accept CSV/Excel upload."""
    
    @abstractmethod
    async def export_student_data(self, format: str = "csv") -> bytes:
        """Export student records in university-expected format."""
        pass
    
    @abstractmethod
    async def export_exam_results(self, exam_id: str) -> bytes:
        """Export results in university format."""
        pass

class RGUHSAdapter(UniversityAdapter):
    """Rajiv Gandhi University of Health Sciences — Karnataka."""
    # RGUHS-specific CSV format for exam registration, results, etc.
    pass

class GenericCSVAdapter(UniversityAdapter):
    """Universal fallback — generates standard CSV that works for most universities."""
    pass
```

---

## 9. DevOps & Infrastructure

### 9.1 Fly.io Deployment

```toml
# backend/fly.toml

app = "acolyte-api"
primary_region = "bom"  # Mumbai — CRITICAL: pin to India

[build]
  dockerfile = "Dockerfile"

[deploy]
  release_command = "alembic upgrade head"

[env]
  ENVIRONMENT = "production"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false  # Always-on for production
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  internal_port = 8000
  protocol = "tcp"
  
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.http_checks]]
    interval = 30000
    timeout = 5000
    path = "/health"
```

### 9.2 Fly.io Services

| Service | CPU | Memory | Scaling | Est. Monthly |
|---------|-----|--------|---------|-------------|
| acolyte-api | 1 shared | 2048 MB | min 1, auto-scale to 3 | ~$30 |
| acolyte-worker | 1 shared | 1024 MB | 1 always-on | ~$15 |
| acolyte-beat | 1 shared | 512 MB | NEVER >1 | ~$8 |
| acolyte-litellm | 1 shared | 512 MB | 1 always-on | ~$8 |
| acolyte-langfuse | 1 shared | 512 MB | 1 always-on | ~$8 |

### 9.3 CI/CD Pipeline (GitHub Actions)

**Trunk-based development:** `main` is always deployable. Short-lived feature branches (<1 day) with PR review. Feature flags via Unleash decouple deployment from release.

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend
on:
  push:
    branches: [main]
    paths: ['backend/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          cd backend
          pip install -r requirements-test.txt
          pytest tests/ -v --tb=short
      - name: Verify tenant isolation
        run: pytest tests/test_tenant_isolation.py -v

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        working-directory: backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

```yaml
# .github/workflows/deploy-frontend.yml
# Vercel auto-deploys on push — this just runs tests
name: Frontend CI
on:
  push:
    branches: [main]
    paths: ['apps/web/**', 'packages/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx turbo run lint type-check --filter=web
```

### 9.4 Database Migrations — Single Owner

**Only the FastAPI backend runs Alembic.** All schema changes go through one migration configuration. Run as pre-deploy CI step (Fly.io `release_command`), not at app startup.

```bash
# Creating a new migration
cd backend
alembic revision --autogenerate -m "add_logbook_entries_table"

# Review generated migration (ALWAYS review auto-generated migrations)
# Ensure both upgrade() and downgrade() are correct

# Apply locally against Neon branch
alembic upgrade head
```

**Neon branching for safe migrations:**
1. Create Neon branch from production
2. Run migration against branch
3. Test application against branch database
4. If pass → merge to main → deploy applies migration to production
5. Delete branch

### 9.5 Monitoring Stack

| Tool | Purpose | Tier |
|------|---------|------|
| **Sentry** | Error tracking + performance monitoring | Free (5K events/mo) |
| **BetterStack** | Uptime monitoring + status page + incident management | Starter (~$24/mo) |
| **Langfuse** | AI agent observability (traces, costs, quality) | Self-hosted (free) |
| **Neon Dashboard** | Database performance, query stats, storage | Included |
| **Fly.io Metrics** | CPU/memory/network per service | Included |

**pg_stat_statements** enabled from Day 1 — monitors PostgreSQL query performance. Critical for catching slow recursive CTE queries that might signal the need for Neo4j.

---

## 10. Security & Compliance

### 10.1 Data Protection

| Requirement | Implementation |
|-------------|---------------|
| Encryption at rest | Neon provides AES-256 encryption. R2 encrypts at rest by default. |
| Encryption in transit | TLS enforced on all connections (Fly.io terminates TLS). |
| PII protection | Aadhaar stored as SHA-256 hash only. Never store raw Aadhaar. |
| Audit logging | Immutable `audit_log` table records every CRUD operation with user_id, timestamp, before/after values. |
| Data residency | Neon Singapore (legally permissible under DPDP Act 2023 — no data localization mandate yet). Migration plan to Supabase Mumbai or AWS RDS Mumbai before 25+ colleges. |
| DPDP Act 2023 | Consent management, data portability API, right to erasure implementation. |
| Cross-tenant isolation | PostgreSQL RLS + automated CI tests verifying isolation on every deploy. |

### 10.2 Role-Based Access Control (Permify)

```yaml
# Permify entity-relationship model
entity college {
  relation admin @user
  relation dean @user
  relation compliance_officer @user
  
  permission manage = admin or dean
  permission view_compliance = compliance_officer or dean or admin
}

entity department {
  relation college @college
  relation hod @user
  relation faculty @user
  
  permission manage = hod or college.dean
  permission view_students = faculty or hod or college.dean
  permission sign_logbook = faculty or hod
}

entity student_record {
  relation department @department
  relation student @user
  
  permission view = student or department.faculty
  permission edit = department.faculty or department.hod
}
```

### 10.3 API Security

- **Rate limiting:** Token-bucket, 1000 requests/hour, 100 requests/minute per JWT
- **CORS:** Strict origin allowlist
- **Input validation:** Pydantic models on all endpoints
- **SQL injection:** SQLAlchemy ORM (parameterized queries only)
- **File upload:** Virus scanning via ClamAV before R2 upload
- **Secrets:** Fly.io secrets (encrypted at rest), never in code or Docker images

---

## 11. Team Allocation & Workflow

### 11.1 Developer Assignments

| Developer | Primary Engines | Secondary | Key Deliverables |
|-----------|----------------|-----------|-----------------|
| **Nischay** | Central AI Engine, Base Architecture | Student Engine (AI integration) | Monorepo setup, FastAPI modular structure, RLS, LiteLLM config, LangGraph agents, RAG pipeline, AI safety, prompt engineering |
| **Subha** | Student Engine (web + mobile) | Faculty Engine (frontend) | Next.js dashboard, Expo mobile app, PDF viewer, flashcards, practice tests, PowerSync offline, student-facing UI |
| **Jason** | Compliance Engine, Admin Engine | Integration Engine | NMC standards database, MSR tracker, AEBAS parallel capture, SAF generator, fee management, SIS, HR/payroll, HMIS adapters |

### 11.2 Claude Code Workflow

**$600/month — 3× Claude Code Max subscriptions. Highest ROI investment.**

```bash
# Each developer's workflow

# 1. CLAUDE.md in repo root — updated from every PR review
# Every architecture decision, every mistake becomes a rule
# Claude Code reads this on every session start

# 2. Parallel sessions via git worktree
git worktree add ../acolyte-mcq-agent feature/mcq-agent
git worktree add ../acolyte-compliance feature/compliance-dashboard
git worktree add ../acolyte-saf feature/saf-generator
# 3-5 features in parallel per developer

# 3. Plan → Build → Verify loop
# Start in Plan Mode (Shift+Tab) to iterate on design
# Switch to Auto-accept for implementation
# Use sub-agents for verification

# 4. MCP integrations
# - GitHub MCP (repo interaction)
# - Database MCP (schema queries against Neon branch)
```

### 11.3 Parallel Development Tracks

**Track 1 — Nischay (Weeks 1-4):**
1. Turborepo monorepo setup with shared packages
2. FastAPI modular monolith skeleton (6 engine packages)
3. Multi-tenant middleware + RLS policies + test fixtures
4. Clerk auth integration + Permify authorization model
5. CI/CD pipelines (GitHub Actions → Vercel + Fly.io)
6. LiteLLM deployment on Fly.io
7. Central AI Engine: first agents (MCQ generator, Socratic tutor)
8. RAG pipeline with pgvector

**Track 2 — Subha (Weeks 1-4):**
1. Next.js 15 frontend scaffold in monorepo
2. Student dashboard + role-based routing
3. PDF viewer integration (web: react-pdf, mobile: react-native-pdf-jsi)
4. Flashcard system (web first, then mobile)
5. Expo mobile app scaffold with PowerSync
6. gluestack-ui v2 mobile component library setup
7. Practice test UI (consumes AI Engine APIs)

**Track 3 — Jason (Weeks 1-4):**
1. NMC competency database seed (3,500+ competencies from NMC volumes)
2. NMC MSR standards reference table
3. Compliance Engine: Faculty MSR dashboard (web + API)
4. AEBAS parallel capture module (attendance_records schema + API)
5. SAF data model + auto-generation first pass
6. Admin Engine: Student/Faculty CRUD APIs
7. Fee structure configuration (multi-quota)

**Critical dependency:** Nischay's base architecture (Step 1-5) must complete within Week 1-2 so Subha and Jason can start building on it. API contracts (Section 12) define the interface so they can work in parallel.

---

## 12. API Contracts Between Engines

### 12.1 Compliance Engine ← Integration Engine (AEBAS)

```python
# app/engines/integration/__init__.py (public interface)

async def get_attendance_records(
    college_id: uuid.UUID,
    department_id: uuid.UUID = None,
    start_date: date = None,
    end_date: date = None,
    person_type: str = "faculty",  # "faculty" or "student"
) -> list[AttendanceRecord]:
    """Returns attendance records for compliance calculation.
    Source: AEBAS parallel capture OR CSV upload."""
    pass

async def get_attendance_summary(
    college_id: uuid.UUID,
    department_id: uuid.UUID = None,
    period: str = "monthly",
) -> AttendanceSummary:
    """Aggregated attendance percentages per department."""
    pass
```

### 12.2 Compliance Engine ← Admin Engine (Faculty Data)

```python
# app/engines/admin/__init__.py (public interface)

async def get_faculty_roster(
    college_id: uuid.UUID,
    department_id: uuid.UUID = None,
    status: str = "active",
) -> list[FacultyRecord]:
    """Returns faculty with designation, department, qualification.
    Used by Compliance Engine for MSR calculation."""
    pass

async def get_faculty_count_by_department(
    college_id: uuid.UUID,
) -> dict[uuid.UUID, FacultyCount]:
    """Quick count: {dept_id: {professors: N, assoc_prof: N, ...}}."""
    pass

async def get_student_count(
    college_id: uuid.UUID,
    phase: str = None,
) -> int:
    """Total active students, optionally filtered by MBBS phase."""
    pass
```

### 12.3 Faculty Engine ← Central AI Engine

```python
# app/engines/ai/__init__.py (public interface)

async def generate_mcq(
    competency_code: str,
    target_difficulty: int,
    target_blooms: str,
    college_id: str,
    count: int = 1,
) -> list[GeneratedMCQ]:
    """Generate MCQs following NBME standards with safety validation."""
    pass

async def generate_saq_rubric(
    competency_code: str,
    question_type: str,  # "SAQ" or "LAQ"
    blooms_level: str,
    college_id: str,
) -> GeneratedSAQWithRubric:
    """Generate SAQ/LAQ with structured marking rubric."""
    pass

async def generate_lesson_plan(
    competency_codes: list[str],
    teaching_hours: int,
    college_id: str,
) -> GeneratedLessonPlan:
    """AI-pre-populated lesson plan from competency database."""
    pass

async def schedule_rotations(
    students: list[str],
    departments: list[str],
    constraints: RotationConstraints,
    college_id: str,
) -> RotationSchedule:
    """Constraint-satisfaction scheduling via OR-Tools."""
    pass
```

### 12.4 Student Engine ← Central AI Engine

```python
# Socratic tutor, flashcard generation, practice tests

async def socratic_chat(
    message: str,
    conversation_history: list[dict],
    student_context: StudentContext,  # current subject, topic, competency
    college_id: str,
) -> SocraticResponse:
    """Bridge Layer AI — guides through questions, never gives direct answers."""
    pass

async def generate_flashcards(
    content: str,  # From PDF viewer / lecture notes
    subject: str,
    college_id: str,
) -> list[Flashcard]:
    """Generate spaced-repetition flashcards from study content."""
    pass

async def generate_practice_test(
    subject: str,
    topics: list[str],
    difficulty: int,
    question_count: int,
    college_id: str,
) -> PracticeTest:
    """Generate personalized practice test targeting weak areas."""
    pass
```

### 12.5 Compliance Engine — Standalone Data Ingestion

```python
# When other engines are NOT active (compliance-only tier)

async def import_faculty_csv(
    file: UploadFile,
    college_id: str,
) -> ImportResult:
    """CSV import of faculty roster when Admin Engine not licensed.
    Expected columns: name, designation, department, qualification, DOJ, DOB."""
    pass

async def import_attendance_csv(
    file: UploadFile,
    college_id: str,
) -> ImportResult:
    """CSV import of AEBAS attendance export.
    Expected columns: faculty_id, date, check_in, check_out, department."""
    pass

async def import_hospital_data(
    data: HospitalDataInput,
    college_id: str,
) -> None:
    """Manual entry: bed_count, opd_daily, ipd_daily, surgeries, deliveries."""
    pass
```

---

## 13. Cost Model

### 13.1 Monthly Infrastructure (MVP — 3 Pilot Colleges)

| Service | Provider | Monthly Cost |
|---------|----------|-------------|
| FastAPI + Workers + Beat | Fly.io (Mumbai) | ~$60 |
| LiteLLM Proxy | Fly.io | ~$8 |
| Langfuse | Fly.io | ~$8 |
| PostgreSQL | Neon (Pro) | ~$19 |
| Frontend | Vercel (Pro) | $20 |
| Redis | Upstash | ~$10 |
| Object Storage | Cloudflare R2 | ~$5 (initially) |
| Video Streaming | Cloudflare Stream | ~$5 |
| Error Monitoring | Sentry Free | $0 |
| Uptime Monitoring | BetterStack | ~$24 |
| Auth | Clerk (Pro) | ~$25 |
| Offline Sync | PowerSync (Pro) | ~$49 |
| Feature Flags | Unleash (self-hosted) | $0 |
| **Infrastructure Subtotal** | | **~$233/mo** |

### 13.2 AI API Costs (Estimated)

| Model | Usage Estimate | Monthly Cost |
|-------|---------------|-------------|
| Claude Sonnet 4 | ~2M tokens in + 500K out | ~$15 |
| GPT-4o | ~500K tokens in + 200K out | ~$3 |
| Claude Haiku | ~1M tokens | ~$1 |
| OpenAI Embeddings | ~5M tokens | ~$0.65 |
| Claude Batch | ~1M tokens | ~$2 |
| **AI Subtotal** | | **~$22/mo** |

### 13.3 Developer Tools

| Tool | Monthly Cost |
|------|-------------|
| Claude Code Max (3 subscriptions) | $600 |
| GitHub (Team) | $12 |
| **Tools Subtotal** | **$612/mo** |

### 13.4 Total Monthly Cost

| Category | Monthly |
|----------|---------|
| Infrastructure | ~$233 |
| AI APIs | ~$22 |
| Developer Tools | ~$612 |
| **Total** | **~$867/mo (~₹73,000)** |

**At 25 colleges (Year 3 target):** Infrastructure scales to ~$500-800/mo. AI costs scale to ~$200-500/mo. Total ~$1,500-2,000/mo. Still under ₹1.7L/month for a platform generating ₹12.5-18.75 crore annual revenue.

---

## Appendix A: CLAUDE.md Template

```markdown
# CLAUDE.md — Acolyte AI Architecture Context

## Architecture
- Modular monolith: 6 Python packages in single FastAPI app
- Engines: Student, Faculty, Compliance, Admin, Integration, AI
- Multi-tenant: college_id on every table, PostgreSQL RLS
- Never import from another engine's internal modules — use __init__.py public interface only

## Common Mistakes (add to this with every PR)
- [ ] Forgetting college_id on new tables
- [ ] Not adding RLS policy to new tables
- [ ] Direct LLM calls outside Central AI Engine
- [ ] Missing downgrade() in Alembic migrations
- [ ] Not running tenant isolation tests

## Code Style
- Async-first (always use async/await with SQLAlchemy)
- Pydantic for all request/response schemas
- Type hints everywhere
- Tests for every public interface method

## Database
- Neon PostgreSQL (Singapore region)
- NullPool (Neon PgBouncer handles pooling)
- statement_cache_size=0 for PgBouncer compatibility
- Always index (college_id, id) on tenant tables
```

---

## Appendix B: Tenant Onboarding Checklist

1. ☐ Create college record with state, university, NMC thresholds
2. ☐ Create admin user with Clerk + Permify roles
3. ☐ Configure feature flags (which engines/features enabled)
4. ☐ Seed NMC competency mappings for college's university curriculum
5. ☐ Configure fee structures (quota-wise, component-wise)
6. ☐ Import faculty roster (CSV or manual)
7. ☐ Import student data (CSV or manual)
8. ☐ Configure AEBAS integration (parallel capture settings)
9. ☐ Run automated RLS isolation test for new tenant
10. ☐ Verify compliance dashboard shows accurate data
11. ☐ Train admin users (onboarding session)

---

*This document is the single source of truth for Acolyte AI's technical architecture. Update it with every major decision. If it's not here, it hasn't been decided.*
