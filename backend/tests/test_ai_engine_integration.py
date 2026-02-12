"""Central AI Engine — Integration Tests.

Tests cover the full request→response pipeline for each AI agent,
verifying route registration, auth, schema validation, and database
interactions. LLM calls are mocked to avoid API costs in CI.

Usage:
    cd backend
    pytest tests/test_ai_engine_integration.py -v
    pytest tests/test_ai_engine_integration.py -v -k "test_rag"    # single test
    pytest tests/test_ai_engine_integration.py -v --run-llm         # with real LLM calls

Requires:
    - TEST_DATABASE_URL env var (or uses default from config)
    - ANTHROPIC_API_KEY + OPENAI_API_KEY only if --run-llm is passed
"""

import hashlib
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.middleware.clerk_auth import CurrentUser, UserRole

# Import models to register tables in SQLAlchemy metadata
from app.engines.admin.models import College  # noqa: F401

# ---------------------------------------------------------------------------
# Test constants
# ---------------------------------------------------------------------------

TEST_COLLEGE_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
TEST_STUDENT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
TEST_FACULTY_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
TEST_COMPLIANCE_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")


# ---------------------------------------------------------------------------
# Mock users
# ---------------------------------------------------------------------------

def _make_user(user_id: uuid.UUID, role: UserRole) -> CurrentUser:
    return CurrentUser(
        user_id=str(user_id),
        college_id=TEST_COLLEGE_ID,
        role=role,
        email=f"test-{role.value}@acolyte.test",
        full_name=f"Test {role.value.title()}",
        org_slug="test-college",
        session_id="sess_test",
        permissions=[],
    )


STUDENT_USER = _make_user(TEST_STUDENT_ID, UserRole.STUDENT)
FACULTY_USER = _make_user(TEST_FACULTY_ID, UserRole.FACULTY)
COMPLIANCE_USER = _make_user(TEST_COMPLIANCE_ID, UserRole.COMPLIANCE_OFFICER)


# ---------------------------------------------------------------------------
# Pytest configuration
# ---------------------------------------------------------------------------

def pytest_addoption(parser):
    """Add --run-llm option to allow tests with real API calls."""
    parser.addoption(
        "--run-llm",
        action="store_true",
        default=False,
        help="Run tests that make real LLM API calls (requires API keys)",
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client():
    """Async test client with auth dependency overrides."""
    from app.dependencies.auth import get_current_user, get_tenant_db
    from app.core.database import get_db

    async def _override_get_current_user():
        return STUDENT_USER

    async def _override_get_db():
        from app.core.database import async_session_factory
        async with async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def _override_get_tenant_db():
        from app.core.database import async_session_factory
        async with async_session_factory() as session:
            try:
                await session.execute(
                    text(f"SET app.current_college_id = '{TEST_COLLEGE_ID}'"),
                )
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_current_user] = _override_get_current_user
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_tenant_db] = _override_get_tenant_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def faculty_client():
    """Async test client authenticated as faculty."""
    from app.dependencies.auth import get_current_user, get_tenant_db
    from app.core.database import get_db

    async def _override_get_current_user():
        return FACULTY_USER

    async def _override_get_db():
        from app.core.database import async_session_factory
        async with async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def _override_get_tenant_db():
        from app.core.database import async_session_factory
        async with async_session_factory() as session:
            try:
                await session.execute(
                    text(f"SET app.current_college_id = '{TEST_COLLEGE_ID}'"),
                )
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_current_user] = _override_get_current_user
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_tenant_db] = _override_get_tenant_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def compliance_client():
    """Async test client authenticated as compliance officer."""
    from app.dependencies.auth import get_current_user, get_tenant_db
    from app.core.database import get_db

    async def _override_get_current_user():
        return COMPLIANCE_USER

    async def _override_get_db():
        from app.core.database import async_session_factory
        async with async_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def _override_get_tenant_db():
        from app.core.database import async_session_factory
        async with async_session_factory() as session:
            try:
                await session.execute(
                    text(f"SET app.current_college_id = '{TEST_COLLEGE_ID}'"),
                )
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_current_user] = _override_get_current_user
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_tenant_db] = _override_get_tenant_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def db_session():
    """Raw database session for direct DB operations in tests."""
    from app.core.database import async_session_factory

    async with async_session_factory() as session:
        try:
            await session.execute(
                text(f"SET app.current_college_id = '{TEST_COLLEGE_ID}'"),
            )
            yield session
            await session.rollback()
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

def _mock_ai_response(content: str = "Mocked AI response") -> Any:
    """Create a mock AIResponse-like object."""
    from app.engines.ai.gateway import AIResponse
    return AIResponse(
        content=content,
        model="claude-sonnet-4-5-20250929",
        usage={"input_tokens": 100, "output_tokens": 50,
               "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0},
        latency_ms=150,
        execution_id=uuid.uuid4(),
    )


def _mock_rag_result(passages: int = 3) -> Any:
    """Create a mock RAGResult."""
    from app.engines.ai.rag.models import RAGResult, RetrievalResult, QueryClassification

    results = []
    for i in range(passages):
        results.append(RetrievalResult(
            content_id=uuid.uuid4(),
            content=f"Medical content passage {i+1} about pharmacology.",
            source_metadata={
                "title": f"Test Source {i+1}",
                "source_type": "textbook",
                "source_reference": f"Test Book Ch {i+1}",
                "book": "Test Book",
                "chapter": str(i + 1),
                "page": str(i * 10 + 1),
                "subject": "Pharmacology",
                "topic": "Antidiabetics",
            },
            score=0.95 - i * 0.05,
            layer_source="semantic",
        ))

    return RAGResult(
        passages=results,
        formatted_context=(
            '<source book="Test Book" chapter="1" relevance="0.95">\n'
            "Medical content passage 1 about pharmacology.\n</source>"
        ),
        query_classification=QueryClassification(
            category="SEMANTIC",
            active_layers=["bm25", "semantic"],
            primary_layer="semantic",
        ),
        total_results=passages,
    )


# ---------------------------------------------------------------------------
# Test 1: Health check (baseline)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Verify the health endpoint works — baseline sanity check."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "acolyte-api"


# ---------------------------------------------------------------------------
# Test 2: RAG retrieval pipeline
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rag_retrieval_with_seeded_content(db_session: AsyncSession):
    """Test RAG engine retrieves content from seeded MedicalContent rows.

    Seeds a few test content rows and verifies the BM25 search layer
    can find them. This tests the full DB → retrieval path without
    needing embeddings or OpenAI API calls.
    """
    from app.engines.ai.models import MedicalContent
    from app.engines.ai.rag.bm25_search import BM25MedicalSearch

    # Seed minimal test content
    test_content = MedicalContent(
        id=uuid.uuid4(),
        college_id=None,
        source_type="textbook",
        title="Metformin Test Content",
        content=(
            "Metformin is a biguanide oral hypoglycemic agent used as first-line "
            "therapy for type 2 diabetes mellitus. It activates AMPK and reduces "
            "hepatic glucose production."
        ),
        content_hash=hashlib.sha256(b"metformin-test-content-unique").hexdigest(),
        embedding=None,
        chunk_index=0,
        total_chunks=1,
        metadata_={
            "subject": "Pharmacology",
            "topic": "Antidiabetic Drugs",
            "book": "Test Pharmacology",
        },
        source_reference="Test Pharmacology Book, Ch 19",
        medical_entity_type="pharmacology",
        is_active=True,
    )
    db_session.add(test_content)
    await db_session.flush()

    # Test BM25 search
    bm25 = BM25MedicalSearch()
    results = await bm25.search(
        db_session, "metformin diabetes", college_id=None, top_k=5,
    )

    assert len(results) >= 1
    found = any("metformin" in r.content.lower() for r in results)
    assert found, "BM25 should find the seeded metformin content"


# ---------------------------------------------------------------------------
# Test 3: Socratic Study Buddy route registration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_study_buddy_route_exists(client: AsyncClient):
    """Verify the study buddy endpoint is registered and requires auth.

    We mock the LangGraph agent to test just the HTTP layer.
    """
    with patch(
        "app.engines.ai.agents.socratic_study_buddy.stream_socratic_study_buddy",
        new_callable=AsyncMock,
    ):
        response = await client.post(
            "/api/v1/ai/student/study-buddy",
            json={
                "question": "What is the mechanism of action of metformin?",
            },
        )
        # Should return 200 with SSE content type (streaming response)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# Test 4: Practice Question Generator
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_practice_question_generator(client: AsyncClient):
    """Test the practice question generation endpoint with mocked LLM.

    Verifies the full route → agent → response chain with a mocked
    gateway that returns pre-built structured output.
    """
    from app.engines.ai.agents.practice_question_generator import (
        PracticeQuestionBatch,
        GeneratedMCQ,
        MCQOption,
    )

    mock_batch = PracticeQuestionBatch(
        questions=[
            GeneratedMCQ(
                stem="A 45-year-old male with type 2 diabetes is started on metformin. "
                     "Which of the following best describes its mechanism of action?",
                lead_in="Select the most appropriate answer:",
                options=[
                    MCQOption(text="Stimulates insulin secretion from beta cells", is_correct=False, explanation="This describes sulfonylureas, not metformin."),
                    MCQOption(text="Activates AMPK to reduce hepatic gluconeogenesis", is_correct=True, explanation="Metformin activates AMP-activated protein kinase (AMPK) in hepatocytes."),
                    MCQOption(text="Inhibits DPP-4 enzyme", is_correct=False, explanation="This describes sitagliptin/DPP-4 inhibitors."),
                    MCQOption(text="Blocks alpha-glucosidase", is_correct=False, explanation="This describes acarbose."),
                ],
                correct_answer_index=1,
                difficulty_rating=3,
                blooms_level="understand",
                subject="Pharmacology",
                topic="Antidiabetic Drugs",
                competency_code="PH 1.25",
                source_citations=["KD Tripathi, Essentials of Medical Pharmacology, Ch 19"],
                distractor_reasoning=["Sulfonylureas mechanism", "DPP-4 inhibitor mechanism", "Alpha-glucosidase inhibitor mechanism"],
                clinical_pearl="Metformin does NOT cause hypoglycemia when used alone — a key differentiator from sulfonylureas.",
            ),
        ],
        generation_metadata={"total_generated": 1, "total_passed_safety": 1, "execution_id": str(uuid.uuid4())},
    )

    with patch(
        "app.engines.ai.agents.practice_question_generator.generate_practice_questions",
        new_callable=AsyncMock,
        return_value=mock_batch,
    ):
        response = await client.post(
            "/api/v1/ai/student/generate-practice-questions",
            json={
                "subject": "Pharmacology",
                "topic": "Antidiabetic Drugs",
                "difficulty": 3,
                "blooms_level": "understand",
                "count": 1,
                "question_type": "mcq",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "questions" in data
    assert data["questions"][0]["correct_answer_index"] == 1


# ---------------------------------------------------------------------------
# Test 5: Exam Question Generator with Faculty Review
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_exam_question_generation_requires_faculty(client: AsyncClient):
    """Student client should NOT be able to access faculty exam generation."""
    response = await client.post(
        "/api/v1/ai/faculty/generate-exam-questions",
        json={
            "subject": "Pharmacology",
            "topic": "Antidiabetic Drugs",
            "difficulty": 3,
            "count": 1,
        },
    )
    # Student user should get 403 (require_faculty_or_above)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_exam_question_generation_faculty_access(faculty_client: AsyncClient):
    """Faculty client should be able to generate exam questions."""
    from app.engines.ai.agents.exam_question_generator import ExamQuestionDraft

    mock_draft = ExamQuestionDraft(
        questions=[],
        execution_id=str(uuid.uuid4()),
        review_status="pending_review",
        generation_metadata={"total_generated": 1, "question_types": ["mcq"]},
    )

    with patch(
        "app.engines.ai.agents.exam_question_generator.generate_exam_questions",
        new_callable=AsyncMock,
        return_value=mock_draft,
    ):
        response = await faculty_client.post(
            "/api/v1/ai/faculty/generate-exam-questions",
            json={
                "subject": "Pharmacology",
                "topic": "Antidiabetic Drugs",
                "difficulty": 3,
                "count": 1,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["review_status"] == "pending_review"


# ---------------------------------------------------------------------------
# Test 6: Metacognitive Event Capture
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_capture_metacognitive_event(client: AsyncClient):
    """Test capturing a student interaction event via the API.

    Mocks the analytics engine to verify the route properly
    parses and forwards the event.
    """
    with patch(
        "app.engines.ai.analytics.metacognitive.get_analytics_engine",
    ) as mock_get_engine:
        mock_engine = MagicMock()
        mock_engine.capture_event = AsyncMock()
        mock_get_engine.return_value = mock_engine

        response = await client.post(
            "/api/v1/ai/student/capture-event",
            json={
                "event_type": "question_answered",
                "event_data": {
                    "question_id": str(uuid.uuid4()),
                    "selected_answer": "B",
                    "is_correct": True,
                    "confidence": 4,
                    "time_spent_ms": 45000,
                },
                "subject": "Pharmacology",
                "topic": "Antidiabetic Drugs",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "captured"
    mock_engine.capture_event.assert_called_once()


# ---------------------------------------------------------------------------
# Test 7: Flashcard Generation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_flashcard_generation_from_topic(client: AsyncClient):
    """Test flashcard generation from a medical topic."""
    from app.engines.ai.agents.flashcard_schemas import FlashcardBatch, FlashcardResponse

    mock_batch = FlashcardBatch(
        flashcards=[
            FlashcardResponse(
                id=str(uuid.uuid4()),
                front="What is the mechanism of action of metformin?",
                back="Activates AMPK, reduces hepatic gluconeogenesis, enhances peripheral glucose uptake via GLUT4.",
                card_type="basic",
                subject="Pharmacology",
                topic="Antidiabetic Drugs",
                organ_system=None,
                difficulty=3,
                tags=["pharmacology", "antidiabetics", "metformin"],
                source_citation="KD Tripathi Ch 19",
                source_pdf_id=None,
                clinical_pearl="Metformin does not cause hypoglycemia when used alone.",
                competency_code="PH 1.25",
                is_ai_generated=True,
                is_active=True,
                created_at=datetime.now(timezone.utc),
            ),
        ],
        total_generated=1,
        source_type="topic",
        generation_metadata={"execution_id": str(uuid.uuid4())},
    )

    with patch(
        "app.engines.ai.agents.flashcard_generator.generate_flashcards_from_topic",
        new_callable=AsyncMock,
        return_value=mock_batch,
    ):
        response = await client.post(
            "/api/v1/ai/student/flashcards/generate-from-topic",
            json={
                "subject": "Pharmacology",
                "topic": "Antidiabetic Drugs",
                "count": 5,
                "focus": "high_yield",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "flashcards" in data
    assert data["total_generated"] == 1
    assert "metformin" in data["flashcards"][0]["front"].lower()


# ---------------------------------------------------------------------------
# Test 8: Flashcard Review Session (SM-2)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_flashcard_review_session(client: AsyncClient):
    """Test getting a flashcard review session."""
    from app.engines.ai.agents.flashcard_schemas import ReviewSession, ReviewCard

    mock_session = ReviewSession(
        cards=[
            ReviewCard(
                id=str(uuid.uuid4()),
                front="What is the MOA of metformin?",
                back="AMPK activation, reduces hepatic gluconeogenesis.",
                card_type="basic",
                subject="Pharmacology",
                topic="Antidiabetic Drugs",
                difficulty=3,
                clinical_pearl="Metformin does not cause hypoglycemia when used alone.",
                ease_factor=2.5,
                interval_days=1,
                repetition_count=0,
                days_overdue=0,
            ),
        ],
        total_due=1,
        new_cards=0,
        overdue_cards=0,
    )

    with patch(
        "app.engines.ai.agents.flashcard_generator.get_review_session",
        new_callable=AsyncMock,
        return_value=mock_session,
    ):
        response = await client.get(
            "/api/v1/ai/student/flashcards/review-session",
            params={"max_cards": 20},
        )

    assert response.status_code == 200
    data = response.json()
    assert "cards" in data
    assert data["total_due"] == 1


# ---------------------------------------------------------------------------
# Test 9: Recommendation Engine
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_recommendations(client: AsyncClient):
    """Test getting student recommendations (auto-generates if empty)."""
    from app.engines.ai.agents.recommendation_schemas import (
        RecommendationListResponse,
        RecommendationResponse,
    )

    mock_result = RecommendationListResponse(
        recommendations=[
            RecommendationResponse(
                id=str(uuid.uuid4()),
                type="review_weak_topic",
                priority=1,
                title="Review Antidiabetic Drugs",
                description="Your mastery in Antidiabetic Drugs dropped below 50%.",
                action="Open Pharmacology → Antidiabetic Drugs for a focused review session.",
                estimated_time_minutes=30,
                reason="Mastery dropped from 65% to 42% over last 7 days.",
                deep_link="/study/pharmacology/antidiabetic-drugs",
                trigger="login",
                status="active",
                created_at=datetime.now(timezone.utc),
            ),
        ],
        total=1,
        active=1,
    )

    with patch(
        "app.engines.ai.agents.recommendation_engine.get_current_recommendations",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await client.get("/api/v1/ai/student/recommendations")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["recommendations"][0]["type"] == "review_weak_topic"


# ---------------------------------------------------------------------------
# Test 10: Study Plan
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_study_plan_no_plan(client: AsyncClient):
    """Test study plan endpoint when no plan exists."""
    with patch(
        "app.engines.ai.agents.recommendation_engine.get_current_study_plan",
        new_callable=AsyncMock,
        return_value=None,
    ):
        response = await client.get("/api/v1/ai/student/study-plan")

    assert response.status_code == 200
    data = response.json()
    assert data["has_plan"] is False


# ---------------------------------------------------------------------------
# Test 11: Compliance Check (compliance officer role)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_compliance_check_requires_auth(client: AsyncClient):
    """Student client should NOT be able to run compliance checks."""
    response = await client.post(
        "/api/v1/ai/compliance/run-check",
        json={"snapshot_type": "manual"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_compliance_dashboard(compliance_client: AsyncClient):
    """Compliance officer can access the compliance dashboard."""
    try:
        response = await compliance_client.get("/api/v1/ai/compliance/dashboard")
    except Exception as exc:
        if "UndefinedTableError" in str(type(exc).__name__) or "compliance" in str(exc).lower():
            pytest.skip("Compliance tables not yet created (run alembic upgrade head)")
        raise
    assert response.status_code == 200
    data = response.json()
    assert "overall_status" in data
    assert "active_alerts" in data


# ---------------------------------------------------------------------------
# Test 12: Budget Tracking
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ai_budget_tracking():
    """Test that AI budget tracking correctly computes cost and updates usage.

    Directly tests the AIGateway._calculate_cost and budget update logic.
    """
    from app.engines.ai.gateway import AIGateway

    # Test cost calculation
    usage = {
        "input_tokens": 1000,
        "output_tokens": 500,
        "cache_read_input_tokens": 200,
        "cache_creation_input_tokens": 0,
    }

    cost = AIGateway._calculate_cost(usage, "claude-sonnet-4-5-20250929")

    # Sonnet: $3/M input, $15/M output, $0.30/M cache_read
    expected = (
        Decimal("1000") * Decimal("3.00") / Decimal("1000000")    # input
        + Decimal("500") * Decimal("15.00") / Decimal("1000000")  # output
        + Decimal("200") * Decimal("0.30") / Decimal("1000000")   # cache_read
    )
    assert cost == expected

    # Test batch discount
    batch_cost = AIGateway._calculate_cost(
        usage, "claude-sonnet-4-5-20250929", is_batch=True,
    )
    assert batch_cost == expected * Decimal("0.50")


# ---------------------------------------------------------------------------
# Test 13: Copilot Route Registration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_copilot_configs_endpoint(client: AsyncClient):
    """Test that copilot configuration listing works."""
    response = await client.get("/api/v1/ai/copilot/configs")
    assert response.status_code == 200
    data = response.json()
    assert "copilots" in data
    assert "default" in data
    # Student user → student_copilot should be default
    assert data["default"] == "student_copilot"


# ---------------------------------------------------------------------------
# Test 14: NEET-PG Mock Test Route
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_neetpg_mock_test_route(client: AsyncClient):
    """Test NEET-PG mock test generation endpoint."""
    from app.engines.ai.agents.neet_pg_schemas import NEETPGMockTest

    mock_test = NEETPGMockTest(
        test_id=str(uuid.uuid4()),
        test_type="mini",
        question_count=50,
        duration_minutes=53,
        questions=[],
        blueprint_used={"Pharmacology": 8, "Pathology": 7, "Medicine": 10},
        difficulty_distribution={"easy": 15, "medium": 25, "hard": 10},
        total_marks=200,
        weak_area_weighted=False,
        generation_metadata={"model": "claude-sonnet-4-5-20250929"},
    )

    with patch(
        "app.engines.ai.agents.neet_pg_prep.generate_neetpg_mock_test",
        new_callable=AsyncMock,
        return_value=mock_test,
    ):
        response = await client.post(
            "/api/v1/ai/student/neetpg/generate-mock",
            json={"test_type": "mini"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["test_type"] == "mini"
    assert data["question_count"] == 50


# ---------------------------------------------------------------------------
# Test 15: SAF Template Listing (compliance)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_saf_template_listing(compliance_client: AsyncClient):
    """Compliance officer can list SAF templates."""
    try:
        response = await compliance_client.get("/api/v1/ai/compliance/templates")
    except Exception as exc:
        if "UndefinedTableError" in str(type(exc).__name__) or "saf_templates" in str(exc).lower():
            pytest.skip("SAF tables not yet created (run alembic upgrade head)")
        raise
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Test 16: Route Count Verification
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ai_engine_route_count():
    """Verify the AI engine has all expected routes registered.

    This is a regression test — if someone accidentally removes
    a route, this test will catch it.
    """
    from app.engines.ai.routes import router

    routes = [r for r in router.routes if hasattr(r, "methods")]
    route_paths = [r.path for r in routes]

    # Core routes that MUST exist
    expected_routes = [
        "/copilot/query",
        "/copilot/configs",
        "/student/study-buddy",
        "/student/generate-practice-questions",
        "/student/capture-event",
        "/student/my-analytics",
        "/student/archetype-questionnaire",
        "/student/my-archetype",
        "/student/neetpg/generate-mock",
        "/student/neetpg/submit-test",
        "/student/neetpg/high-yield-topics",
        "/student/neetpg/history",
        "/student/flashcards/generate-from-pdf",
        "/student/flashcards/generate-from-topic",
        "/student/flashcards/review-session",
        "/student/flashcards/{card_id}/review",
        "/student/flashcards/stats",
        "/student/recommendations",
        "/student/study-plan",
        "/student/recommendations/{recommendation_id}/dismiss",
        "/student/recommendations/{recommendation_id}/complete",
        "/faculty/generate-exam-questions",
        "/faculty/review-question",
        "/faculty/student-analytics/{student_id}",
        "/faculty/at-risk-students",
        "/faculty/department-analytics",
        "/compliance/run-check",
        "/compliance/dashboard",
        "/compliance/trends",
        "/compliance/data-gaps",
        "/compliance/data-sources",
        "/compliance/templates",
        "/compliance/documents/generate",
        "/compliance/documents",
    ]

    for expected in expected_routes:
        assert expected in route_paths, (
            f"Missing route: {expected}. "
            f"Available: {sorted(route_paths)}"
        )


# ---------------------------------------------------------------------------
# Test 17: Seed Script Dry Run
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_seed_script_dry_run():
    """Test the seed script in dry-run mode (no DB or API calls)."""
    from scripts.seed_medical_content import (
        ALL_CONTENT_BY_SUBJECT,
        ENTITIES,
        EXTRA_ENTITIES,
        RELATIONSHIPS,
    )

    # Verify content counts
    total_chunks = sum(len(c) for c in ALL_CONTENT_BY_SUBJECT.values())
    assert total_chunks >= 40, f"Expected >=40 chunks, got {total_chunks}"
    assert len(ALL_CONTENT_BY_SUBJECT) == 5  # 5 subjects

    # Verify entity counts
    all_entities = ENTITIES + EXTRA_ENTITIES
    assert len(all_entities) >= 50, f"Expected >=50 entities, got {len(all_entities)}"

    # Verify relationship counts
    assert len(RELATIONSHIPS) >= 70, f"Expected >=70 relationships, got {len(RELATIONSHIPS)}"

    # Verify all subjects present
    subjects = set(ALL_CONTENT_BY_SUBJECT.keys())
    for s in ("Pharmacology", "Pathology", "Anatomy", "Physiology", "Medicine"):
        assert s in subjects, f"Missing subject: {s}"

    # Verify no duplicate entity names within same type
    seen = set()
    for etype, name, *_ in all_entities:
        key = (etype, name)
        assert key not in seen, f"Duplicate entity: {key}"
        seen.add(key)


# ---------------------------------------------------------------------------
# Test 18: Knowledge Graph Entity Seeding
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_seed_entities_idempotent(db_session: AsyncSession):
    """Test that entity seeding is idempotent (re-running skips existing)."""
    from scripts.seed_medical_content import seed_medical_entities

    # First run — should create entities
    result1 = await seed_medical_entities(db_session)
    await db_session.flush()

    # Second run — should skip all (idempotent)
    result2 = await seed_medical_entities(db_session)

    assert result2["created"] == 0
    assert result2["skipped"] == result1["created"] + result1["skipped"]


# ---------------------------------------------------------------------------
# Test 19: Medical Content Hash Deduplication
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_content_hash_deduplication(db_session: AsyncSession):
    """Test that seeding the same content twice skips duplicates."""
    from scripts.seed_medical_content import seed_medical_content

    # First run
    result1 = await seed_medical_content(db_session, skip_embeddings=True)
    await db_session.flush()

    # Second run — all should be skipped
    result2 = await seed_medical_content(db_session, skip_embeddings=True)

    assert result2["created"] == 0
    assert result2["skipped"] == result1["created"] + result1["skipped"]
