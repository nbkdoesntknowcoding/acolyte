from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

# Engine routers
from app.engines.student.routes import router as student_router
from app.engines.faculty.routes import router as faculty_router
from app.engines.compliance.routes import router as compliance_router
from app.engines.admin.routes import router as admin_router
from app.engines.integration.routes import router as integration_router
from app.engines.ai.routes import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    settings = get_settings()
    print(f"Starting Acolyte API [{settings.APP_ENV}]")
    yield
    # Shutdown
    print("Shutting down Acolyte API")


app = FastAPI(
    title="Acolyte AI — Medical Education Platform",
    description="Bridge Layer AI for medical education. Modular monolith with 6 engines.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount engine routers
app.include_router(student_router, prefix="/api/v1/student", tags=["Student Engine"])
app.include_router(faculty_router, prefix="/api/v1/faculty", tags=["Faculty Engine"])
app.include_router(compliance_router, prefix="/api/v1/compliance", tags=["Compliance Engine"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin Engine"])
app.include_router(integration_router, prefix="/api/v1/integration", tags=["Integration Engine"])
app.include_router(ai_router, prefix="/api/v1/ai", tags=["Central AI Engine"])


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "acolyte-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0",
    }
