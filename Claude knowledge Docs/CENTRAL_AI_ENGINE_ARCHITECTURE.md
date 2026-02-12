# ACOLYTE AI — CENTRAL AI ENGINE ARCHITECTURE
## Complete Technical Specification for AI-Powered Medical Education Platform

**Version:** 2.0
**Date:** February 11, 2026
**Author:** Nischay (CEO & AI Lead)
**Classification:** Internal Technical Architecture — AI Engine Only
**Stack:** LangGraph + Anthropic Claude + MCP Tool Servers + PostgreSQL (pgvector) + Knowledge Graph

---

## TABLE OF CONTENTS

1. [Architecture Philosophy & Design Principles](#1-architecture-philosophy--design-principles)
2. [System Topology — The 4-Layer AI Stack](#2-system-topology--the-4-layer-ai-stack)
3. [Agent Classification & Autonomy Tiers](#3-agent-classification--autonomy-tiers)
4. [Shared Infrastructure Layers (L1–L7)](#4-shared-infrastructure-layers-l1l7)
5. [Student Engine Agents (S1–S9)](#5-student-engine-agents-s1s9)
6. [Faculty Engine Agents (F1–F12)](#6-faculty-engine-agents-f1f12)
7. [Compliance Engine Agents (C1–C6)](#7-compliance-engine-agents-c1c6)
8. [Admin Engine Agents (A1–A4)](#8-admin-engine-agents-a1a4)
9. [Integration Engine Agents (I1–I2)](#9-integration-engine-agents-i1i2)
10. [Inter-Engine Data Flow & Event Architecture](#10-inter-engine-data-flow--event-architecture)
11. [AI Gateway & Model Strategy](#11-ai-gateway--model-strategy)
12. [Safety, Guardrails & Bridge Layer Enforcement](#12-safety-guardrails--bridge-layer-enforcement)
13. [Prompt Engineering Standards & Registry](#13-prompt-engineering-standards--registry)
14. [Observability, Evaluation & Continuous Improvement](#14-observability-evaluation--continuous-improvement)
15. [Implementation Phasing](#15-implementation-phasing)

---

## 1. ARCHITECTURE PHILOSOPHY & DESIGN PRINCIPLES

### 1.1 The Bridge Layer Imperative

Acolyte AI exists to solve a paradox: students need AI to learn medicine, but AI that gives direct answers destroys the clinical reasoning that makes doctors competent. Every architectural decision in this document flows from one principle:

**The AI must make the student think harder, not less.**

This is not a prompt instruction. It is an architectural guarantee enforced by a deterministic pipeline (L2: Cognitive Preservation Pipeline) that every student-facing response passes through before delivery. If a response gives away an answer, it gets rejected and regenerated. This makes Bridge Layer AI a system property, not a model behavior we hope for.

### 1.2 Core Design Principles

**Principle 1 — Agents Are Not the Default**
Following Anthropic's production guidance: most AI capabilities are deterministic workflows with LLM steps, not autonomous agents. Only 5 capabilities in Acolyte require true agent behavior (dynamic decision-making, stateful reasoning, tool selection). Everything else uses prompt chains with structured outputs.

Reference: Anthropic's engineering blog on building effective agents recommends starting with the simplest solution — augmented LLMs with retrieval and tools — and only escalating to agent architectures when the task genuinely requires dynamic decision-making.

**Decision Framework:**
```
Is the task predictable and sequential?
  → YES → Use Prompt Chain Workflow (structured output pipeline)
  → NO  → Does it require dynamic tool selection?
    → YES → Use LangGraph Agent with supervisor
    → NO  → Does it require multi-turn stateful interaction?
      → YES → Use LangGraph Agent with checkpointing
      → NO  → Use single LLM call with structured output
```

**Principle 2 — Context Engineering Over Prompt Engineering**
The quality of AI output depends more on what context reaches the model than how the prompt is worded. Every agent's architecture is designed around context assembly: what data gets retrieved, how it's filtered, what metadata accompanies it, and what gets excluded.

Reference: Anthropic's AWS re:Invent 2025 presentation established that "intelligence is not the bottleneck — context is." Context engineering is the systematic practice of assembling the right information for each LLM call, distinct from one-off prompt writing.

**Principle 3 — Structured Outputs Everywhere**
Every LLM call that produces data consumed by downstream systems uses Anthropic's constrained decoding structured outputs. This eliminates JSON parsing errors, retry logic, and validation overhead.

```python
# Every inter-agent data exchange uses Pydantic models + structured output
from pydantic import BaseModel, ConfigDict
from anthropic import Anthropic, transform_schema

class MCQOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stem: str
    lead_in: str
    options: list[MCQOption]
    correct_answer_index: int
    competency_code: str
    blooms_level: str
    difficulty_rating: int
    source_citations: list[Citation]

# Constrained decoding — model CANNOT produce invalid output
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=4096,
    messages=[...],
    output_config={
        "format": {
            "type": "json_schema",
            "schema": transform_schema(MCQOutput),
        }
    }
)
```

**Principle 4 — MCP as the Universal Tool Interface**
All agent-to-data interactions go through MCP tool servers. Agents never directly query databases, call APIs, or access file systems. This creates a clean separation between AI reasoning and data operations, enables tool reuse across agents, and provides a single point for access control, logging, and rate limiting.

**Principle 5 — Multi-Tenant Isolation as a Hard Constraint**
Every AI operation is scoped to a `college_id`. No agent can access data from a different college. This is enforced at the MCP tool server level via PostgreSQL Row-Level Security, not at the agent level. The agent never even sees data from other colleges.

**Principle 6 — Cost-Aware by Design**
Medical colleges in India operate on tight budgets. Every AI call is tracked against a per-college monthly token budget. When budget exceeds 80%, the AI Gateway automatically downgrades models (Sonnet → Haiku). When budget exceeds 100%, non-critical AI features are disabled while safety-critical features (compliance monitoring) continue.

### 1.3 What This Architecture Does NOT Cover

This document covers the Central AI Engine exclusively. It does not cover:
- Frontend/mobile UI implementation (Next.js, Expo)
- Authentication/authorization systems (Clerk, Permify)
- Database schema design (covered in Technical Architecture Blueprint)
- DevOps/CI/CD infrastructure
- Non-AI backend logic (fee calculation, attendance recording, etc.)

The Central AI Engine is called BY the other five engines (Student, Faculty, Compliance, Admin, Integration) via internal API contracts defined in Section 10.

---

## 2. SYSTEM TOPOLOGY — THE 4-LAYER AI STACK

```
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                            │
│   Student Engine │ Faculty Engine │ Compliance │ Admin │ Integration │
│   (Next.js / Expo / FastAPI endpoints)                              │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Internal API Calls
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                               │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  LangGraph   │  │   Prompt     │  │   Task       │              │
│  │  Supervisor  │  │   Chain      │  │   Queue      │              │
│  │  Graphs      │  │   Workflows  │  │   (Celery)   │              │
│  │  (5 Core IP) │  │  (26 agents) │  │  Background  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                       │
│  ┌──────┴─────────────────┴──────────────────┴───────┐              │
│  │              SHARED INFRASTRUCTURE                 │              │
│  │  L2: Cognitive Preservation Pipeline               │              │
│  │  L3: Medical Safety Pipeline                       │              │
│  │  L4: Question Intelligence Layer                   │              │
│  │  L6: Prompt Registry                               │              │
│  └──────────────────────┬────────────────────────────┘              │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INTELLIGENCE LAYER                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │                L5: AI GATEWAY                            │        │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │        │
│  │  │ Budget  │  │ Model    │  │ Prompt   │  │ Exec    │ │        │
│  │  │ Control │  │ Router   │  │ Cache    │  │ Logger  │ │        │
│  │  └─────────┘  └──────────┘  └──────────┘  └─────────┘ │        │
│  └──────────────────────┬──────────────────────────────────┘        │
│                         │                                           │
│  ┌──────────────────────┴──────────────────────────────────┐        │
│  │              LLM PROVIDERS                              │        │
│  │  Claude Sonnet 4.5  │  Claude Haiku 4.5  │  Batch API  │        │
│  │  (reasoning/gen)    │  (structured/fast)  │  (bulk ops) │        │
│  └─────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │            L7: MCP TOOL SERVERS                           │       │
│  │                                                           │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │       │
│  │  │  Medical     │  │  Student     │  │  Compliance  │   │       │
│  │  │  Knowledge   │  │  Analytics   │  │  Data        │   │       │
│  │  │  Server      │  │  Server      │  │  Server      │   │       │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │       │
│  │  │  Faculty     │  │  Assessment  │  │  Content     │   │       │
│  │  │  Data        │  │  & Question  │  │  Repository  │   │       │
│  │  │  Server      │  │  Bank Server │  │  Server      │   │       │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │       │
│  │         │                 │                  │            │       │
│  └─────────┴─────────────────┴──────────────────┴────────────┘       │
│                              │                                       │
│  ┌───────────────────────────┴───────────────────────────────┐       │
│  │                    L1: MEDICAL RAG ENGINE                  │       │
│  │                                                           │       │
│  │  Layer 1: BM25 (PostgreSQL FTS + medical dictionaries)    │       │
│  │  Layer 2: pgvector semantic search (text-embedding-3-large)│      │
│  │  Layer 3: Knowledge Graph traversal (PostgreSQL + Neo4j)  │       │
│  │  Layer 4: Agentic retrieval router (query classification) │       │
│  │  Fusion: Reciprocal Rank Fusion + Cross-Encoder Reranking │       │
│  └───────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐          │
│  │  Neon         │  │  Neo4j        │  │  Cloudflare    │          │
│  │  PostgreSQL   │  │  Knowledge    │  │  R2            │          │
│  │  + pgvector   │  │  Graph        │  │  (PDFs/media)  │          │
│  └───────────────┘  └───────────────┘  └────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Layer Responsibilities

**Application Layer:** Receives user requests through REST/WebSocket endpoints. Routes AI-requiring requests to the Orchestration Layer. Handles SSE streaming for real-time AI responses.

**Orchestration Layer:** Decides HOW to fulfill an AI request. Core IP features use LangGraph supervisor graphs with sub-agents. Standard features use prompt chain workflows — sequential LLM calls with deterministic routing. Background tasks (metacognitive capture, compliance monitoring) run as Celery tasks on scheduled or event-driven triggers.

**Intelligence Layer:** The AI Gateway manages all LLM provider interactions. Handles model selection, cost control, prompt caching, execution logging, and fallback routing. No agent directly calls an LLM provider — everything goes through the Gateway.

**Data Layer:** MCP tool servers provide standardized interfaces between agents and data stores. The Medical RAG Engine handles all knowledge retrieval. PostgreSQL (Neon) stores structured data and vector embeddings. Neo4j stores medical knowledge graph relationships. Cloudflare R2 stores uploaded PDFs and media content.

---

## 3. AGENT CLASSIFICATION & AUTONOMY TIERS

### 3.1 Classification System

Every AI capability in Acolyte falls into one of four architectural categories:

| Category | Symbol | Architecture | Human-in-Loop | Count |
|----------|--------|-------------|---------------|-------|
| Core IP | 🔴 | LangGraph supervisor graph with sub-agents | Varies by feature | 5 |
| Specialized Agent | 🟠 | Single agent, domain-specific tools, focused prompts | Usually draft-and-approve | 14 |
| Helper/Copilot | 🟡 | Shared copilot framework, swappable system prompt + tools | Advisory | 7 |
| Background Processor | 🟢 | Celery task, event/schedule-driven, no direct UI | Autonomous with alerts | 4 |

**Plus 7 shared infrastructure layers (⚫) that power all agents.**

### 3.2 Autonomy Tiers

Every agent operates within one of three autonomy tiers. The tier determines whether AI output goes directly to the user or requires human review.

**Tier 1 — Fully Autonomous (Fire and Forget)**
AI output is used directly without human review. Reserved for low-stakes, high-volume operations where the cost of a wrong output is negligible.

Examples: Question bank auto-tagging, attendance threshold alerts, fee calculations, grade computation, competency dashboard aggregation, notification routing.

Safety net: All Tier 1 outputs are logged and can be audited. Anomaly detection flags statistical outliers for retrospective review.

**Tier 2 — AI-Assisted (Draft and Approve)**
AI generates output, a human reviews and approves before it becomes official. Used for content generation and medium-stakes decisions.

Examples: MCQ generation (faculty approves), lesson plan templates (faculty customizes), SAF auto-population (Dean reviews), exam paper blueprints (moderator approves), clinical rotation schedules (admin confirms).

Safety net: Output includes a confidence score. Low-confidence outputs are flagged with specific concerns highlighted for the reviewer.

**Tier 3 — Intelligence/Advisory (AI Recommends, Human Decides)**
AI analyzes data and provides recommendations or insights. The human makes the decision. Used for high-stakes or subjective decisions.

Examples: At-risk student identification (faculty decides intervention), compliance prediction (Dean decides action), study recommendations (student decides what to study), mentoring insights (faculty decides approach).

Safety net: Recommendations include reasoning traces and data sources so the human can evaluate the basis for the recommendation.

### 3.3 Why This Classification Matters for Implementation

The classification directly determines how each capability is built:

```python
# Core IP (🔴) — Full LangGraph supervisor graph
graph = StateGraph(SocraticEngineState)
graph.add_node("assess_knowledge", assess_student_knowledge)
graph.add_node("detect_misconceptions", detect_misconceptions)
graph.add_node("build_scaffold", build_scaffolding_question)
graph.add_node("preservation_gate", cognitive_preservation_check)
# ... complex conditional routing, cycles, checkpointing

# Specialized Agent (🟠) — Single agent with tools
agent = create_react_agent(
    model=ChatAnthropic(model="claude-sonnet-4-5-20250929"),
    tools=[flashcard_generator, spaced_repetition_scheduler, medical_rag],
    system_prompt=prompt_registry.get("flashcard_generator", college_id)
)

# Helper/Copilot (🟡) — Shared framework, different config
copilot = AcolyteCopilot(
    role="faculty_class_prep",
    system_prompt=prompt_registry.get("class_prep_ta", college_id),
    tools=["medical_rag", "timetable_lookup", "content_repository", "image_search"],
    bridge_layer_enabled=False  # Faculty copilots don't need Bridge Layer
)

# Background Processor (🟢) — Celery task
@celery.task(bind=True, max_retries=3)
def capture_metacognitive_event(self, event_data: dict):
    # No LLM call — pure data pipeline with computed metrics
    metrics = compute_metacognitive_metrics(event_data)
    store_metrics(metrics)
    check_alert_thresholds(metrics)
```

---

## 4. SHARED INFRASTRUCTURE LAYERS (L1–L7)

These are not agents. They are the architectural backbone that all 30 agents consume.

### L1: Medical RAG Engine — 4-Layer Hybrid Retrieval Stack

The Medical RAG Engine is Acolyte's primary knowledge retrieval system. It serves every agent that needs medical content — study buddy, question generators, flashcard creators, class prep assistants, and more.

#### Architecture: Agentic Graph-Enhanced Hybrid RAG

Research in medical RAG systems (MedRAG 2025, DR.KNOWS 2025, Agentic Graph RAG for Hepatology 2025) demonstrates that standard vector-only RAG fails for medical content because:
- Medical terminology requires exact matching (drug dosages, diagnostic criteria, ICD codes)
- Clinical reasoning requires multi-hop relationship traversal (disease → symptoms → differential diagnoses → investigations)
- Dense vector retrieval returns semantically similar but clinically irrelevant passages
- Medical content has strict hierarchical structure (organ systems → diseases → subtypes → management)

Acolyte's solution: a 4-layer retrieval stack with an agentic router that selects the optimal retrieval strategy per query.

```
┌─────────────────────────────────────────────────────────────┐
│                  AGENTIC RETRIEVAL ROUTER                    │
│                                                             │
│  Query → Classify → Select Strategy → Execute → Fuse → Rank│
│                                                             │
│  Strategy Selection (lightweight classifier):               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ "What is the dose of Metformin?" → BM25 primary     │    │
│  │ "Conditions with fever and joint pain" → Vector primary│   │
│  │ "Differential diagnosis of chest pain" → Graph primary│   │
│  │ "Explain pathophysiology of MI" → Vector + Graph     │    │
│  │ "Compare ACE inhibitors vs ARBs" → All layers       │    │
│  └─────────────────────────────────────────────────────┘    │
└──────┬──────────┬──────────────┬────────────────┬───────────┘
       │          │              │                │
       ▼          ▼              ▼                ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐
│ Layer 1  │ │ Layer 2  │ │   Layer 3    │ │   Layer 4    │
│ BM25     │ │ pgvector │ │  Knowledge   │ │   Agentic    │
│ Keyword  │ │ Semantic │ │  Graph       │ │   Iterative  │
│ Search   │ │ Search   │ │  Traversal   │ │   Refinement │
└──────────┘ └──────────┘ └──────────────┘ └──────────────┘
       │          │              │                │
       ▼          ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│              RECIPROCAL RANK FUSION (RRF)                   │
│                                                             │
│  score(d) = Σ 1/(k + rank_i(d))  where k=60               │
│                                                             │
│  Combines rankings from all active layers                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              CROSS-ENCODER RERANKER                          │
│                                                             │
│  Model: cross-encoder/ms-marco-MiniLM-L-12-v2              │
│  OR: Cohere Rerank v3 (medical domain fine-tuned)           │
│  Input: (query, passage) pairs from RRF top-20              │
│  Output: Reranked top-5 with relevance scores               │
│                                                             │
│  Medical-specific reranking signals:                        │
│  - Source authority (Harrison's > blog post)                │
│  - Recency (latest guidelines > outdated)                   │
│  - Specificity match (exact topic > general overview)       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              CONTEXT ASSEMBLY                                │
│                                                             │
│  Retrieved passages + source metadata + page numbers        │
│  + confidence scores + knowledge graph paths                │
│  → Assembled into structured context for the LLM            │
│                                                             │
│  Format:                                                    │
│  <source book="Harrison's Internal Medicine" chapter="12"   │
│    page="347" relevance="0.94">                             │
│    Passage text here...                                      │
│  </source>                                                  │
└─────────────────────────────────────────────────────────────┘
```

#### Layer 1: BM25 Keyword Search

```python
# PostgreSQL full-text search with medical dictionary
# Uses ts_vector with custom medical lexeme configuration

class BM25MedicalSearch:
    """
    BM25 keyword search optimized for medical terminology.
    
    Why BM25 for medical content:
    - Drug names (Metformin, Atorvastatin) need exact matching
    - Dosage queries ("500mg BD") are not semantic
    - ICD codes, competency codes (PH 1.5) require precise matching
    - Medical abbreviations (MI, CHF, COPD) must match exactly
    
    Medical dictionary includes:
    - SNOMED CT terms
    - ICD-11 codes
    - Drug names (generic + brand)
    - Anatomical terms (Gray's Anatomy nomenclature)
    - NMC competency codes
    """
    
    async def search(
        self,
        query: str,
        college_id: UUID,
        filters: MedicalSearchFilters | None = None,
        top_k: int = 10
    ) -> list[RetrievalResult]:
        # PostgreSQL tsvector query with medical dictionary
        sql = """
        SELECT id, content, source_metadata,
               ts_rank_cd(search_vector, plainto_tsquery('medical', $1)) as rank
        FROM medical_content
        WHERE college_id = $2
          AND search_vector @@ plainto_tsquery('medical', $1)
        ORDER BY rank DESC
        LIMIT $3
        """
        # filters applied: subject, topic, organ_system, content_type
```

#### Layer 2: pgvector Semantic Search

```python
class SemanticMedicalSearch:
    """
    Dense vector search using pgvector with IVFFlat indexes.
    
    Embedding model: text-embedding-3-large (3072 dimensions)
    Future migration: MedCPT (medical-domain-specific embeddings)
    
    Why IVFFlat over HNSW for Acolyte:
    - Better recall at lower memory footprint
    - Medical content corpus is bounded (institutional PDFs)
    - Update patterns are batch (new content uploaded periodically)
    - IVFFlat handles this better than HNSW's real-time indexing
    
    Multi-table architecture:
    - medical_topics (general medical knowledge chunks)
    - medical_diseases (disease-specific content)
    - medical_drugs (pharmacology content)
    - medical_procedures (surgical/clinical procedures)
    - medical_investigations (diagnostic tests, lab values)
    - college_content (institution-specific uploaded PDFs)
    """
    
    async def search(
        self,
        query: str,
        college_id: UUID,
        tables: list[str] | None = None,  # Which tables to search
        filters: MedicalSearchFilters | None = None,
        top_k: int = 10
    ) -> list[RetrievalResult]:
        # Generate query embedding
        embedding = await self.embed(query)
        
        # Search across specified tables (or all)
        # Uses pgvector's <=> cosine distance operator
        # IVFFlat index with probes=10 for recall/speed balance
        sql = """
        SET ivfflat.probes = 10;
        SELECT id, content, source_metadata,
               1 - (embedding <=> $1::vector) as similarity
        FROM {table}
        WHERE college_id = $2
          AND 1 - (embedding <=> $1::vector) > 0.5  -- similarity threshold
        ORDER BY embedding <=> $1::vector
        LIMIT $3
        """
```

#### Layer 3: Knowledge Graph Traversal

```python
class MedicalKnowledgeGraph:
    """
    Graph-based retrieval for multi-hop medical reasoning.
    
    Architecture: Dual-store
    - PostgreSQL: Stores nodes and edges with properties (transactional)
    - Neo4j: Stores same graph for complex traversals (analytical)
    
    Graph Schema (medical entities and relationships):
    
    (Disease) -[HAS_SYMPTOM]-> (Symptom)
    (Disease) -[TREATED_BY]-> (Drug)
    (Disease) -[INVESTIGATED_BY]-> (Investigation)
    (Disease) -[DIFFERENTIAL_OF]-> (Disease)
    (Drug) -[CONTRAINDICATED_IN]-> (Condition)
    (Drug) -[INTERACTS_WITH]-> (Drug)
    (Drug) -[MECHANISM]-> (Pathway)
    (Procedure) -[INDICATED_FOR]-> (Disease)
    (Procedure) -[COMPLICATION]-> (Condition)
    (Topic) -[PART_OF]-> (Subject)
    (Topic) -[INTEGRATES_WITH]-> (Topic)
    (Competency) -[COVERS]-> (Topic)
    (Competency) -[ASSESSED_BY]-> (AssessmentType)
    
    Why graph retrieval for medical education:
    
    1. Distractor generation: "What is NOT a symptom of Rheumatic Fever?"
       → Traverse (RheumaticFever)-[HAS_SYMPTOM]->(symptoms) to get correct answers
       → Traverse (RheumaticFever)-[DIFFERENTIAL_OF]->(SimilarDiseases)-[HAS_SYMPTOM]->
         (symptoms) to get plausible distractors from differential diagnoses
    
    2. Clinical reasoning chains: "Patient has fever + joint pain + rash"
       → Find diseases connected to ALL three symptoms
       → Rank by number of matching symptom edges
       → Return differential diagnosis list with reasoning paths
    
    3. Drug interaction checks: "Can you give Warfarin with Aspirin?"
       → Direct edge query (Warfarin)-[INTERACTS_WITH]->(Aspirin)
       → Return interaction type, severity, mechanism
    
    4. Integration mapping: "What topics connect Anatomy and Pharmacology?"
       → Traverse (Topic)-[INTEGRATES_WITH]->(Topic) across subjects
       → Return horizontal/vertical integration opportunities
    """
    
    async def traverse(
        self,
        query_type: GraphQueryType,
        start_entities: list[str],
        max_hops: int = 3,
        college_id: UUID = None
    ) -> GraphTraversalResult:
        
        if query_type == GraphQueryType.DIFFERENTIAL_DIAGNOSIS:
            # Cypher query for Neo4j
            cypher = """
            MATCH (d:Disease {name: $disease_name})
            MATCH (d)-[:HAS_SYMPTOM]->(s:Symptom)
            WITH d, collect(s) as symptoms
            MATCH (other:Disease)-[:HAS_SYMPTOM]->(s2:Symptom)
            WHERE other <> d AND s2 IN symptoms
            WITH other, count(s2) as shared_symptoms, size(symptoms) as total
            RETURN other.name as differential,
                   shared_symptoms,
                   toFloat(shared_symptoms)/total as overlap_ratio
            ORDER BY overlap_ratio DESC
            LIMIT 10
            """
        
        elif query_type == GraphQueryType.DISTRACTOR_GENERATION:
            # Find plausible wrong answers from differential diagnoses
            cypher = """
            MATCH (d:Disease {name: $disease_name})-[:HAS_SYMPTOM]->(correct:Symptom)
            WITH d, collect(correct.name) as correct_symptoms
            MATCH (d)-[:DIFFERENTIAL_OF]->(diff:Disease)-[:HAS_SYMPTOM]->(wrong:Symptom)
            WHERE NOT wrong.name IN correct_symptoms
            RETURN wrong.name as distractor_symptom,
                   diff.name as source_disease,
                   count(*) as plausibility_score
            ORDER BY plausibility_score DESC
            """
        
        elif query_type == GraphQueryType.CLINICAL_REASONING:
            # Multi-hop path from symptoms to diagnosis
            cypher = """
            UNWIND $symptoms as symptom_name
            MATCH (s:Symptom {name: symptom_name})<-[:HAS_SYMPTOM]-(d:Disease)
            WITH d, collect(s.name) as matched, count(s) as match_count
            WHERE match_count >= $min_matches
            OPTIONAL MATCH (d)-[:INVESTIGATED_BY]->(i:Investigation)
            OPTIONAL MATCH (d)-[:TREATED_BY]->(drug:Drug)
            RETURN d.name as diagnosis,
                   matched as matching_symptoms,
                   match_count,
                   collect(DISTINCT i.name) as suggested_investigations,
                   collect(DISTINCT drug.name) as first_line_treatment
            ORDER BY match_count DESC
            """
```

#### Layer 4: Agentic Retrieval Router

```python
class AgenticRetrievalRouter:
    """
    Lightweight classifier that determines retrieval strategy per query.
    
    Uses a small, fast model (Haiku) to classify query intent and select
    which combination of Layers 1-3 to activate.
    
    Classification taxonomy:
    - FACTUAL: "What is the dose of X?" → BM25 primary
    - CONCEPTUAL: "Explain pathophysiology of X" → Vector primary
    - RELATIONAL: "Differential diagnosis of X" → Graph primary
    - COMPARATIVE: "Compare X vs Y" → All layers
    - PROCEDURAL: "Steps for performing X" → Vector + BM25
    - CLINICAL_VIGNETTE: "35yo male with..." → Graph + Vector
    
    The router also handles retrieval failure:
    - If initial retrieval returns < 3 results → broaden query terms
    - If confidence scores are all < 0.5 → try alternative strategy
    - If graph traversal returns empty → fall back to vector search
    
    This implements the Agentic RAG pattern: the retrieval system itself
    is an agent that reasons about HOW to retrieve, not just WHAT to retrieve.
    """
    
    CLASSIFICATION_PROMPT = """
    You are a medical query classifier. Classify the following query into
    exactly one category and determine the optimal retrieval strategy.
    
    Categories:
    - FACTUAL: Specific facts, dosages, values, codes, definitions
    - CONCEPTUAL: Explanations, mechanisms, pathophysiology
    - RELATIONAL: Differentials, connections, interactions, comparisons
    - CLINICAL_VIGNETTE: Patient scenarios requiring multi-entity reasoning
    - PROCEDURAL: Step-by-step processes, techniques, protocols
    
    Query: {query}
    
    Respond with the category and which retrieval layers to activate.
    """
    
    async def route(
        self,
        query: str,
        context: RetrievalContext
    ) -> RetrievalPlan:
        # Classify query using Haiku (fast, cheap)
        classification = await self.ai_gateway.complete_structured(
            system_prompt=self.CLASSIFICATION_PROMPT,
            user_message=query,
            output_schema=QueryClassification,
            model="claude-haiku-4-5",
            task_type="retrieval_routing"
        )
        
        # Build retrieval plan
        plan = RetrievalPlan(
            layers=classification.active_layers,
            primary_layer=classification.primary_layer,
            bm25_boost=classification.exact_match_weight,
            graph_hops=classification.max_hops,
            reranking_enabled=True,
            metadata_filters=context.filters
        )
        
        return plan
```

### L2: Cognitive Preservation Pipeline (Bridge Layer Enforcement)

```python
class CognitivePreservationPipeline:
    """
    THE ARCHITECTURAL GUARANTEE OF BRIDGE LAYER AI.
    
    Every student-facing AI response passes through this pipeline
    BEFORE delivery. This is NOT a prompt instruction — it is a
    deterministic gate that structurally prevents the AI from
    giving direct answers to students.
    
    Pipeline stages:
    1. DirectAnswerDetector — flags responses that give away answers
    2. ScaffoldingEvaluator — checks if response promotes thinking
    3. DifficultyCalibrator — ensures scaffolding matches student level
    4. CognitiveLoadChecker — prevents information overload
    5. SourceCitationVerifier — ensures claims reference specific sources
    
    If a response fails ANY stage, it is REJECTED and sent back to
    the generating agent with specific instructions for regeneration.
    Maximum regeneration attempts: 3. After 3 failures, the response
    is routed to a fallback Socratic template.
    
    This pipeline does NOT apply to:
    - Faculty-facing responses (faculty gets direct answers)
    - Admin/compliance outputs (not educational content)
    - Factual data retrieval (attendance, grades, schedules)
    - Emergency/safety content (never Socratic — direct and clear)
    """
    
    class PreservationResult(BaseModel):
        passed: bool
        stage_results: list[StageResult]
        regeneration_instructions: str | None
        cognitive_engagement_score: float  # 0.0 to 1.0
        scaffolding_level: str  # "hint", "guided_question", "decomposition", "analogy"
    
    DIRECT_ANSWER_DETECTION_PROMPT = """
    You are evaluating whether an AI response GIVES AWAY the answer
    to a medical question, or whether it GUIDES the student to discover
    the answer through their own thinking.
    
    A response FAILS if it:
    - States the diagnosis, answer, or conclusion directly
    - Provides a complete list of steps/criteria without asking the student to reason
    - Explains the full mechanism without asking the student what they think first
    - Uses phrases like "The answer is...", "This is caused by...", "You should know that..."
    
    A response PASSES if it:
    - Asks a question that guides toward the answer
    - Breaks the problem into smaller pieces for the student to solve
    - Refers the student to specific pages/sections to find the answer themselves
    - Acknowledges what the student knows and builds on it with a follow-up question
    - Uses Socratic patterns: "What do you think would happen if...?"
    - Provides a partial framework and asks the student to complete it
    
    Student's question: {student_question}
    AI's proposed response: {ai_response}
    Student's current knowledge level: {knowledge_level}
    
    Evaluate strictly. Medical education requires students to THINK,
    not receive pre-packaged answers.
    """
    
    async def evaluate(
        self,
        student_question: str,
        ai_response: str,
        student_profile: StudentProfile,
        context: ConversationContext
    ) -> PreservationResult:
        
        # Stage 1: Direct answer detection
        detection = await self.ai_gateway.complete_structured(
            system_prompt=self.DIRECT_ANSWER_DETECTION_PROMPT,
            user_message=f"Question: {student_question}\nResponse: {ai_response}",
            output_schema=DirectAnswerDetection,
            model="claude-haiku-4-5",  # Fast check
            task_type="bridge_layer_check"
        )
        
        if detection.gives_direct_answer:
            return PreservationResult(
                passed=False,
                regeneration_instructions=(
                    f"Your response directly answered the student's question. "
                    f"Instead, {detection.suggested_socratic_approach}. "
                    f"The student's ZPD is at '{student_profile.zpd_level}' level. "
                    f"Ask a question that helps them discover the answer in "
                    f"'{context.active_source}' chapter {context.chapter}."
                ),
                cognitive_engagement_score=detection.engagement_score
            )
        
        # Stage 2: Scaffolding evaluation
        # Stage 3: Difficulty calibration against student ZPD
        # Stage 4: Cognitive load check (not too many concepts at once)
        # Stage 5: Source citation verification
        
        # All stages passed
        return PreservationResult(
            passed=True,
            cognitive_engagement_score=combined_score,
            scaffolding_level=calibrated_level
        )
```

### L3: Medical Safety Pipeline

```python
class MedicalSafetyPipeline:
    """
    Multi-layer validation for all AI-generated medical content.
    
    Every piece of medical content (questions, explanations, flashcards,
    recommendations) passes through this pipeline. The threshold
    determines whether content is auto-approved, queued for review,
    or rejected.
    
    Thresholds (configurable per college):
    - Auto-approve: confidence > 0.95 (low-stakes content only)
    - Human review: confidence 0.70 - 0.95
    - Reject: confidence < 0.70
    - OVERRIDE: All summative assessment content ALWAYS requires
      human review regardless of confidence score
    """
    
    async def validate(self, content: MedicalContent) -> SafetyResult:
        checks = []
        
        # Check 1: Source grounding verification
        # Is every medical claim supported by RAG sources?
        grounding = await self._check_source_grounding(content)
        checks.append(grounding)
        
        # Check 2: Clinical accuracy validation
        # Cross-reference claims against medical knowledge base
        accuracy = await self._check_clinical_accuracy(content)
        checks.append(accuracy)
        
        # Check 3: Multi-model ensemble variance
        # If two models disagree significantly → low confidence
        if content.requires_high_accuracy:
            ensemble = await self._check_ensemble_variance(content)
            checks.append(ensemble)
        
        # Check 4: Bias detection
        # Demographic, cultural, gender stereotypes in clinical scenarios
        bias = await self._check_bias(content)
        checks.append(bias)
        
        # Check 5: Item-writing flaw detection (for questions only)
        if content.content_type in ["MCQ", "SAQ", "LAQ", "EMQ"]:
            item_writing = await self._check_item_writing_standards(content)
            checks.append(item_writing)
        
        # Check 6: Bloom's level verification (for questions only)
        if content.declared_blooms_level:
            blooms = await self._check_blooms_alignment(content)
            checks.append(blooms)
        
        # Calculate overall confidence
        overall = self._calculate_overall_confidence(checks)
        
        # Apply threshold routing
        if content.is_summative_assessment:
            recommendation = "needs_faculty_review"  # ALWAYS
        elif overall > 0.95:
            recommendation = "auto_approve"
        elif overall > 0.70:
            recommendation = "needs_faculty_review"
        else:
            recommendation = "reject"
        
        return SafetyResult(
            passed=(recommendation != "reject"),
            overall_confidence=overall,
            checks=checks,
            recommendation=recommendation
        )
    
    async def _check_item_writing_standards(self, content):
        """
        NBME Item-Writing Guide 6th Edition compliance check.
        
        Detects 19 common item-writing flaws:
        1. Absolute terms (always, never, all, none)
        2. Grammatical cues (article agreement revealing answer)
        3. Longest-answer bias (correct answer significantly longer)
        4. "All of the above" / "None of the above"
        5. Implausible distractors (obviously wrong)
        6. Negative stems without emphasis (NOT, EXCEPT without caps/bold)
        7. Window dressing (irrelevant clinical details)
        8. Convergence cues (overlapping options)
        9. Heterogeneous options (mixing categories)
        10. K-type items ("which combination is correct")
        11. Vague terms ("usually", "frequently")
        12. Tricky or misleading stems
        13. Unfocused stems (no clear question asked)
        14. Non-independent options (one implies another)
        15. Word repeats between stem and correct answer
        16. Testwise cues (formatting differences)
        17. Logical cues (options that are subsets of each other)
        18. Correct answer in consistent position
        19. Missing "single best answer" framing
        """
```

### L4: Question Intelligence Layer

```python
class QuestionIntelligenceLayer:
    """
    Cross-engine learning system. The MOAT.
    
    Faculty generates questions through F1 (Exam Question Generator)
    → System captures patterns per college:
      - Difficulty distribution preferences
      - Clinical scenario styles (detailed vignette vs. brief stem)
      - Distractor patterns (differential-based vs. related-but-wrong)
      - Bloom's level distribution (how much recall vs. application)
      - Topic emphasis (which topics get more questions)
      - Question length preferences
      - Key phrase patterns
    
    → These patterns are made available to Student Engine:
      S2 (Practice Question Generator) uses them to generate
      practice questions that MIRROR the faculty's exam style
    
    → Per-college learned model:
      Each college's faculty develops its own question culture.
      The student experience adapts to THEIR college, not generic questions.
    
    Data flow:
    Faculty Engine (F1) → writes to → Question Intelligence Store
    Student Engine (S2, S3, S4) → reads from → Question Intelligence Store
    
    Implementation: PostgreSQL JSONB columns on question_bank_items table
    + periodic batch analysis job that computes faculty patterns per college
    """
    
    async def capture_faculty_pattern(
        self,
        question: QuestionBankItem,
        college_id: UUID,
        faculty_id: UUID
    ):
        """Called every time a faculty member approves a generated question."""
        pattern = FacultyQuestionPattern(
            college_id=college_id,
            faculty_id=faculty_id,
            department=question.subject,
            difficulty_rating=question.difficulty_rating,
            blooms_level=question.blooms_level,
            stem_length=len(question.stem),
            vignette_style=self._classify_vignette_style(question.stem),
            distractor_strategy=self._analyze_distractor_strategy(question),
            competency_code=question.competency_code,
            timestamp=datetime.utcnow()
        )
        await self.pattern_store.save(pattern)
    
    async def get_college_question_profile(
        self,
        college_id: UUID,
        subject: str | None = None
    ) -> CollegeQuestionProfile:
        """
        Returns the aggregated question style for a college.
        Used by student practice generators to mirror exam style.
        """
        patterns = await self.pattern_store.get_recent(
            college_id=college_id,
            subject=subject,
            limit=500  # Last 500 faculty-approved questions
        )
        
        return CollegeQuestionProfile(
            difficulty_distribution=self._compute_distribution(patterns, "difficulty"),
            blooms_distribution=self._compute_distribution(patterns, "blooms_level"),
            avg_stem_length=mean([p.stem_length for p in patterns]),
            preferred_vignette_style=mode([p.vignette_style for p in patterns]),
            distractor_strategies=Counter([p.distractor_strategy for p in patterns]),
            topic_emphasis=self._compute_topic_weights(patterns)
        )
```

### L5: AI Gateway

```python
class AIGateway:
    """
    Single entry point for ALL LLM provider interactions.
    No agent or workflow calls an LLM directly — everything
    goes through the Gateway.
    
    Responsibilities:
    1. Budget control per college (monthly token limits)
    2. Model routing and automatic fallback
    3. Prompt caching (Anthropic cache_control for 90% cost reduction)
    4. Execution logging (every call tracked with tokens, cost, latency)
    5. Batch API routing for overnight bulk operations (50% discount)
    6. Rate limiting per college
    7. Error handling and retry logic
    
    Model Strategy:
    ┌────────────────────────────────────────────────────────┐
    │ Task Type          │ Primary Model  │ Fallback         │
    ├────────────────────┼────────────────┼──────────────────┤
    │ Complex reasoning  │ Sonnet 4.5     │ Haiku 4.5        │
    │ Socratic dialogue  │ Sonnet 4.5     │ Haiku 4.5        │
    │ Question generation│ Sonnet 4.5     │ Haiku 4.5        │
    │ Structured extract │ Haiku 4.5      │ —                │
    │ Classification     │ Haiku 4.5      │ —                │
    │ Safety validation  │ Sonnet 4.5     │ Haiku 4.5        │
    │ Bulk processing    │ Batch API      │ Haiku 4.5        │
    │ Embeddings         │ text-embed-3-lg│ —                │
    └────────────────────────────────────────────────────────┘
    
    Budget tiers (automatic):
    - Budget < 80%: Use primary models
    - Budget 80-100%: Downgrade to Haiku for non-critical tasks
    - Budget > 100%: Disable non-critical AI features
    - OVERRIDE: Compliance monitoring NEVER disabled
    """
    
    async def complete(
        self,
        system_prompt: str,
        user_message: str,
        messages: list[dict] | None = None,
        model: str = "claude-sonnet-4-5-20250929",
        tools: list[dict] | None = None,
        college_id: UUID = None,
        user_id: UUID = None,
        task_type: str = "general",
        cache_system_prompt: bool = True,
        enable_thinking: bool = False,
        thinking_budget: int = 10000
    ) -> AIResponse:
        
        # 1. Check budget
        budget_status = await self._check_budget(college_id)
        if budget_status == "exceeded" and task_type not in CRITICAL_TASKS:
            raise BudgetExceededException(college_id)
        if budget_status == "warning":
            model = self._downgrade_model(model)
        
        # 2. Build request with prompt caching
        request_params = {
            "model": model,
            "max_tokens": self._get_max_tokens(task_type),
            "messages": self._build_messages(system_prompt, user_message, messages),
        }
        
        # Anthropic prompt caching: 90% cost reduction on cached system prompts
        if cache_system_prompt and len(system_prompt) > 1024:
            request_params["system"] = [{
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }]
        
        # Extended thinking for complex reasoning tasks
        if enable_thinking:
            request_params["thinking"] = {
                "type": "enabled",
                "budget_tokens": thinking_budget
            }
        
        # Tools
        if tools:
            request_params["tools"] = tools
        
        # 3. Execute with retry logic
        start_time = time.monotonic()
        try:
            response = await self.anthropic.messages.create(**request_params)
        except anthropic.RateLimitError:
            await asyncio.sleep(2)
            response = await self.anthropic.messages.create(**request_params)
        
        latency_ms = (time.monotonic() - start_time) * 1000
        
        # 4. Log execution
        await self._log_execution(
            college_id=college_id,
            user_id=user_id,
            task_type=task_type,
            model=model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            cache_read_tokens=getattr(response.usage, 'cache_read_input_tokens', 0),
            latency_ms=latency_ms,
            cost=self._calculate_cost(response.usage, model)
        )
        
        return AIResponse(
            content=response.content,
            model=model,
            usage=response.usage,
            latency_ms=latency_ms
        )
    
    async def complete_structured(
        self,
        system_prompt: str,
        user_message: str,
        output_schema: Type[BaseModel],
        model: str = "claude-sonnet-4-5-20250929",
        **kwargs
    ) -> BaseModel:
        """
        Structured output using Anthropic's constrained decoding.
        The model CANNOT produce invalid JSON — grammar-restricted at inference.
        
        Used for: MCQ generation, compliance reports, SAF forms,
        classifications, data extraction — anything needing guaranteed schema.
        """
        response = await self.complete(
            system_prompt=system_prompt,
            user_message=user_message,
            model=model,
            output_config={
                "format": {
                    "type": "json_schema",
                    "schema": transform_schema(output_schema),
                }
            },
            **kwargs
        )
        return output_schema.model_validate_json(response.content[0].text)
    
    async def stream(
        self,
        system_prompt: str,
        user_message: str,
        model: str = "claude-sonnet-4-5-20250929",
        **kwargs
    ) -> AsyncIterator[StreamChunk]:
        """
        SSE streaming for real-time chat interfaces.
        Used by: Socratic Study Buddy, Copilot Chat, Class Prep TA.
        """
        async with self.anthropic.messages.stream(
            model=model,
            system=[{"type": "text", "text": system_prompt,
                     "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_message}],
            max_tokens=4096,
            **kwargs
        ) as stream:
            async for event in stream:
                yield StreamChunk(
                    type=event.type,
                    text=getattr(event, 'text', ''),
                    thinking=getattr(event, 'thinking', '')
                )
    
    async def batch(
        self,
        requests: list[BatchRequest],
        college_id: UUID,
        task_type: str
    ) -> str:
        """
        Claude Batch API — 50% cost discount, 24-hour turnaround.
        Used for: Overnight MCQ bank generation, bulk compliance reports,
        mass question re-evaluation, periodic content quality audits.
        """
        batch = await self.anthropic.batches.create(
            requests=[r.to_anthropic_request() for r in requests]
        )
        
        # Store batch_id for polling
        await self._store_batch_job(batch.id, college_id, task_type)
        return batch.id
```

### L6: Prompt Registry

```python
class PromptRegistry:
    """
    Versioned, centralized prompt management.
    
    Every system prompt for every agent is stored in the registry
    with version history. This enables:
    - A/B testing of prompt variations
    - Rollback if a prompt update degrades quality
    - Per-college prompt customization
    - Audit trail (what prompt was active when content was generated)
    - Evaluation-driven iteration (test → measure → update cycle)
    
    Storage: PostgreSQL table with JSONB content
    
    Table schema:
    - id: UUID
    - agent_id: str (e.g., "socratic_study_buddy")
    - version: int
    - prompt_text: text
    - variables: JSONB (template variables the prompt expects)
    - metadata: JSONB (author, changelog, A/B test group)
    - college_id: UUID | null (null = default, specific = override)
    - is_active: bool
    - created_at: timestamp
    - performance_metrics: JSONB (avg quality score, failure rate)
    """
    
    async def get(
        self,
        agent_id: str,
        college_id: UUID | None = None,
        version: int | None = None
    ) -> str:
        """
        Get the active prompt for an agent.
        Priority: college-specific override > default active version
        """
        # Check for college-specific override first
        if college_id:
            override = await self._get_college_override(agent_id, college_id)
            if override:
                return override.prompt_text
        
        # Fall back to default active version
        if version:
            return await self._get_specific_version(agent_id, version)
        
        return await self._get_active_default(agent_id)
```

### L7: MCP Tool Servers

```python
"""
MCP Tool Server Architecture for Acolyte AI.

Following MCP best practices:
- Single responsibility: one domain per server
- Strict input/output schemas with Pydantic
- Tenant isolation enforced at tool level
- Read-only by default, write behind explicit authorization
- All tool calls logged for audit trail

Server inventory:
1. MedicalKnowledgeServer — RAG search, knowledge graph, guidelines
2. StudentAnalyticsServer — performance data, study patterns, IRT
3. ComplianceDataServer — attendance, faculty, thresholds, trends
4. FacultyDataServer — roster, publications, teaching metrics
5. AssessmentServer — question bank, exam papers, rubrics, results
6. ContentRepositoryServer — uploaded PDFs, lecture materials, media
7. SafetyValidationServer — clinical accuracy checks, bias detection

Adding new data sources = adding MCP tools.
No agent logic changes required.
"""

# Example: MedicalKnowledgeServer tool definitions
MEDICAL_KNOWLEDGE_TOOLS = [
    {
        "name": "search_medical_content",
        "description": """
        Search the medical knowledge base using hybrid retrieval
        (BM25 + vector + knowledge graph). Returns passages with
        source citations including book name, chapter, page number.
        
        Use this tool when you need to find medical information to
        answer a student's question, generate content, or verify claims.
        
        Returns: List of passages with source metadata and relevance scores.
        """,
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The medical question or topic to search for"
                },
                "subject_filter": {
                    "type": "string",
                    "description": "Optional: filter by subject (Anatomy, Pharmacology, etc.)"
                },
                "content_type_filter": {
                    "type": "string",
                    "enum": ["textbook", "guideline", "lecture", "all"],
                    "description": "Type of content to search"
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of results to return (default: 5)"
                }
            },
            "required": ["query"],
            "additionalProperties": False
        }
    },
    {
        "name": "get_differential_diagnoses",
        "description": """
        Query the medical knowledge graph for differential diagnoses
        given a set of symptoms or a primary diagnosis. Returns ranked
        differentials with shared symptom counts and distinguishing features.
        
        Use this tool when generating clinical vignette questions,
        creating distractor options, or helping students with
        diagnostic reasoning.
        
        Returns: Ranked list of differential diagnoses with reasoning paths.
        """,
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "symptoms": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of presenting symptoms"
                },
                "primary_diagnosis": {
                    "type": "string",
                    "description": "Optional: a specific diagnosis to find differentials for"
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum differentials to return (default: 5)"
                }
            },
            "required": [],
            "additionalProperties": False
        }
    },
    {
        "name": "get_drug_interactions",
        "description": """
        Check drug-drug interactions from the medical knowledge graph.
        Returns interaction type, severity, mechanism, and clinical significance.
        """,
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "drug_a": {"type": "string"},
                "drug_b": {"type": "string"}
            },
            "required": ["drug_a", "drug_b"],
            "additionalProperties": False
        }
    },
    {
        "name": "get_competency_details",
        "description": """
        Retrieve NMC competency details by code. Returns competency
        description, level (K/KH/S/SH/P), subject, teaching method,
        assessment requirements, and integration mappings.
        """,
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "competency_code": {
                    "type": "string",
                    "description": "NMC competency code (e.g., PH 1.5)"
                }
            },
            "required": ["competency_code"],
            "additionalProperties": False
        }
    },
    {
        "name": "get_misconceptions",
        "description": """
        Retrieve common student misconceptions for a given medical topic.
        Built from historical student interaction data and medical education
        research. Used by the Socratic Study Buddy to detect and address
        flawed mental models.
        
        Returns: List of known misconceptions with correct understanding
        and suggested Socratic questions to surface them.
        """,
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string"},
                "subject": {"type": "string"}
            },
            "required": ["topic"],
            "additionalProperties": False
        }
    }
]
```

---

## 5. STUDENT ENGINE AGENTS (S1–S9)

### S1: Socratic Study Buddy 🔴 Core IP

**Type:** LangGraph supervisor graph with sub-agents
**Autonomy:** Tier 3 (Advisory — guides, never tells)
**Streaming:** Yes (SSE to frontend)
**Stateful:** Yes (LangGraph checkpointing across sessions)
**Bridge Layer:** ENFORCED (L2 pipeline mandatory)

**Purpose:** The flagship student AI interaction. When a student asks a question while studying — reading a PDF, reviewing flashcards, or just thinking about a topic — the Study Buddy NEVER gives direct answers. It guides through Socratic questioning, citing specific sources from the student's materials, gradually scaffolding understanding until the student reaches the answer themselves.

**LangGraph State:**

```python
class SocraticEngineState(TypedDict):
    # Input
    student_id: UUID
    college_id: UUID
    question: str
    active_pdf: str | None  # Currently open PDF/book
    active_chapter: str | None
    active_page: int | None
    
    # Conversation
    messages: Annotated[list[BaseMessage], add_messages]
    turn_count: int
    
    # Student model (from metacognitive engine)
    student_knowledge_level: str  # "novice", "intermediate", "advanced"
    known_concepts: list[str]
    identified_misconceptions: list[str]
    zone_of_proximal_development: str
    
    # RAG context
    retrieved_passages: list[RetrievalResult]
    source_citations: list[Citation]
    knowledge_graph_paths: list[GraphPath]
    
    # Scaffolding state
    current_scaffolding_level: str  # "hint" → "guided_question" → "decomposition" → "analogy"
    scaffolding_attempts: int
    
    # Output
    response: str
    preservation_result: PreservationResult | None
    regeneration_count: int
```

**Graph Structure:**

```
          ┌─────────────┐
          │   ENTRY      │
          │  (receive    │
          │   question)  │
          └──────┬───────┘
                 │
                 ▼
          ┌─────────────┐
          │  RETRIEVE    │  ← L1: Medical RAG Engine
          │  CONTEXT     │    (4-layer hybrid retrieval)
          └──────┬───────┘
                 │
                 ▼
          ┌─────────────┐
          │  ASSESS      │  ← What does the student already know?
          │  KNOWLEDGE   │    Uses student profile from S8 metacognitive
          └──────┬───────┘
                 │
                 ▼
          ┌─────────────┐
          │  DETECT      │  ← Common misconceptions database
          │  MISCONCEPTIONS  + pattern matching on student's phrasing
          └──────┬───────┘
                 │
                 ▼
          ┌─────────────┐
          │  BUILD       │  ← Generate Socratic response
          │  SCAFFOLD    │    at appropriate difficulty level
          └──────┬───────┘
                 │
                 ▼
          ┌─────────────┐     ┌─────────────┐
          │ PRESERVATION │────→│ REGENERATE   │
          │ GATE (L2)    │ fail│ (escalate    │
          │              │     │  scaffolding) │
          └──────┬───────┘     └──────┬───────┘
                 │ pass               │
                 ▼                    │ (max 3 attempts)
          ┌─────────────┐            │
          │  DELIVER     │←───────────┘
          │  RESPONSE    │
          └──────┬───────┘
                 │
                 ▼
          ┌─────────────┐
          │  LOG         │  ← S8: Metacognitive Analytics
          │  INTERACTION │    (capture time, confidence, etc.)
          └─────────────┘
```

**Sample System Prompt (from Prompt Registry):**

```
agent_id: socratic_study_buddy
version: 1

---

You are Acolyte, a medical education mentor built on the Bridge Layer AI 
philosophy. Your core purpose: make the student THINK harder, never less.

## YOUR IDENTITY
You are not a search engine. You are not an answer machine. You are a 
Socratic mentor who guides medical students to discover answers through 
their own clinical reasoning. You are warm, patient, encouraging — but 
you NEVER give away the answer.

## CRITICAL RULES
1. NEVER state a diagnosis, answer, or conclusion directly
2. NEVER provide a complete list without asking the student to generate it first
3. ALWAYS ask a question that guides toward the answer
4. ALWAYS cite specific sources: "Look at Harrison's Chapter 12, Page 347"
5. ALWAYS acknowledge what the student already knows before building on it
6. If the student is frustrated, adjust scaffolding DOWN (simpler questions)
7. If the student is getting it, adjust scaffolding UP (harder questions)

## SCAFFOLDING LEVELS (use based on student's Zone of Proximal Development)

### Level 1: Hint
"What organ system do you think is primarily affected here?"
"Think about what connects these two symptoms..."

### Level 2: Guided Question
"If a patient has [symptom], which investigations would you order first 
and why? (Hint: Think about what Harrison's says about the initial workup 
on page {page})"

### Level 3: Decomposition
"Let's break this down. First, list the symptoms. Now, for each symptom, 
what organ systems could be involved? Let's start with the first one."

### Level 4: Analogy
"Think of it like this: if the heart is a pump, what happens to the 
downstream organs when the pump's output drops?"

## CONTEXT YOU HAVE
- The student is currently reading: {active_pdf} (Chapter: {active_chapter}, Page: {active_page})
- Their knowledge level in this topic: {student_knowledge_level}
- Concepts they've demonstrated understanding of: {known_concepts}
- Known misconceptions they hold: {identified_misconceptions}
- Retrieved medical passages: {retrieved_passages}

## SOURCE CITATION FORMAT
Always reference the student's own materials:
"According to {source_book}, Chapter {chapter} (page {page}): {brief reference}"
"You can verify this yourself — check the section on {topic} in {source}"

## CONVERSATION STYLE
- Warm and encouraging: "Great question! Let's think through this together."
- Never condescending: "That's a common area of confusion" NOT "That's wrong"
- Build confidence: "You're on the right track with..."
- Use patient language: "Take your time with this — it's a complex topic"
- Keep responses focused: One question at a time, not a wall of text

## WHEN THE STUDENT GETS IT RIGHT
Celebrate briefly, then deepen: "Exactly right! Now, can you think about 
what would happen if the patient also had [complicating factor]?"

## WHEN THE STUDENT IS STUCK
Drop scaffolding level. If they're stuck at Level 1, move to Level 3.
If still stuck after 3 attempts at Level 4, say:
"This is a challenging concept. Let me point you to exactly where to find 
this — read {source}, page {page}, the section on {topic}. After you've 
read that, let's discuss what you found."
```

### S2: Practice Question Generator 🔴 Core IP

**Type:** LangGraph supervisor graph with sub-agents
**Autonomy:** Tier 1 (Fully autonomous for student practice)
**Streaming:** No (batch generation)
**Stateful:** No (stateless generation pipeline)
**Bridge Layer:** EMBEDDED (questions ARE the Bridge Layer — they make students think)

**Purpose:** Generates practice MCQ/SAQ/LAQ questions for students. The key differentiator: it learns from faculty question patterns (via L4 Question Intelligence Layer) so student practice mirrors their actual exam style.

**Sub-Agent Pipeline:**

```
Input: {subject, topic, difficulty, blooms_level, question_type, student_profile}
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. CONTENT EXTRACTOR                                        │
│    Tool: search_medical_content (MCP MedicalKnowledgeServer)│
│    Action: Retrieve relevant medical passages for the topic  │
│    Model: Haiku 4.5 (query reformulation)                   │
│    Output: top-5 relevant passages with source citations    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. QUESTION GENERATOR                                       │
│    Tool: get_competency_details, get_differential_diagnoses │
│    Action: Generate clinical vignette + question stem        │
│    Model: Sonnet 4.5 (creative reasoning)                   │
│    Context includes: college question profile from L4        │
│    Output: Structured MCQOutput with stem + lead-in          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. DISTRACTOR GENERATOR                                     │
│    Tool: get_differential_diagnoses (knowledge graph)       │
│    Action: Generate plausible wrong answers using            │
│           differential diagnoses from the knowledge graph    │
│    Model: Sonnet 4.5                                        │
│    Strategy: Each distractor comes from a real differential │
│    diagnosis, making it clinically plausible but wrong       │
│    Output: 3 distractors with explanations                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. MEDICAL VALIDATOR                                        │
│    Tool: search_medical_content (cross-reference)           │
│    Action: Verify clinical accuracy of question + answer     │
│    Model: Sonnet 4.5 (independent verification)             │
│    Check: Is the correct answer actually correct?            │
│    Check: Are distractors actually wrong?                    │
│    Check: Is the clinical scenario realistic?                │
│    Output: Validation result with confidence score           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. QUALITY REVIEWER (L3: Safety Pipeline)                   │
│    Checks: NBME item-writing standards (19 flaw patterns)   │
│    Checks: Bloom's level alignment (does it actually test   │
│            the declared level?)                              │
│    Checks: Bias detection (demographic, cultural, gender)   │
│    Output: Quality score + specific issues flagged           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                     ┌─────┴──────┐
                     │ PASSED?    │
                     └─────┬──────┘
                    yes    │    no (max 3 retries)
                           │    → regenerate from step 2
                           ▼       with issue-specific instructions
                    ┌─────────────┐
                    │ DIFFICULTY   │
                    │ CALIBRATOR   │
                    │ (IRT-based)  │
                    └──────┬──────┘
                           │
                           ▼
                    Final MCQ output with:
                    - Question + options
                    - Correct answer with explanation
                    - Distractor explanations (for post-answer learning)
                    - Source citations
                    - Difficulty estimate (IRT parameters)
                    - Competency code
                    - Bloom's level
```

### S3: NEET-PG Exam Prep Agent 🟠 Specialized Agent

**Type:** Single agent with specialized tools and prompts
**Autonomy:** Tier 1 (autonomous practice generation)

**Purpose:** Specialized for NEET-PG competitive exam preparation. Uses historical NEET-PG question patterns, subject weightage distributions, and previous year question analysis to generate practice that mirrors the actual exam.

**Key Differentiators from S2:**
- Exact NEET-PG format: 4 options, 200 questions, time-bound
- Subject distribution matching actual exam blueprint
- Historical pattern analysis: which topics appear every year vs. rotate
- Difficulty calibrated to NEET-PG standards (not college exams)
- Image-based clinical questions (radiology, pathology, dermatology)
- Post-test analytics: predicted score vs. historical cutoffs

**System Prompt Addendum (extends S2's pipeline):**
```
You are generating questions specifically for NEET-PG examination preparation.

NEET-PG SPECIFICATIONS:
- Total questions: 200
- Time: 3 hours 30 minutes (1.05 minutes per question)
- Format: Single Best Answer MCQ with 4 options
- Marking: +4 for correct, -1 for incorrect
- Subject distribution follows NBE blueprint

HIGH-YIELD TOPICS (appear most frequently in past 10 years):
{historical_high_yield_topics}

QUESTION STYLE:
- Clinical vignette-based (not direct recall)
- One-step or two-step clinical reasoning
- Focus on "most likely diagnosis" and "next best step"
- Recent trends: more image-based questions

DIFFICULTY CALIBRATION:
- Target: 60% of questions at "difficult" level
- 25% at "moderate" level
- 15% at "easy" level
- This matches actual NEET-PG difficulty distribution
```

### S4: NExT Exam Prep Agent 🟠 Specialized Agent

Similar architecture to S3 but calibrated for the upcoming National Exit Test format, with emphasis on competency-based assessment alignment and integrated clinical reasoning across subjects.

### S5: Flashcard Generator 🟠 Specialized Agent

**Type:** Single agent with tools
**Purpose:** Generates medical flashcards from uploaded PDFs, lecture notes, or topics. Integrates with spaced repetition scheduling.

**System Prompt:**
```
You are a medical flashcard generator. Extract key concepts from the
provided medical content and create question-answer flashcard pairs.

RULES:
1. Each flashcard tests ONE concept only
2. Questions should require RECALL or UNDERSTANDING (Bloom's Level 1-2)
3. Answers should be concise (1-3 sentences maximum)
4. Include the source page/section for each flashcard
5. Tag each flashcard with: subject, topic, organ_system, difficulty
6. For clinical facts, use the format: "In [condition], what is [feature]?"
7. For pharmacology, include: drug class, mechanism, side effects, interactions
8. Avoid TRUE/FALSE format — use specific questions
9. For anatomy, reference specific structures and relations
10. Group related flashcards into logical sequences
```

### S6: Recommendation Engine 🔴 Core IP

**Type:** LangGraph supervisor graph
**Purpose:** The "persistent mentor" — analyzes all metacognitive data and proactively guides students.

**Data Sources (from S8 Metacognitive Analytics Engine):**
- Confidence vs accuracy tracking per topic
- Time-per-question trends (speeding up = mastery, slowing = struggling)
- Answer change patterns (changing right to wrong = second-guessing)
- Study session regularity and duration
- Knowledge gap heatmap (mastery score per topic)
- Forgetting curve tracking (spaced repetition intervals)
- Feature usage patterns (PDF/flashcard/practice test distribution)
- Comparative performance against anonymized cohort

**Output Types:**
1. **Proactive study plans:** "Your Pharmacology drug interactions accuracy dropped 15% this week. Here's a focused 45-minute review plan targeting the 3 weakest areas."
2. **Workload management:** "You've been studying for 4 hours straight. Research shows recall drops significantly after 90 minutes. Take a 15-minute break."
3. **Weak area alerts:** "You consistently score below 50% on Cardiology ECG interpretation. This is a high-weightage NEET-PG topic."
4. **Resource recommendations:** "Based on your learning pattern, you learn best from practice questions (80% retention) vs. reading (45% retention). Here are 20 targeted MCQs on your weak topics."
5. **Progress celebration:** "You've mastered 85% of Anatomy competencies this month, up from 62% last month. Keep it up!"

### S7: Medical PPT Generator 🟠 Specialized Agent

**Type:** Single agent with tools
**Purpose:** Generates medical presentations from PDFs extracting text AND images.

**Architecture Note:** This agent generates structured slide content (title, bullet points, speaker notes, image references) that is then rendered to PPTX format by a separate deterministic rendering service (not an LLM). The LLM handles content intelligence; the renderer handles formatting.

### S8: Metacognitive Analytics Engine 🟢 Background Processor

**Type:** Celery task pipeline (NOT an LLM agent)
**Purpose:** The invisible data capture layer across all student interactions.

```python
class MetacognitiveEventProcessor:
    """
    Captures and processes every student interaction event.
    This is a DATA PIPELINE, not an LLM agent.
    
    Events captured:
    - question_answered: {question_id, selected_answer, time_taken_ms,
                         confidence_rating, answer_changed, final_answer}
    - page_viewed: {pdf_id, page_number, duration_ms, scroll_depth}
    - flashcard_reviewed: {card_id, response_correct, response_time_ms,
                          interval_since_last_review}
    - study_session: {start_time, end_time, features_used, topics_covered}
    - ai_interaction: {query, response_helpful_rating, follow_up_questions}
    
    Computed metrics (per student per topic):
    - mastery_score: (accuracy * 0.4) + (completion_rate * 0.3) + (time_efficiency * 0.3)
    - confidence_calibration: correlation(confidence_ratings, actual_accuracy)
    - forgetting_curve: exponential decay model per topic
    - engagement_pattern: study regularity, session length distribution
    - learning_velocity: rate of mastery score improvement over time
    - risk_score: composite score predicting exam readiness
    """
    
    @celery.task
    def process_event(self, event: MetacognitiveEvent):
        # 1. Store raw event
        self.event_store.save(event)
        
        # 2. Update real-time metrics
        self.metrics_engine.update(event)
        
        # 3. Check alert thresholds
        alerts = self.alert_checker.check(event)
        if alerts:
            self.notification_service.send(alerts)
        
        # 4. Update spaced repetition schedules (for flashcards)
        if event.type == "flashcard_reviewed":
            self.spaced_repetition.update_schedule(event)
```

### S9: Student Copilot Chat 🟡 Helper/Copilot

**Type:** Shared copilot framework
**Purpose:** General-purpose assistant for non-academic queries.

```python
student_copilot = AcolyteCopilot(
    role="student_general",
    system_prompt="""
    You are Acolyte, a helpful assistant for medical students.
    
    For ACADEMIC/MEDICAL questions: Do NOT answer directly. Instead, say:
    "That's a great medical question! Let me redirect you to the Study Buddy
    where I can help you work through this properly with your study materials."
    Then redirect to the Socratic Study Buddy (S1).
    
    For LOGISTICAL questions, answer directly:
    - "When is my next exam?" → Check exam schedule
    - "What's my attendance?" → Check attendance records
    - "Show my competency progress" → Display progress dashboard
    - "What assignments are due?" → Check assignment calendar
    
    Always be warm and helpful. You're a student's daily companion.
    """,
    tools=["exam_schedule", "attendance_records", "competency_progress",
           "assignment_calendar", "notification_preferences"],
    bridge_layer_enabled=True  # Redirects academic queries to S1
)
```

---

## 6. FACULTY ENGINE AGENTS (F1–F12)

### F1: Exam Question Generator 🔴 Core IP

**Type:** LangGraph supervisor graph (shares sub-agent pipeline with S2)
**Autonomy:** Tier 2 (Draft-and-approve — faculty ALWAYS reviews)

**Key Differences from S2 (Student Practice Generator):**
- Faculty has full parameter control (difficulty matrix, Bloom's, competency, question type)
- Output includes rubrics for SAQ/LAQ (not just MCQs)
- Human-in-the-loop is a HARD requirement (faculty approves every question)
- Wider parameter space: MCQ, SAQ, LAQ, EMQ, OSCE stations, viva questions
- Feeds INTO the Question Intelligence Layer (L4) when approved

**Matrix-Based Generation Interface:**
```
Faculty specifies:
┌─────────────────────────────────────────────────────┐
│ Subject: Pharmacology                                │
│ Topic: Antihypertensives                            │
│ Competency: PH 1.25                                 │
│ Bloom's Level: [Apply]  ← dropdown                  │
│ Difficulty: [3/5]       ← slider                    │
│ Question Type: [MCQ]    ← dropdown                  │
│ Clinical Vignette: [Yes] ← toggle                   │
│ Number of Questions: 5                               │
│ AETCOM Integration: [No]                            │
│ Image-Based: [No]                                   │
└─────────────────────────────────────────────────────┘

→ AI generates 5 questions matching ALL parameters
→ Faculty reviews each question
→ Faculty can: approve / edit / reject / regenerate
→ Approved questions enter the institutional question bank
→ Question patterns captured by L4 for student practice
```

**Rubric Generation for SAQ/LAQ:**
```python
class RubricOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_text: str
    total_marks: int
    criteria: list[RubricCriterion]
    model_answer: str
    common_mistakes: list[str]
    
class RubricCriterion(BaseModel):
    criterion: str
    max_marks: int
    description: str
    expected_points: list[str]
    partial_credit_guidelines: str
```

### F2–F12: Remaining Faculty Agents

*(Architecture follows the same patterns. Each agent's specific system prompt, tools, and data flows are defined. Key agents include:)*

**F4: Class Prep Assistant (TA AI) 🟡**
```
System prompt: You are a Teaching Assistant AI for medical faculty.
You have access to: today's class schedule, the topic to be covered,
medical knowledge base, content repository (videos, images, diagrams),
and the relevant NMC competency requirements.

Before class: Prepare a briefing with key points, suggested clinical
cases, discussion questions, and integration opportunities with other subjects.

During class (voice/text): Faculty can ask "Show me a diagram of [X]"
or "Find a clinical case about [Y]" and you retrieve it instantly.

After class: Summarize what was covered, map to competency progress,
flag any topics that need follow-up.
```

**F7: Student Analytics & Mentoring Agent 🟠**
Consumes metacognitive data (from S8) to present faculty-facing analytics with at-risk student identification and intervention recommendations.

**F9: Assessment Grading Assistant 🟠**
For SAQ/LAQ: provides preliminary AI scoring against rubrics. Faculty reviews and confirms. Published research shows 93% alignment with faculty grading.

---

## 7. COMPLIANCE ENGINE AGENTS (C1–C6)

### C1: Compliance Monitoring Supervisor 🔴 Core IP

**Type:** LangGraph supervisor graph
**Autonomy:** Tier 2 (AI monitors and generates reports, human signs off)
**Critical Constraint:** Human sign-off MANDATORY for all compliance outputs.

**Sub-Agents:**

```
┌──────────────────────────────────────────────────────────────┐
│                COMPLIANCE SUPERVISOR                          │
│                                                              │
│  Event-driven triggers:                                      │
│  - Attendance data updated → AttendanceAnalyzer              │
│  - Faculty roster changed → FacultyMSRTracker                │
│  - Monthly schedule → InfrastructureComplianceTracker         │
│  - Quarterly schedule → PredictionEngine                     │
│  - Any alert generated → AlertRouter                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Attendance   │  │ Faculty MSR  │  │Infrastructure│       │
│  │ Analyzer     │  │ Tracker      │  │ Compliance   │       │
│  │              │  │              │  │ Tracker      │       │
│  │ AEBAS data   │  │ Dept-wise    │  │ Bed counts   │       │
│  │ vs 75%/80%   │  │ faculty vs   │  │ OPD stats    │       │
│  │ thresholds   │  │ MSR norms    │  │ Library      │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                  │                │
│         ▼                 ▼                  ▼                │
│  ┌─────────────────────────────────────────────────┐         │
│  │              PREDICTION ENGINE                   │         │
│  │                                                  │         │
│  │  Time-series forecasting:                        │         │
│  │  "Will college meet NMC thresholds by semester   │         │
│  │   end at current trajectory?"                    │         │
│  │                                                  │         │
│  │  Severity classification:                        │         │
│  │  🟢 Green: On track (>10% above threshold)       │         │
│  │  🟡 Yellow: Watch (within 10% of threshold)      │         │
│  │  🟠 Orange: Risk (<5% below threshold)           │         │
│  │  🔴 Red: Critical (>10% below threshold)         │         │
│  └──────────────────┬──────────────────────────────┘         │
│                     │                                        │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────┐         │
│  │              ALERT ROUTER                        │         │
│  │                                                  │         │
│  │  🟢 Green → Dashboard only                       │         │
│  │  🟡 Yellow → Email to department HOD              │         │
│  │  🟠 Orange → Email to Dean + HOD + Principal      │         │
│  │  🔴 Red → Urgent notification to all stakeholders │         │
│  │            + in-app alert + SMS                   │         │
│  └─────────────────────────────────────────────────┘         │
│                                                              │
│  ALL outputs require human sign-off before being             │
│  treated as official compliance status.                       │
└──────────────────────────────────────────────────────────────┘
```

### C5: Discrepancy Detection Agent 🟢

**Purpose:** Cross-system consistency checker. Finds inconsistencies that NMC assessors would flag.

**Checks:**
- AEBAS attendance shows faculty present but HMIS shows no clinical activity
- Faculty roster count doesn't match attendance records
- Student enrollment numbers inconsistent between systems
- Clinical rotation logs don't align with ward patient data
- Assessment dates don't match academic calendar

### C6: Audit Officer Agent 🟢

**Purpose:** Monitors all administrative actions for audit trail integrity. Every significant action logged with who, when, what, previous value, authorization.

---

## 8. ADMIN ENGINE AGENTS (A1–A4)

### A1: Admin Copilot 🟡 Helper/Copilot

**Architecture:** Single copilot framework, multiple role configurations.

```python
# One framework, many roles
admin_roles = {
    "accounts": {
        "system_prompt": "You help accounting staff with fee calculations, payment lookups...",
        "tools": ["fee_calculator", "payment_status", "scholarship_checker", "receipt_generator"],
        "data_scope": "financial_data"
    },
    "hr": {
        "system_prompt": "You help HR with faculty qualifications, leave tracking...",
        "tools": ["faculty_roster", "leave_tracker", "promotion_eligibility", "fdp_tracker"],
        "data_scope": "hr_data"
    },
    "it_admin": {
        "system_prompt": "You help IT admins with system health, user management...",
        "tools": ["system_health", "user_management", "data_export", "integration_status"],
        "data_scope": "system_data"
    },
    "warden": {
        "system_prompt": "You help hostel wardens with room allocation, mess management...",
        "tools": ["room_allocator", "mess_manager", "occupancy_report", "maintenance_tickets"],
        "data_scope": "hostel_data"
    },
    "library": {
        "system_prompt": "You help librarians with inventory vs NMC minimums...",
        "tools": ["book_inventory", "journal_tracker", "usage_analytics", "nmc_library_standards"],
        "data_scope": "library_data"
    }
}

# Build any admin copilot from the same framework
def create_admin_copilot(role: str) -> AcolyteCopilot:
    config = admin_roles[role]
    return AcolyteCopilot(
        role=f"admin_{role}",
        system_prompt=config["system_prompt"],
        tools=config["tools"],
        data_scope=config["data_scope"],
        bridge_layer_enabled=False  # Admin copilots give direct answers
    )
```

---

## 9. INTEGRATION ENGINE AGENTS (I1–I2)

### I1: AEBAS Data Reconciliation Agent 🟢

**Purpose:** Reconciles Acolyte's attendance records with AEBAS biometric data.

### I2: University Portal Adapter Agent 🟠

**Purpose:** Configurable adapter for different university portal formats. Handles data formatting for marks, attendance, and student data submission.

---

## 10. INTER-ENGINE DATA FLOW & EVENT ARCHITECTURE

### 10.1 API Contracts: How Engines Call the Central AI Engine

Every engine communicates with the Central AI Engine through internal FastAPI endpoints.

```python
# Central AI Engine API Router
# backend/app/engines/ai/router.py

@router.post("/ai/student/study-buddy")
async def study_buddy_query(
    request: StudyBuddyRequest,
    college_id: UUID = Depends(get_college_id),
    student_id: UUID = Depends(get_current_user_id)
) -> StreamingResponse:
    """Student Engine → Central AI → Socratic response (streamed)"""

@router.post("/ai/student/generate-practice-questions")
async def generate_practice_questions(
    request: PracticeQuestionRequest,
    college_id: UUID = Depends(get_college_id)
) -> PracticeQuestionBatch:
    """Student Engine → Central AI → Practice MCQs"""

@router.post("/ai/faculty/generate-exam-questions")
async def generate_exam_questions(
    request: ExamQuestionRequest,
    college_id: UUID = Depends(get_college_id),
    faculty_id: UUID = Depends(get_current_user_id)
) -> ExamQuestionDraft:
    """Faculty Engine → Central AI → Draft questions for review"""

@router.post("/ai/compliance/generate-saf")
async def generate_saf(
    request: SAFRequest,
    college_id: UUID = Depends(get_college_id)
) -> SAFDraft:
    """Compliance Engine → Central AI → Draft SAF for review"""

@router.post("/ai/copilot/query")
async def copilot_query(
    request: CopilotRequest,
    college_id: UUID = Depends(get_college_id),
    user_id: UUID = Depends(get_current_user_id)
) -> StreamingResponse:
    """Any Engine → Central AI → Copilot response (streamed)"""
```

### 10.2 Event-Driven Data Flows

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENT BUS (Celery + Redis)                │
│                                                             │
│  Event Types:                                               │
│                                                             │
│  student.question.answered ──→ S8 (metacognitive capture)   │
│  student.pdf.page_viewed ────→ S8 (reading analytics)       │
│  student.flashcard.reviewed ─→ S8 (spaced repetition update)│
│  student.session.ended ──────→ S6 (recommendation trigger)  │
│                                                             │
│  faculty.question.approved ──→ L4 (question intelligence)   │
│  faculty.question.generated ─→ L3 (safety pipeline)         │
│  faculty.assessment.graded ──→ S8 (student performance)     │
│                                                             │
│  attendance.updated ─────────→ C1 (compliance monitoring)   │
│  faculty.roster.changed ─────→ C1 (MSR tracking)            │
│  compliance.threshold.breached → C1 (alert routing)         │
│                                                             │
│  admin.action.performed ─────→ C6 (audit trail)             │
│  system.data.imported ───────→ C5 (discrepancy detection)   │
└─────────────────────────────────────────────────────────────┘
```

### 10.3 Cross-Engine Intelligence Flows

```
The "learns from faculty questions" flow:

  Faculty Engine                    Central AI                Student Engine
  ┌──────────┐                   ┌──────────────┐          ┌──────────────┐
  │ F1: Exam │   question        │ L4: Question │  profile │ S2: Practice │
  │ Question │──approved──────→  │ Intelligence │────────→ │ Question     │
  │ Generator│   with patterns   │    Layer     │  college │ Generator    │
  └──────────┘                   │              │  question│              │
                                 │ Captures:    │  culture │ Uses profile │
                                 │ - difficulty │          │ to generate  │
                                 │ - blooms dist│          │ questions    │
                                 │ - stem style │          │ matching     │
                                 │ - distractor │          │ faculty's    │
                                 │   patterns   │          │ exam style   │
                                 └──────────────┘          └──────────────┘


The metacognitive intelligence flow:

  Student actions              Background               Faculty/Student
  ┌──────────────┐           ┌──────────────┐          ┌──────────────┐
  │ PDF reading  │  events   │ S8: Meta-    │ metrics  │ S6: Recom-   │
  │ Flashcards   │─────────→ │ cognitive    │────────→ │ mendation    │
  │ Practice Q   │           │ Analytics    │          │ Engine       │
  │ AI chat      │           │ Engine       │          │ (to student) │
  │ Study time   │           │              │          │              │
  └──────────────┘           │ Computes:    │          │ F7: Student  │
                             │ - mastery    │────────→ │ Analytics    │
                             │ - confidence │ metrics  │ (to faculty) │
                             │ - risk score │          │              │
                             │ - learning   │          └──────────────┘
                             │   velocity   │
                             └──────────────┘
```

---

## 11. AI GATEWAY & MODEL STRATEGY

### 11.1 Model Selection Rationale

**Claude Sonnet 4.5** — Primary reasoning model
- All content generation (questions, flashcards, Socratic responses)
- Complex medical reasoning and clinical scenario creation
- Safety validation and clinical accuracy checks
- Supports extended thinking for multi-step reasoning
- Supports structured outputs with constrained decoding

**Claude Haiku 4.5** — Fast/cheap model
- Query classification and routing
- Retrieval query reformulation
- Bridge Layer quick-checks
- Simple data extraction and formatting
- Auto-downgrade target when budgets are tight

**Batch API** — Overnight bulk operations
- 50% cost discount vs. real-time API
- Nightly question bank quality re-evaluation
- Bulk compliance report generation
- Periodic content freshness audits
- Mass flashcard generation from new content uploads

### 11.2 Cost Optimization Techniques

**Prompt Caching:** System prompts for core agents are 2,000-5,000 tokens. With Anthropic's prompt caching (`cache_control: ephemeral`), these are cached for 5 minutes at 90% cost reduction. For agents with frequent calls (Study Buddy, Copilot Chat), this is the single biggest cost optimization.

**Structured Outputs:** Constrained decoding eliminates retry loops. Without structured outputs, ~5-10% of LLM calls produce malformed JSON requiring retries. This saves both tokens and latency.

**Agentic Retrieval Router:** The L1 router uses Haiku ($0.25/M input tokens) to classify queries before Sonnet ($3/M input tokens) generates responses. This saves 12x on the classification step that precedes every RAG operation.

**Batch API for Non-Urgent Tasks:** Question bank generation, compliance report drafting, and content quality audits run overnight at 50% cost. These tasks don't need real-time responses.

---

## 12. SAFETY, GUARDRAILS & BRIDGE LAYER ENFORCEMENT

### 12.1 Safety Architecture Summary

```
Every AI output passes through this chain:

Input → Agent/Workflow → Bridge Layer (L2, student-facing only)
                       → Medical Safety Pipeline (L3, medical content only)
                       → Structured Output Validation
                       → Tenant Isolation Verification
                       → Budget Check
                       → Delivery
```

### 12.2 Content-Specific Safety Rules

**Student-facing academic content:** Must pass both L2 (Cognitive Preservation) AND L3 (Medical Safety). Double gate.

**Faculty-facing content:** Must pass L3 (Medical Safety) only. Faculty gets direct answers — they're the experts.

**Compliance outputs:** Must pass L3 AND require human sign-off before becoming official. Legal liability constraint.

**Administrative outputs:** No medical safety check needed (fee calculations, scheduling). Standard data validation only.

### 12.3 Emergency/Safety Override

If a student's query indicates potential self-harm, medical emergency awareness, or safety concern, the Bridge Layer is BYPASSED. The AI responds directly, clearly, and compassionately, and provides appropriate resources. Bridge Layer only applies to educational content, never to safety-critical situations.

---

## 13. PROMPT ENGINEERING STANDARDS & REGISTRY

### 13.1 Prompt Structure Convention

Every agent's system prompt follows this structure:

```
## IDENTITY
Who you are and your core purpose.

## CRITICAL RULES
Non-negotiable behaviors (numbered list, max 10).

## CONTEXT YOU HAVE
Template variables that will be injected: {student_profile}, {retrieved_passages}, etc.

## RESPONSE FORMAT
How to structure your output.

## EXAMPLES
2-3 examples of ideal responses.

## ANTI-PATTERNS
What NOT to do (negative examples are crucial for quality).
```

### 13.2 Prompt Evaluation Framework

Every prompt update follows this cycle:

```
1. Baseline: Run current prompt against eval set, record scores
2. Hypothesis: "Changing X will improve Y"
3. Update: Modify the prompt
4. Evaluate: Run updated prompt against same eval set
5. Compare: Statistical comparison of scores
6. Deploy or rollback: Only deploy if improvement is statistically significant
```

Evaluation dimensions:
- **Medical accuracy:** Is the content clinically correct?
- **Bridge Layer compliance:** Does the response promote thinking (not give answers)?
- **Source grounding:** Are claims supported by cited sources?
- **Cognitive engagement:** Would this make a student think harder?
- **Format compliance:** Does the output match the expected schema?

---

## 14. OBSERVABILITY, EVALUATION & CONTINUOUS IMPROVEMENT

### 14.1 Logging Architecture

Every LLM call is logged with:
```python
class AIExecutionLog(BaseModel):
    id: UUID
    timestamp: datetime
    college_id: UUID
    user_id: UUID
    agent_id: str
    task_type: str
    model: str
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    total_cost_usd: float
    latency_ms: float
    prompt_version: int
    safety_result: str  # "passed", "flagged", "rejected"
    bridge_layer_result: str | None  # "passed", "regenerated", "fallback"
    quality_score: float | None  # From human feedback or automated eval
    error: str | None
```

### 14.2 Key Metrics Dashboard

**Operational:** API latency (P50, P95, P99), error rate, token usage per college, budget utilization, cache hit rate

**Quality:** Medical accuracy rate, Bridge Layer compliance rate, safety pipeline pass rate, question quality scores (NBME flaw rate), student satisfaction ratings

**Business:** AI feature adoption rates, cost per student per month, recommendation follow-through rate, question generation volume, exam prep score improvement correlation

---

## 15. IMPLEMENTATION PHASING

### Phase 1: Foundation (Weeks 1-4)
- L5: AI Gateway with budget control and logging
- L6: Prompt Registry with versioning
- L1: Medical RAG Engine (BM25 + pgvector, Layer 3 knowledge graph as phase 2)
- L7: MCP Tool Servers (MedicalKnowledge + StudentAnalytics)

### Phase 2: Core Student AI (Weeks 5-8)
- S1: Socratic Study Buddy (flagship feature)
- L2: Cognitive Preservation Pipeline
- S8: Metacognitive Analytics Engine (data capture)
- S9: Student Copilot Chat

### Phase 3: Faculty AI & Question Intelligence (Weeks 9-12)
- F1: Exam Question Generator
- L3: Medical Safety Pipeline
- L4: Question Intelligence Layer
- S2: Practice Question Generator (now learns from F1)
- F4: Class Prep Assistant

### Phase 4: Compliance & Helper Agents (Weeks 13-16)
- C1: Compliance Monitoring Supervisor
- C2: SAF Auto-Generation
- A1: Admin Copilot (all roles)
- F8: Logbook & Data Retrieval

### Phase 5: Advanced Features (Weeks 17-20)
- S3: NEET-PG Exam Prep Agent
- S5: Flashcard Generator with spaced repetition
- S6: Recommendation Engine (needs sufficient S8 data)
- S7: Medical PPT Generator
- C3: Inspection Readiness Simulator
- L1 Layer 3: Full knowledge graph integration with Neo4j

### Phase 6: Intelligence & Optimization (Weeks 21+)
- S4: NExT Exam Prep Agent
- C4: NAAC/NBA Metric Aggregation
- C5: Discrepancy Detection
- C6: Audit Officer
- F2-F12: Remaining faculty agents
- A2-A4: Remaining admin agents
- I1-I2: Integration agents
- Cross-engine intelligence optimization
- Cost optimization and model fine-tuning evaluation

---

## APPENDIX A: COMPLETE AGENT INVENTORY

| ID | Agent Name | Category | Engine | Autonomy | Architecture |
|----|-----------|----------|--------|----------|-------------|
| S1 | Socratic Study Buddy | 🔴 Core IP | Student | Tier 3 | LangGraph supervisor |
| S2 | Practice Question Generator | 🔴 Core IP | Student | Tier 1 | LangGraph supervisor |
| S3 | NEET-PG Exam Prep | 🟠 Specialized | Student | Tier 1 | Single agent |
| S4 | NExT Exam Prep | 🟠 Specialized | Student | Tier 1 | Single agent |
| S5 | Flashcard Generator | 🟠 Specialized | Student | Tier 1 | Single agent |
| S6 | Recommendation Engine | 🔴 Core IP | Student | Tier 3 | LangGraph supervisor |
| S7 | Medical PPT Generator | 🟠 Specialized | Student | Tier 2 | Single agent |
| S8 | Metacognitive Analytics | 🟢 Background | Student | Tier 1 | Celery pipeline |
| S9 | Student Copilot Chat | 🟡 Helper | Student | Tier 3 | Copilot framework |
| F1 | Exam Question Generator | 🔴 Core IP | Faculty | Tier 2 | LangGraph supervisor |
| F2 | Exam Paper Blueprint | 🟠 Specialized | Faculty | Tier 2 | Single agent |
| F3 | OSCE Station Generator | 🟠 Specialized | Faculty | Tier 2 | Single agent |
| F4 | Class Prep TA | 🟡 Helper | Faculty | Tier 3 | Copilot framework |
| F5 | Lesson Plan Generator | 🟠 Specialized | Faculty | Tier 2 | Single agent |
| F6 | Clinical Rotation Scheduler | 🟠 Specialized | Faculty | Tier 2 | Single agent |
| F7 | Student Analytics & Mentoring | 🟠 Specialized | Faculty | Tier 3 | Single agent |
| F8 | Logbook & Data Retrieval | 🟡 Helper | Faculty | Tier 3 | Copilot framework |
| F9 | Assessment Grading Assistant | 🟠 Specialized | Faculty | Tier 2 | Single agent |
| F10 | Faculty Compliance Manager | 🟡 Helper | Faculty | Tier 3 | Copilot framework |
| F11 | Research & Citation Assistant | 🟡 Helper | Faculty | Tier 3 | Copilot framework |
| F12 | Quiz & Formative Assessment | 🟠 Specialized | Faculty | Tier 2 | Single agent |
| C1 | Compliance Monitoring Supervisor | 🔴 Core IP | Compliance | Tier 2 | LangGraph supervisor |
| C2 | SAF Auto-Generation | 🟠 Specialized | Compliance | Tier 2 | Single agent |
| C3 | Inspection Readiness Simulator | 🟠 Specialized | Compliance | Tier 3 | Single agent |
| C4 | NAAC/NBA Metric Aggregation | 🟠 Specialized | Compliance | Tier 2 | Single agent |
| C5 | Discrepancy Detection | 🟢 Background | Compliance | Tier 1 | Celery pipeline |
| C6 | Audit Officer | 🟢 Background | Compliance | Tier 1 | Celery pipeline |
| A1 | Admin Copilot (multi-role) | 🟡 Helper | Admin | Tier 3 | Copilot framework |
| A2 | Fee Management | 🟠 Specialized | Admin | Tier 2 | Single agent |
| A3 | Communication & Notification | 🟡 Helper | Admin | Tier 2 | Copilot framework |
| A4 | Certificate & Document Generator | 🟠 Specialized | Admin | Tier 1 | Single agent |
| I1 | AEBAS Data Reconciliation | 🟢 Background | Integration | Tier 1 | Celery pipeline |
| I2 | University Portal Adapter | 🟠 Specialized | Integration | Tier 2 | Single agent |

**Total: 32 agents + 7 infrastructure layers = 39 AI components**

---

## APPENDIX B: TECHNOLOGY STACK SUMMARY

| Component | Technology | Purpose |
|-----------|-----------|---------|
| LLM Provider | Anthropic Claude (Sonnet 4.5 + Haiku 4.5) | All AI generation |
| Agent Framework | LangGraph (Python) | Multi-agent orchestration |
| Structured Output | Anthropic constrained decoding | Schema-guaranteed JSON |
| Tool Interface | MCP (Model Context Protocol) | Agent-to-data interface |
| Vector Database | Neon PostgreSQL + pgvector (IVFFlat) | Semantic search |
| Knowledge Graph | Neo4j (analytical) + PostgreSQL (transactional) | Medical entity relationships |
| Keyword Search | PostgreSQL full-text search (tsvector) | BM25 medical term matching |
| Embedding Model | text-embedding-3-large (3072d) → MedCPT (Year 2) | Document/query embeddings |
| Reranker | cross-encoder/ms-marco-MiniLM-L-12-v2 | Retrieved passage reranking |
| Task Queue | Celery + Redis | Background processing |
| Observability | LangSmith / Langfuse | Agent tracing and debugging |
| API Framework | FastAPI | Internal API endpoints |
| Prompt Storage | PostgreSQL (versioned) | Prompt registry |

---

*This document is the authoritative specification for Acolyte AI's Central AI Engine. All implementation must follow the architecture, patterns, and principles defined herein. Updates to this document require CEO approval.*
