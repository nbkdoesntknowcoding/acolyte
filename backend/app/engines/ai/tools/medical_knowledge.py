"""MedicalKnowledgeServer — RAG search, knowledge graph, medical references.

Tool definitions copied VERBATIM from architecture doc Section L7.
These descriptions are prompt-engineered for Claude to use correctly.

Used by: S1 (Socratic Study Buddy), S2 (Practice Question Generator),
F1 (Exam Question Generator), all medical content generation agents.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engines.ai.models import (
    MedicalEntity,
    MedicalEntityRelationship,
)
from app.engines.ai.tools.base import MCPToolServer


class MedicalKnowledgeServer(MCPToolServer):
    """RAG search, knowledge graph queries, medical reference data."""

    server_name = "medical_knowledge"

    def get_tool_definitions(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "search_medical_content",
                "description": (
                    "Search the medical knowledge base using hybrid retrieval "
                    "(BM25 + vector + knowledge graph). Returns passages with "
                    "source citations including book name, chapter, page "
                    "number.\n\nUse this tool when you need to find medical "
                    "information to answer a student's question, generate "
                    "content, or verify claims.\n\nReturns: List of passages "
                    "with source metadata and relevance scores."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": (
                                "The medical question or topic to search for"
                            ),
                        },
                        "subject_filter": {
                            "type": "string",
                            "description": (
                                "Optional: filter by subject "
                                "(Anatomy, Pharmacology, etc.)"
                            ),
                        },
                        "content_type_filter": {
                            "type": "string",
                            "enum": ["textbook", "guideline", "lecture", "all"],
                            "description": "Type of content to search",
                        },
                        "top_k": {
                            "type": "integer",
                            "description": (
                                "Number of results to return (default: 5)"
                            ),
                        },
                    },
                    "required": ["query"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "get_differential_diagnoses",
                "description": (
                    "Query the medical knowledge graph for differential "
                    "diagnoses given a set of symptoms or a primary diagnosis. "
                    "Returns ranked differentials with shared symptom counts "
                    "and distinguishing features.\n\nUse this tool when "
                    "generating clinical vignette questions, creating "
                    "distractor options, or helping students with diagnostic "
                    "reasoning.\n\nReturns: Ranked list of differential "
                    "diagnoses with reasoning paths."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "symptoms": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of presenting symptoms",
                        },
                        "primary_diagnosis": {
                            "type": "string",
                            "description": (
                                "Optional: a specific diagnosis to find "
                                "differentials for"
                            ),
                        },
                        "max_results": {
                            "type": "integer",
                            "description": (
                                "Maximum differentials to return (default: 5)"
                            ),
                        },
                    },
                    "required": [],
                    "additionalProperties": False,
                },
            },
            {
                "name": "get_drug_interactions",
                "description": (
                    "Check drug-drug interactions from the medical knowledge "
                    "graph. Returns interaction type, severity, mechanism, "
                    "and clinical significance."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "drug_a": {"type": "string"},
                        "drug_b": {"type": "string"},
                    },
                    "required": ["drug_a", "drug_b"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "get_competency_details",
                "description": (
                    "Retrieve NMC competency details by code. Returns "
                    "competency description, level (K/KH/S/SH/P), subject, "
                    "teaching method, assessment requirements, and "
                    "integration mappings."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "competency_code": {
                            "type": "string",
                            "description": (
                                "NMC competency code (e.g., PH 1.5)"
                            ),
                        },
                    },
                    "required": ["competency_code"],
                    "additionalProperties": False,
                },
            },
            {
                "name": "get_misconceptions",
                "description": (
                    "Retrieve common student misconceptions for a given "
                    "medical topic. Built from historical student interaction "
                    "data and medical education research. Used by the "
                    "Socratic Study Buddy to detect and address flawed mental "
                    "models.\n\nReturns: List of known misconceptions with "
                    "correct understanding and suggested Socratic questions "
                    "to surface them."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "topic": {"type": "string"},
                        "subject": {"type": "string"},
                    },
                    "required": ["topic"],
                    "additionalProperties": False,
                },
            },
        ]

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    async def _tool_search_medical_content(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """4-layer hybrid search via the MedicalRAGEngine (Section L1).

        Delegates to the RAG engine which runs:
        1. Agentic router (query classification via Haiku)
        2. BM25 keyword search (search_vector)
        3. pgvector semantic search (text-embedding-3-large)
        4. Reciprocal Rank Fusion (k=60) + Haiku reranking

        This tool INTERFACE stays the same — only internals changed.
        """
        from app.engines.ai.rag import get_rag_engine

        query_text = params["query"]
        subject_filter = params.get("subject_filter")
        content_type_filter = params.get("content_type_filter", "all")
        top_k = params.get("top_k", 5)

        filters: dict[str, Any] = {}
        if subject_filter:
            filters["subject"] = subject_filter
        if content_type_filter and content_type_filter != "all":
            filters["content_type"] = content_type_filter

        engine = get_rag_engine()
        rag_result = await engine.retrieve(
            db=self.db,
            query=query_text,
            college_id=self.college_id,
            filters=filters if filters else None,
            top_k=top_k,
        )

        # Format RAG results into the tool response shape.
        passages = []
        for r in rag_result.passages:
            meta = r.source_metadata
            passages.append({
                "id": str(r.content_id),
                "title": meta.get("title", ""),
                "content": r.content[:500],  # Truncate for tool response
                "source_type": meta.get("source_type", ""),
                "source_reference": meta.get("source_reference", ""),
                "book": meta.get("book", ""),
                "chapter": meta.get("chapter", ""),
                "page": meta.get("page", ""),
                "relevance_score": r.score,
                "retrieval_method": r.layer_source,
            })

        return {
            "passages": passages,
            "total_found": rag_result.total_results,
            "query": query_text,
            "retrieval_strategy": rag_result.query_classification.category,
            "formatted_context": rag_result.formatted_context,
        }

    async def _tool_get_differential_diagnoses(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Query the knowledge graph for differential diagnoses.

        Uses recursive CTE for multi-hop relationship traversal:
        symptom → HAS_SYMPTOM → disease → DIFFERENTIAL_OF → other diseases.
        """
        symptoms = params.get("symptoms", [])
        primary_diagnosis = params.get("primary_diagnosis")
        max_results = params.get("max_results", 5)

        differentials: list[dict[str, Any]] = []

        if primary_diagnosis:
            # Find diseases that are differentials of the given diagnosis.
            diagnosis_entity = await self.db.execute(
                select(MedicalEntity).where(
                    MedicalEntity.name.ilike(f"%{primary_diagnosis}%"),
                    MedicalEntity.entity_type.in_(["disease", "condition"]),
                    MedicalEntity.is_active.is_(True),
                )
            )
            entity = diagnosis_entity.scalar_one_or_none()

            if entity:
                # Direct DIFFERENTIAL_OF edges.
                diff_result = await self.db.execute(
                    select(
                        MedicalEntity.name,
                        MedicalEntity.entity_type,
                        MedicalEntity.properties,
                        MedicalEntityRelationship.confidence,
                    )
                    .join(
                        MedicalEntityRelationship,
                        MedicalEntityRelationship.target_entity_id
                        == MedicalEntity.id,
                    )
                    .where(
                        MedicalEntityRelationship.source_entity_id == entity.id,
                        MedicalEntityRelationship.relationship_type
                        == "differential_of",
                        MedicalEntityRelationship.is_active.is_(True),
                        MedicalEntity.is_active.is_(True),
                    )
                    .order_by(MedicalEntityRelationship.confidence.desc())
                    .limit(max_results)
                )

                for row in diff_result.all():
                    differentials.append({
                        "diagnosis": row.name,
                        "entity_type": row.entity_type,
                        "confidence": float(row.confidence),
                        "properties": row.properties or {},
                        "reasoning": f"Differential of {primary_diagnosis}",
                    })

        elif symptoms:
            # Find diseases linked to the given symptoms via HAS_SYMPTOM.
            # Count shared symptoms to rank differentials.
            for symptom_name in symptoms:
                symptom_result = await self.db.execute(
                    select(MedicalEntity).where(
                        MedicalEntity.name.ilike(f"%{symptom_name}%"),
                        MedicalEntity.entity_type == "symptom",
                        MedicalEntity.is_active.is_(True),
                    )
                )
                symptom_entity = symptom_result.scalar_one_or_none()

                if symptom_entity:
                    # Find diseases with HAS_SYMPTOM pointing to this symptom.
                    disease_result = await self.db.execute(
                        select(
                            MedicalEntity.name,
                            MedicalEntity.entity_type,
                            MedicalEntityRelationship.confidence,
                        )
                        .join(
                            MedicalEntityRelationship,
                            MedicalEntityRelationship.source_entity_id
                            == MedicalEntity.id,
                        )
                        .where(
                            MedicalEntityRelationship.target_entity_id
                            == symptom_entity.id,
                            MedicalEntityRelationship.relationship_type
                            == "has_symptom",
                            MedicalEntityRelationship.is_active.is_(True),
                            MedicalEntity.is_active.is_(True),
                        )
                        .limit(max_results)
                    )

                    for row in disease_result.all():
                        existing = next(
                            (d for d in differentials
                             if d["diagnosis"] == row.name),
                            None,
                        )
                        if existing:
                            existing["shared_symptom_count"] += 1
                        else:
                            differentials.append({
                                "diagnosis": row.name,
                                "entity_type": row.entity_type,
                                "confidence": float(row.confidence),
                                "shared_symptom_count": 1,
                                "reasoning": (
                                    f"Shares symptom: {symptom_name}"
                                ),
                            })

            # Rank by shared symptom count.
            differentials.sort(
                key=lambda d: d.get("shared_symptom_count", 0), reverse=True
            )

        return {
            "differentials": differentials[:max_results],
            "query": {
                "symptoms": symptoms,
                "primary_diagnosis": primary_diagnosis,
            },
        }

    async def _tool_get_drug_interactions(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Direct edge query on the knowledge graph for drug interactions."""
        drug_a_name = params["drug_a"]
        drug_b_name = params["drug_b"]

        # Find both drug entities.
        drug_a_result = await self.db.execute(
            select(MedicalEntity).where(
                MedicalEntity.name.ilike(f"%{drug_a_name}%"),
                MedicalEntity.entity_type == "drug",
                MedicalEntity.is_active.is_(True),
            )
        )
        drug_a = drug_a_result.scalar_one_or_none()

        drug_b_result = await self.db.execute(
            select(MedicalEntity).where(
                MedicalEntity.name.ilike(f"%{drug_b_name}%"),
                MedicalEntity.entity_type == "drug",
                MedicalEntity.is_active.is_(True),
            )
        )
        drug_b = drug_b_result.scalar_one_or_none()

        if not drug_a or not drug_b:
            return {
                "interactions": [],
                "drug_a": drug_a_name,
                "drug_b": drug_b_name,
                "note": "One or both drugs not found in knowledge graph.",
            }

        # Query edges in both directions (a→b and b→a).
        interaction_result = await self.db.execute(
            select(
                MedicalEntityRelationship.relationship_type,
                MedicalEntityRelationship.properties,
                MedicalEntityRelationship.confidence,
                MedicalEntityRelationship.source_reference,
            ).where(
                MedicalEntityRelationship.is_active.is_(True),
                (
                    (
                        (MedicalEntityRelationship.source_entity_id == drug_a.id)
                        & (MedicalEntityRelationship.target_entity_id == drug_b.id)
                    )
                    | (
                        (MedicalEntityRelationship.source_entity_id == drug_b.id)
                        & (MedicalEntityRelationship.target_entity_id == drug_a.id)
                    )
                ),
                MedicalEntityRelationship.relationship_type.in_([
                    "interacts_with", "contraindicated_in",
                ]),
            )
        )

        interactions = []
        for row in interaction_result.all():
            props = row.properties or {}
            interactions.append({
                "type": row.relationship_type,
                "severity": props.get("severity", "unknown"),
                "mechanism": props.get("mechanism", ""),
                "clinical_significance": props.get(
                    "clinical_significance", ""
                ),
                "confidence": float(row.confidence),
                "source": row.source_reference or "",
            })

        return {
            "interactions": interactions,
            "drug_a": drug_a_name,
            "drug_b": drug_b_name,
        }

    async def _tool_get_competency_details(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Look up NMC competency information from the knowledge graph."""
        code = params["competency_code"]

        result = await self.db.execute(
            select(MedicalEntity).where(
                MedicalEntity.entity_type == "competency",
                MedicalEntity.name.ilike(f"%{code}%"),
                MedicalEntity.is_active.is_(True),
            )
        )
        entity = result.scalar_one_or_none()

        if not entity:
            return {
                "found": False,
                "competency_code": code,
                "note": "Competency not found in knowledge graph.",
            }

        props = entity.properties or {}
        return {
            "found": True,
            "competency_code": code,
            "name": entity.name,
            "description": props.get("description", ""),
            "level": props.get("level", ""),
            "subject": props.get("subject", ""),
            "teaching_method": props.get("teaching_method", ""),
            "assessment_requirements": props.get(
                "assessment_requirements", ""
            ),
            "integration_mappings": props.get("integration_mappings", []),
        }

    async def _tool_get_misconceptions(
        self, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Retrieve common student misconceptions for a topic.

        Sources from MedicalEntity properties JSONB field where
        entity_type is "topic" or "subject" and the properties
        include a "misconceptions" key. Will be enriched over time
        from student interaction data.
        """
        topic_name = params["topic"]
        subject = params.get("subject")

        query = select(MedicalEntity).where(
            MedicalEntity.name.ilike(f"%{topic_name}%"),
            MedicalEntity.entity_type.in_(["topic", "subject", "disease"]),
            MedicalEntity.is_active.is_(True),
        )

        if subject:
            # Filter by a related subject entity if provided — for now,
            # check the properties JSONB for a "subject" key.
            query = query.where(
                MedicalEntity.properties["subject"].astext == subject
            )

        result = await self.db.execute(query.limit(5))
        entities = result.scalars().all()

        misconceptions = []
        for entity in entities:
            props = entity.properties or {}
            entity_misconceptions = props.get("misconceptions", [])
            for m in entity_misconceptions:
                misconceptions.append({
                    "topic": entity.name,
                    "misconception": m.get("misconception", ""),
                    "correct_understanding": m.get(
                        "correct_understanding", ""
                    ),
                    "socratic_question": m.get("socratic_question", ""),
                    "source": m.get("source", ""),
                })

        return {
            "misconceptions": misconceptions,
            "topic": topic_name,
            "subject": subject,
            "note": (
                "Misconception data will be enriched over time from "
                "student interaction patterns."
            ) if not misconceptions else None,
        }
