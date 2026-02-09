# CLAUDE.md — Acolyte AI Platform | Master Architecture Context
# Version: 1.0 | Last Updated: February 2026
# READ THIS ENTIRE FILE BEFORE WRITING ANY CODE

---

## WHAT IS ACOLYTE AI

Acolyte AI is the world's first patent-filed "Bridge Layer AI" platform for medical education. Unlike traditional AI tutoring that creates cognitive dependency, Acolyte preserves critical thinking through Socratic questioning. The platform serves two markets simultaneously:

- **B2C:** Medical students preparing for NEET-PG, FMGE, USMLE (₹1,299/month)
- **B2B:** Medical colleges needing NMC compliance automation (₹45-75L/year per college)

The B2B platform is a modular monolith with 6 engines serving 5 distinct user roles across 820+ regulated Indian medical colleges.

Company: Myacolyte Edtech Pvt Ltd
Team: Nischay (CEO/AI Lead), Subha (CTO/AI-ML), Jason (Compliance Dev)

---

## ARCHITECTURE PATTERN: MODULAR MONOLITH

Six logical engines as Python packages within a single FastAPI application. Deployed as one unit. NOT microservices.

**Why:** 3 developers. DZone 2024: teams spend 35% more time debugging in microservices. Shopify runs a 2.8M-line modular monolith. We follow DHH's "Citadel + Outposts" pattern.

**The one planned extraction:** Central AI Engine → separate Fly.io app via NATS (Year 2, when GPU workloads demand it).

### The Six Engines

| Engine | Owner | Purpose |
|--------|-------|---------|
| **Student Engine** | Subha | PDF viewer, flashcards, practice tests, Socratic AI chat, metacognitive analytics |
| **Faculty Engine** | Subha (frontend) + Jason (backend) | Assessment lifecycle, CBME logbook, lesson plans, rotation management |
| **Compliance Engine** | Jason | NMC/NAAC/NBA monitoring, SAF auto-generation, inspection readiness, MSR tracking |
| **Admin Engine** | Jason | SIS, fee management, HR/payroll, hostel/transport, certificates, communications |
| **Integration Engine** | Jason | AEBAS parallel capture, HMIS bridge, Razorpay, university portal adapters |
| **Central AI Engine** | Nischay | LangGraph agents, LiteLLM gateway, RAG pipeline, AI safety, prompt registry |

### Deployment Topology

```
VERCEL (Global CDN) — Next.js 15 Frontend (all roles)
        ↓ HTTPS
FLY.IO Mumbai (bom) — FastAPI Monolith + Celery + Redis + LiteLLM + Langfuse
        ↓
NEON PostgreSQL (Singapore) — Shared schema + RLS per college
CLOUDFLARE R2 + Stream — PDFs, DICOM, WSI, video, documents
```

---

## TECHNOLOGY STACK (FINAL — DO NOT CHANGE)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | FastAPI (Python 3.11+) | Async-first, Pydantic v2 |
| Frontend | Next.js 15 (App Router) | React 19, Turbopack, server components |
| Mobile | Expo SDK 52+ (React Native) | Hermes engine, New Architecture |
| Database | Neon PostgreSQL (serverless) | pgvector, pg_partman, pgcrypto, pg_trgm |
| Vector Search | pgvector (HNSW indexes) | Co-located in Neon, not separate DB |
| Cache/Queue | Upstash Redis | Serverless; Celery broker + pub/sub |
| Object Storage | Cloudflare R2 | ZERO egress fees — critical for medical imaging |
| Video | Cloudflare Stream | HLS adaptive streaming |
| AI Orchestration | LangGraph | StateGraph agents with typed state |
| AI Gateway | LiteLLM Proxy | Multi-provider routing, per-tenant cost tracking |
| AI Observability | Langfuse (self-hosted) | Traces, quality metrics, token usage |
| Auth | Clerk | JWT (RS256), SSO, webhooks for sync |
| Authorization | Permify | Zanzibar-style ReBAC, entity relationships |
| Offline Sync | PowerSync | Bidirectional SQLite ↔ Neon ($49/mo Pro) |
| Web UI | shadcn/ui + Tremor | Radix-based + dashboard charts |
| Mobile UI | gluestack-ui v2 + NativeWind | Tailwind CSS for React Native |
| Monorepo | Turborepo | Vercel-native, path-filtered builds |
| CI/CD | GitHub Actions | Trunk-based dev, path-filtered triggers |

---

## MONOREPO STRUCTURE

```
acolyte/
├── apps/
│   ├── web/                          # Next.js 15 frontend (all roles)
│   │   ├── app/
│   │   │   ├── (auth)/               # Clerk auth pages
│   │   │   ├── (dashboard)/          # Shared dashboard layout
│   │   │   │   ├── student/          # Student routes
│   │   │   │   ├── faculty/          # Faculty/HOD routes
│   │   │   │   ├── admin/            # Admin routes
│   │   │   │   ├── compliance/       # Compliance officer routes
│   │   │   │   └── management/       # Dean/Trust management routes
│   │   │   └── api/                  # Next.js API routes (BFF)
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
│       │   ├── (tabs)/
│       │   │   ├── home/
│       │   │   ├── study/            # PDF viewer, flashcards
│       │   │   ├── practice/         # Tests, MCQ practice
│       │   │   ├── logbook/          # Competency logbook (offline)
│       │   │   └── profile/
│       │   └── _layout.tsx
│       ├── components/
│       │   ├── ui/                   # gluestack-ui v2 components
│       │   └── shared/
│       ├── lib/
│       │   ├── powersync/            # PowerSync + sync rules
│       │   ├── storage/              # MMKV for fast KV
│       │   └── api-client.ts
│       └── app.config.ts
│
├── packages/
│   ├── shared/                       # Shared TypeScript types + utilities
│   │   ├── types/                    # API response types, shared interfaces
│   │   ├── validators/               # Zod schemas (shared web + mobile)
│   │   └── constants/                # NMC competency codes, config constants
│   ├── ui-tokens/                    # Design tokens (colors, spacing, typography)
│   │   └── tokens.ts                 # Shared between shadcn + gluestack
│   └── api-client/                   # Generated API client from OpenAPI
│       └── generated/
│
├── backend/                          # FastAPI modular monolith
│   ├── alembic/                      # Database migrations (SINGLE OWNER)
│   │   ├── versions/
│   │   └── env.py
│   ├── app/
│   │   ├── main.py                   # FastAPI init
│   │   ├── config.py                 # Pydantic BaseSettings
│   │   ├── middleware/
│   │   │   ├── auth.py               # Clerk JWT validation
│   │   │   ├── tenant.py             # Multi-tenant (sets college_id via RLS)
│   │   │   ├── rate_limit.py
│   │   │   └── cors.py
│   │   ├── core/
│   │   │   ├── database.py           # AsyncSession, engine, RLS setup
│   │   │   ├── events.py             # Redis Pub/Sub event bus
│   │   │   ├── permissions.py        # Permify integration
│   │   │   ├── storage.py            # Cloudflare R2 client
│   │   │   └── celery_app.py         # Celery configuration
│   │   │
│   │   ├── engines/                  # === THE SIX ENGINES ===
│   │   │   ├── student/
│   │   │   │   ├── __init__.py       # PUBLIC INTERFACE ONLY
│   │   │   │   ├── models.py
│   │   │   │   ├── routes.py         # /api/v1/student/...
│   │   │   │   ├── schemas.py        # Pydantic schemas
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
│   │   │   │   ├── naac_metrics.py   # 109 NAAC metrics calculator
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
│   │   │   │   ├── aebas/            # AEBAS parallel capture
│   │   │   │   │   ├── capture.py
│   │   │   │   │   ├── reconciliation.py
│   │   │   │   │   └── report_generator.py
│   │   │   │   ├── hmis/             # Hospital data bridge
│   │   │   │   │   ├── adapters/
│   │   │   │   │   └── fallback.py   # CSV import fallback
│   │   │   │   ├── payments/         # Razorpay + others
│   │   │   │   └── university/       # Per-university adapters
│   │   │   │       ├── base.py
│   │   │   │       └── adapters/     # RGUHS, VTU, etc.
│   │   │   └── ai/                   # Central AI Engine
│   │   │       ├── __init__.py
│   │   │       ├── gateway.py        # LiteLLM proxy configuration
│   │   │       ├── router.py         # Request classification + routing
│   │   │       ├── rag/
│   │   │       │   ├── pipeline.py   # Hybrid search (vector + BM25 + RRF)
│   │   │       │   ├── embeddings.py
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
│   │   │           └── templates/
│   │   │
│   │   └── shared/
│   │       ├── models.py             # Base model with college_id, timestamps
│   │       ├── schemas.py
│   │       └── exceptions.py
│   │
│   ├── tests/
│   │   ├── conftest.py               # Fixtures: test tenants, RLS verification
│   │   ├── test_tenant_isolation.py  # CRITICAL: cross-tenant leak tests
│   │   └── engines/
│   │
│   ├── Dockerfile
│   ├── fly.toml
│   ├── requirements.txt
│   └── CLAUDE.md                     # Backend-specific context (optional)
│
├── infrastructure/
│   ├── docker-compose.dev.yml
│   ├── seed/
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
├── .github/
│   └── workflows/
│       ├── backend-ci.yml            # Triggered by backend/** changes
│       ├── frontend-ci.yml           # Triggered by apps/web/** or packages/** changes
│       ├── mobile-ci.yml             # Triggered by apps/mobile/** changes
│       └── tenant-isolation.yml      # Runs on every PR — NEVER SKIP
│
├── turbo.json
├── package.json
└── CLAUDE.md                         # THIS FILE — root-level context
```

---

## MODULE BOUNDARY RULES (CRITICAL — ENFORCED VIA LINTING)

1. **Engines NEVER import from another engine's internal modules.** Only through `__init__.py` public interface.
2. **Only Central AI Engine imports LangGraph/LiteLLM.** Other engines call AI through the AI engine's public interface.
3. **Shared models/utilities go in `app/shared/`.** Not in any engine.
4. **Async events (Redis Pub/Sub) for cross-engine notifications.** Direct function calls for synchronous operations within the same request.
5. **Every engine owns its own models, routes, schemas, service, tasks.** No cross-contamination.

```python
# ✅ CORRECT — importing from public interface
from app.engines.ai import generate_mcq
from app.engines.admin import get_faculty_roster

# ❌ WRONG — importing internal module
from app.engines.ai.agents.socratic_tutor import SocraticTutorAgent
from app.engines.admin.models import Faculty
```

---

## DATABASE ARCHITECTURE

### Multi-Tenancy with Row-Level Security

EVERY table carries `college_id UUID NOT NULL`. No exceptions.

```python
# Base model — ALL tenant-scoped models inherit from this
class TenantModel(Base):
    __abstract__ = True
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = Column(UUID(as_uuid=True), ForeignKey("colleges.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at = Column(DateTime(timezone=True), server_default=text("NOW()"), onupdate=text("NOW()"))
```

**RLS Policy (applied to EVERY tenant table):**

```sql
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {table_name}
  USING (college_id = current_setting('app.current_college_id')::uuid);
```

**FastAPI middleware sets tenant context on every request:**

```python
# middleware/tenant.py
async def set_tenant_context(session: AsyncSession, college_id: UUID):
    await session.execute(text(f"SET app.current_college_id = '{college_id}'"))
```

### Database Connection Rules

```python
# Neon PostgreSQL connection (PgBouncer handles pooling)
engine = create_async_engine(
    DATABASE_URL,
    poolclass=NullPool,  # REQUIRED — Neon has its own PgBouncer
    connect_args={"statement_cache_size": 0}  # REQUIRED for PgBouncer
)
```

### Tables That Are NOT Tenant-Scoped (Reference Data)

These do NOT have college_id and do NOT use RLS:
- `nmc_standards` — NMC MSR threshold reference data
- `competencies` — 3,500+ NMC CBME competency codes
- `aetcom_modules` — 27 AETCOM module definitions
- `naac_metrics` — 109 NAAC metric definitions
- `nmc_msr_thresholds` — Faculty requirements per intake size

### Core Schema Per Engine (~88 tables total)

**Compliance Engine:**
- `compliance_snapshots` — Daily compliance scores (partitioned by month via pg_partman)
- `saf_submissions` — SAF AI/AII/AIII form submissions with status tracking
- `inspection_readiness_scores` — Per-parameter readiness with Prophet forecasting
- `msr_alerts` — Faculty strength breach alerts

**Faculty Engine:**
- `logbook_entries` — CBME competency tracking (core table, syncs offline via PowerSync)
- `question_bank_items` — MCQs with psychometric data (difficulty_index, discrimination_index, distractor_effectiveness)
- `clinical_rotations` — Rotation schedules with NMC minimum hours
- `lesson_plans` — AI-generated lesson plans with competency mapping
- `assessments` — Exam lifecycle (draft → reviewed → approved → conducted → analyzed)
- `osce_stations` — OSCE station definitions with checklists

**Admin Engine:**
- `students` — Student SIS records with multi-quota tracking
- `faculty` — Faculty records with NMC qualification verification
- `fee_structures` — Multi-quota fee definitions (government/management/NRI)
- `fee_payments` — Payment tracking with Razorpay integration
- `departments` — Department definitions with MSR thresholds
- `batches` — Student batch groupings
- `hostel_rooms` — Hostel allocation tracking
- `certificates` — Certificate generation tracking

**Student Engine:**
- `study_sessions` — Session tracking for analytics
- `flashcards` + `flashcard_reviews` — Spaced repetition system
- `practice_tests` + `test_attempts` — AI-generated practice tests
- `pdf_annotations` — Offline-capable annotation layer
- `chat_sessions` — Socratic AI conversation history

**Integration Engine:**
- `attendance_records` — AEBAS parallel capture (partitioned by month)
- `hmis_data_points` — Hospital data bridge records
- `payment_transactions` — Razorpay webhook events

**Central AI Engine:**
- `ai_requests` + `ai_responses` — AI audit trail
- `prompt_versions` — Versioned prompt registry
- `document_embeddings` — pgvector HNSW index (1536 dims, OpenAI text-embedding-3-large)

### PostgreSQL Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "pgvector";     -- Vector similarity search
CREATE EXTENSION IF NOT EXISTS "pg_partman";    -- Time-based partitioning
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Column-level encryption (Aadhaar)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Trigram similarity search
```

### Migration Rules

- **ONLY the FastAPI backend runs Alembic.** Single migration owner.
- Always write both `upgrade()` AND `downgrade()` functions.
- Run as Fly.io `release_command` (pre-deploy), NEVER at app startup.
- Use Neon branching to test: create branch → run migration → test → merge → deploy.
- Follow expand-contract for breaking changes: add new → migrate data → remove old.
- **ALWAYS add RLS policy when creating a new tenant table.**

---

## GIT WORKFLOW & CI/CD

### Branch Strategy (3-Person Team)

**Trunk-based development** with short-lived feature branches. DORA research validates this across Google, Netflix, Amazon.

```
main (always deployable, protected)
├── feature/nischay/mcq-agent        # Developer-namespaced feature branches
├── feature/subha/student-dashboard
├── feature/jason/compliance-msr
├── fix/nischay/rls-policy-bug       # Bug fixes
└── hotfix/critical-auth-fix         # Emergency hotfixes (skip staging)
```

### Branch Rules

| Rule | Setting |
|------|---------|
| `main` protection | Require 1 review (any other team member), require CI pass |
| Feature branch lifetime | < 1 day (< 2 days max for complex features) |
| Naming convention | `{type}/{developer}/{short-description}` |
| Types | `feature/`, `fix/`, `hotfix/`, `chore/`, `refactor/` |
| Merge strategy | Squash merge to main (clean history) |
| Auto-delete branches | Yes, after merge |

### CI/CD Pipeline (Path-Filtered — CRITICAL)

**Backend changes do NOT trigger frontend builds. Frontend changes do NOT trigger backend builds. This prevents developers from breaking each other's work.**

```yaml
# .github/workflows/backend-ci.yml
name: Backend CI/CD
on:
  push:
    branches: [main]
    paths: ['backend/**']
  pull_request:
    branches: [main]
    paths: ['backend/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements-test.txt
      - name: Run tests
        run: pytest tests/ -v --tb=short
      - name: Verify tenant isolation (NEVER SKIP)
        run: pytest tests/test_tenant_isolation.py -v

  deploy:
    if: github.ref == 'refs/heads/main'
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
# .github/workflows/frontend-ci.yml
name: Frontend CI
on:
  push:
    branches: [main]
    paths: ['apps/web/**', 'packages/**']
  pull_request:
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
  # Vercel auto-deploys on push to main (Git integration)
```

```yaml
# .github/workflows/tenant-isolation.yml
# RUNS ON EVERY PR — NEVER SKIP THIS
name: Tenant Isolation Check
on: pull_request
jobs:
  isolation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify no cross-tenant data leaks
        run: |
          cd backend
          pip install -r requirements-test.txt
          pytest tests/test_tenant_isolation.py -v --tb=long
```

### Parallel Development with git worktree

```bash
# Each developer works on 3-5 features simultaneously
git worktree add ../acolyte-mcq-agent feature/nischay/mcq-agent
git worktree add ../acolyte-compliance feature/jason/compliance-msr
git worktree add ../acolyte-dashboard feature/subha/student-dashboard

# Each worktree = separate branch + dedicated Claude Code session
```

### Feature Flags (Unleash)

Decouple deployment from release. Code ships to production behind flags.

```python
if unleash.is_enabled("compliance_saf_generator", college_id=college_id):
    # New SAF auto-generation feature
else:
    # Existing manual workflow
```

---

## ROLE-BASED ACCESS CONTROL (PERMIFY)

### Entity-Relationship Model

```yaml
# Permify schema — medical college hierarchy
entity user {}

entity college {
  relation admin @user
  relation dean @user
  relation vice_dean @user
  relation compliance_officer @user
  relation registrar @user
  relation accounts_officer @user
  relation hostel_warden @user
  relation librarian @user
  relation iqac_coordinator @user

  permission manage = admin or dean
  permission view_all = admin or dean or vice_dean
  permission view_compliance = compliance_officer or dean or admin
  permission view_finance = accounts_officer or dean or admin or registrar
  permission view_hostel = hostel_warden or admin
  permission manage_accreditation = iqac_coordinator or dean or admin
}

entity department {
  relation college @college
  relation hod @user
  relation faculty @user
  relation tutor @user
  relation senior_resident @user

  permission manage = hod or college.dean
  permission view_students = faculty or hod or college.dean or tutor or senior_resident
  permission sign_logbook = faculty or hod
  permission create_assessment = faculty or hod
  permission approve_assessment = hod or college.dean
  permission view_rotation = faculty or hod or tutor or senior_resident
}

entity student_record {
  relation department @department
  relation student @user
  relation mentor @user

  permission view = student or mentor or department.faculty
  permission edit = department.faculty or department.hod
  permission view_analytics = student or mentor or department.hod
}

entity assessment {
  relation department @department
  relation creator @user
  relation reviewer @user

  permission edit = creator
  permission review = reviewer or department.hod
  permission approve = department.hod or department.college.dean
  permission view_results = department.faculty or department.hod
}

entity fee_record {
  relation college @college
  relation student @user

  permission view = student or college.accounts_officer or college.admin
  permission edit = college.accounts_officer or college.admin
  permission approve_waiver = college.dean or college.admin
}

entity compliance_report {
  relation college @college

  permission view = college.compliance_officer or college.dean or college.admin
  permission edit = college.compliance_officer
  permission submit = college.dean or college.admin
}
```

### Frontend Permission Checks

```typescript
// lib/permissions.ts
import { usePermify } from '@/hooks/usePermify';

export function useCanViewCompliance() {
  return usePermify('view_compliance', 'college', collegeId);
}

export function useCanSignLogbook() {
  return usePermify('sign_logbook', 'department', departmentId);
}

// In components — ALWAYS check before rendering
const canEdit = useCanEdit();
if (!canEdit) return <AccessDenied />;
```

### Role Hierarchy

| Role | Permify Relations | Dashboard Access |
|------|------------------|-----------------|
| **Student** | `student` on student_record | Student dashboard only |
| **Faculty** | `faculty` on department | Faculty dashboard, student records (own dept) |
| **HOD** | `hod` on department | Faculty dashboard + dept management + approvals |
| **Dean/Principal** | `dean` on college | All dashboards, all departments |
| **Admin** | `admin` on college | Admin dashboard, full system access |
| **Compliance Officer** | `compliance_officer` on college | Compliance dashboard, reports, SAF |
| **Management/Trust** | `admin` on college (elevated) | Management dashboard, cross-college analytics |

---

## CENTRAL AI ENGINE

### AI Model Selection

| Use Case | Model | Cost |
|----------|-------|------|
| Clinical reasoning, MCQ generation, Socratic tutoring | Claude Sonnet 4 | ~$3/$15 per M tokens |
| Data extraction, structured output (SAF forms) | GPT-4o | ~$2.50/$10 per M tokens |
| Intent classification, routing | Claude Haiku / GPT-4o-mini | ~$0.25/$1.25 per M tokens |
| Embeddings | OpenAI text-embedding-3-large | $0.13/M tokens, 1536 dims |
| Batch operations | Claude Batch API | 50% discount |

### LiteLLM Configuration

```python
# gateway.py — ALL AI calls go through LiteLLM
# NEVER call LLM providers directly from any engine
litellm_config = {
    "model_list": [
        {"model_name": "medical-reasoning", "litellm_params": {"model": "claude-sonnet-4-20250514"}},
        {"model_name": "data-extraction", "litellm_params": {"model": "gpt-4o"}},
        {"model_name": "routing", "litellm_params": {"model": "claude-haiku"}},
    ],
    "general_settings": {
        "max_budget": 100,
        "budget_duration": "1mo",
    }
}
```

### Medical RAG Pipeline

1. **Vector search** → pgvector HNSW (OpenAI embeddings, 1536 dims)
2. **BM25 sparse search** → PostgreSQL FTS with medical terminology
3. **RRF fusion** → Reciprocal Rank Fusion, top-k
4. **Cross-encoder reranking** → Fine-tuned for medical content
5. **Source verification** → Validates against known medical references

Chunking: 512-1024 tokens, 20% overlap, tagged with subject, competency_code, organ_system, blooms_level, content_type.

### AI Safety Pipeline (MANDATORY)

```
AI Response → Source Verification → Confidence Scoring → Threshold Check → Output
                                                            ↓
                                                    >0.95 → Auto-approve (formative only)
                                                    0.80-0.95 → Needs faculty review
                                                    <0.80 → Rejected, regenerate (max 3)
```

**RULE: ALL summative assessment content MUST have faculty review. No exceptions.**

### Per-Tenant Cost Management

Budget allocation: Student 60%, Faculty 20%, Compliance 10%, Admin 10%.
Auto-downgrade: Sonnet → Haiku when approaching budget limits.

---

## COMPLIANCE ENGINE — COMPLETE FEATURE LIST

Ships FIRST. 349 colleges have show-cause notices. 500+ fail MSR.

### Tier 1 (Build First)

1. **Faculty MSR Strength Monitoring** — Real-time vs NMC MSR 2023 norms, retirement countdown (age 70), scenario modeling, predictive alerts
2. **AEBAS Compliance Dashboard** — Parallel capture (no AEBAS API), 75% threshold alerts, GPS geofencing (100m, May 2025), reconciliation
3. **NMC SAF Auto-Generation** — SAF AI/AII/AIII forms, auto-pulls from AEBAS/HMIS/HR, cross-verification, saves 200+ person-hours
4. **NMC Inspection Readiness Score** — Continuous monitoring, Prophet forecasting, 30-60 day predictive alerts, self-audit simulator

### Tier 2

5. **Internal Assessment Tracking** — IA eligibility (≥50% aggregate, ≥40% each)
6. **NAAC SSR Auto-Generation** — 109 metrics, 7 criteria, quantitative auto-calculation
7. **NBA SAR Auto-Generation** — CO-PO mapping, 6+ COs per course, attainment calculation
8. **Cross-System Discrepancy Detection** — AI identifies AEBAS vs HMIS vs roster inconsistencies

### NMC Regulatory Coverage

| Regulation | Features |
|-----------|---------|
| UG-MSR 2023 | Faculty MSR, AEBAS, hospital data, infrastructure |
| CBME Curriculum 2024 | Competency engine, lesson plans, assessment lifecycle, AETCOM |
| GMER 2023 | Results, IA tracking, attendance |
| CRMI 2021 | Rotation scheduler, internship logbook, posting attendance |
| AEBAS Circulars | Integration module, compliance analytics |
| Assessment & Rating 2023 | SAF auto-generation, inspection readiness, discrepancy detection |

### Standalone Operation (CRITICAL)

Compliance Engine works WITHOUT other engines via CSV imports:
```python
async def import_faculty_csv(file, college_id) -> ImportResult
async def import_attendance_csv(file, college_id) -> ImportResult
async def import_hospital_data(data, college_id) -> None
```

---

## FACULTY ENGINE — COMPLETE FEATURE LIST

### Assessment Lifecycle
- MCQ generation (AI + NBME standards + psychometric analysis)
- SAQ/LAQ rubric generation
- OSCE digital management (stations, checklists, inter-rater reliability)
- Exam blueprinting (competency mapping, Bloom's distribution, MCQ 20% cap)

### CBME Competency Tracking
- 3,000-3,500+ competencies across 19 subjects
- DOAP progression (Demonstrate → Observe → Assist → Perform)
- Batch sign-off (QR/digital), competency heat maps
- Logbook completion tied to exam eligibility

### Clinical Rotation Management
- Constraint-satisfaction AI scheduling
- 150-250 students × 10+ departments
- Mobile procedure logging with faculty verification

### AI Features
- Lesson plan generator (NMC format, Bloom's levels, integration tags)
- Integrated teaching plan AI (horizontal/vertical integration across 3,500+ competencies)
- Student performance prediction (AUC-ROC 0.97-0.99, 4-6 week early warning)
- Faculty portfolio auto-generation (ORCID/PubMed/Scopus fetch)

---

## ADMIN ENGINE — COMPLETE FEATURE LIST

### SIS
- Multi-quota admission (AIQ 15%, State 85%, Management 20-30%, NRI 15%)
- Document verification (15+ types, AI OCR)
- Full academic lifecycle tracking

### Fee Management
- Multi-quota structures (Govt ₹4-7L, Mgmt ₹4-18L, NRI ₹20L+)
- 47+ scholarship matching, NSP integration
- Razorpay Smart Collect, MCC refund tracking

### HR & Payroll
- NMC Faculty Qualification Rules 2025 verification
- 7th CPC scales + private college scales
- Multi-state statutory deductions (EPF, ESI, TDS, PT, Gratuity)
- Leave management (CL, EL, ML, Study, Maternity, Sabbatical, Duty, Exam)

### Other
- Hostel (75% capacity tracking), transport, certificates
- Infrastructure tracking, communication platform

---

## DESIGN SYSTEM & UI/UX

### Acolyte Brand

| Element | Value |
|---------|-------|
| **Brand Color** | Emerald Green (#00C853, teal-green family) |
| **Background** | Dark mode first (#0A0A0A to #1A1A2E) |
| **Accent** | Teal/Emerald green on dark backgrounds |
| **Mascot** | Owl (wisdom, night-study companion) |
| **Typography** | Inter (UI), system fonts for performance |
| **Design Philosophy** | Clean, minimal, medical-grade trust |

### Student App (SET — dark mode, green accents, owl mascot)

Established UI: dark theme, emerald green accents, sidebar nav (Home, PDF, Notes, Practice, Flashcard, AI Assistant), subject-wise analytics charts.

### Admin/Faculty/Compliance Dashboards (TO BE DESIGNED in Google Stitch)

**UX is #1 problem across ALL competitors. We MUST win here.**

Design principles:
1. Data density without overwhelm — progressive disclosure
2. Action-oriented — "what do I do next?" not just "what happened"
3. Compliance-first hierarchy — seat-loss risks get top visual priority
4. Mobile-responsive admin — HODs check on phones between rounds
5. Minimal clicks for faculty — every task in ≤3 clicks

UI: shadcn/ui + Tremor + recharts. Support light AND dark themes for admin (user preference).

---

## FRONTEND ROUTING (NEXT.JS 15)

```
app/(dashboard)/
├── student/           # Dashboard, study, practice, logbook, chat, analytics
├── faculty/           # Dashboard, assessments, logbook, rotations, students, lesson-plans, portfolio
├── admin/             # Dashboard, students, faculty, fees, infrastructure, hostel, communications
├── compliance/        # Dashboard, MSR, attendance, SAF, inspection, NAAC, NBA
└── management/        # Executive summary, cross-department analytics, financial, reports
```

---

## MOBILE (EXPO SDK 52+)

Target: ₹8K-15K Android, 2-3GB RAM, APK <30MB.
Optimizations: Hermes AOT, Fabric/TurboModules, ProGuard/R8, FlatList tuning, MMKV.
Offline: PowerSync (logbook, flashcards, clinical logs). PDF: react-native-pdf-jsi (80x faster).

---

## API CONTRACTS BETWEEN ENGINES

```python
# Compliance ← Integration (AEBAS)
async def get_attendance_records(college_id, department_id, start_date, end_date, person_type) -> list[AttendanceRecord]
async def get_attendance_summary(college_id, department_id, period) -> AttendanceSummary

# Compliance ← Admin (Faculty)
async def get_faculty_roster(college_id, department_id, status) -> list[FacultyRecord]
async def get_faculty_count_by_department(college_id) -> dict[UUID, FacultyCount]
async def get_student_count(college_id, phase) -> int

# Faculty ← Central AI
async def generate_mcq(competency_code, target_difficulty, target_blooms, college_id, count) -> list[GeneratedMCQ]
async def generate_saq_rubric(competency_code, question_type, blooms_level, college_id) -> GeneratedSAQWithRubric
async def generate_lesson_plan(competency_codes, teaching_hours, college_id) -> GeneratedLessonPlan
async def schedule_rotations(students, departments, constraints, college_id) -> RotationSchedule

# Student ← Central AI
async def socratic_chat(message, conversation_history, student_context, college_id) -> SocraticResponse
async def generate_flashcards(content, subject, college_id) -> list[Flashcard]
async def generate_practice_test(subject, topics, difficulty, question_count, college_id) -> PracticeTest
```

---

## SECURITY & COMPLIANCE

- AES-256 at rest, TLS in transit, Aadhaar as SHA-256 hash only
- Immutable audit_log, DPDP Act 2023 compliant
- Rate limiting: 1000/hr, 100/min per JWT
- Pydantic validation on ALL endpoints, SQLAlchemy ORM only
- ClamAV scanning before R2 upload, Fly.io secrets

---

## COMMON MISTAKES (ADD WITH EVERY PR)

### Database
- [ ] Forgetting `college_id` on new tables
- [ ] Not adding RLS policy to new tables
- [ ] Missing `downgrade()` in Alembic migrations
- [ ] Not indexing `(college_id, id)` on tenant tables
- [ ] Forgetting to partition high-volume tables

### Architecture
- [ ] Direct LLM calls outside Central AI Engine
- [ ] Importing from another engine's internal modules
- [ ] Not running tenant isolation tests
- [ ] Putting shared models in an engine instead of `app/shared/`

### Frontend
- [ ] Not checking Permify permissions before rendering
- [ ] Hardcoding role checks instead of Permify
- [ ] Missing loading states, not using Tremor for charts

### Mobile
- [ ] Not using PowerSync for offline data
- [ ] Using AsyncStorage instead of MMKV
- [ ] Not testing on ₹8K Android phones

### AI
- [ ] Skipping safety pipeline
- [ ] Not logging to Langfuse
- [ ] Missing faculty review flag on summative content
- [ ] Calling LLM directly instead of through LiteLLM

---

## CODE STYLE

### Python
- Async-first (always async/await with SQLAlchemy)
- Pydantic for ALL schemas
- Type hints everywhere
- Tests for every public interface

### TypeScript
- Zod schemas in packages/shared/ (shared web + mobile)
- @tanstack/react-query for API calls
- Always check Permify permissions

---

## TEAM ALLOCATION

| Developer | Primary | Week 1-2 Focus |
|-----------|---------|-----------------|
| **Nischay** | Central AI + Base Architecture | Turborepo → FastAPI → RLS → Clerk + Permify → CI/CD → LiteLLM |
| **Subha** | Student Engine + Faculty frontend | Next.js scaffold → student dashboard → PDF viewer → flashcards → Expo |
| **Jason** | Compliance + Admin + Integration | NMC seed → MSR dashboard → AEBAS → SAF → Student/Faculty CRUD |

**Critical:** Nischay's base architecture must complete Week 1-2 before others build on it.

---

## COST MODEL (MVP — 3 Colleges)

~$867/mo (~₹73,000): Fly.io $60, Neon $19, Vercel $20, Redis $10, R2/Stream $10, BetterStack $24, Clerk $25, PowerSync $49, AI $22, Claude Code 3×$200.

---

## QUICK REFERENCE

```bash
# Dev
docker-compose -f infrastructure/docker-compose.dev.yml up -d
cd backend && uvicorn app.main:app --reload
cd apps/web && npm run dev
cd apps/mobile && npx expo start

# DB
cd backend && alembic revision --autogenerate -m "description"
cd backend && alembic upgrade head

# Test (ALWAYS before PR)
cd backend && pytest tests/test_tenant_isolation.py -v

# Deploy
flyctl deploy --remote-only  # Backend
npx eas build --platform android  # Mobile

# Parallel work
git worktree add ../acolyte-{feature} feature/{dev}/{feature}
```

---

*Every mistake becomes a rule. Update this file with every PR review.*
*If it's not in this document, it hasn't been decided.*
