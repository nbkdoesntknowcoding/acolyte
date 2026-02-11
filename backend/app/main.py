import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.permify.client import PermifyClient
from app.dependencies.auth import get_current_user
from app.middleware.clerk_auth import CurrentUser

# Engine routers
from app.engines.student.routes import router as student_router
from app.engines.faculty.routes import router as faculty_router
from app.engines.compliance.routes import router as compliance_router
from app.engines.admin.routes import router as admin_router
from app.engines.integration.routes import router as integration_router
from app.engines.ai.router import router as ai_router
from app.routes.webhooks import router as webhooks_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    settings = get_settings()
    logger.info("Starting Acolyte API [%s]", settings.APP_ENV)

    # Initialize Permify client and push schema
    permify = PermifyClient(settings)
    app.state.permify = permify

    healthy = await permify.health_check()
    if healthy:
        logger.info("Permify connected at %s", permify._base_url)
        version = await permify.push_schema()
        if version:
            logger.info("Permify schema synced (version: %s)", version)
        else:
            logger.warning("Failed to push Permify schema — authorization may be stale")
    else:
        logger.warning(
            "Permify unreachable at %s — permission checks will fail closed (deny all)",
            permify._base_url,
        )

    yield

    # Shutdown
    await permify.close()
    logger.info("Shutting down Acolyte API")


app = FastAPI(
    title="Acolyte AI — Medical Education Platform",
    description="Bridge Layer AI for medical education. Modular monolith with 6 engines.",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware stack (applied in REVERSE order — last added runs first)
#
# Request flow:  CORS → Rate Limit → [route handler w/ Depends auth + RLS]
#
# Auth and tenant RLS are handled via FastAPI Depends, not middleware,
# because they need per-route granularity (public vs protected endpoints).
# ---------------------------------------------------------------------------

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
app.include_router(webhooks_router)  # Mounted at /api/v1/webhooks/clerk/*


# ---------------------------------------------------------------------------
# Public endpoints (no auth required)
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    permify: PermifyClient | None = getattr(app.state, "permify", None)
    permify_ok = await permify.health_check() if permify else False

    return {
        "status": "healthy",
        "service": "acolyte-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0",
        "dependencies": {
            "permify": "connected" if permify_ok else "unreachable",
        },
    }


# ---------------------------------------------------------------------------
# Auth test endpoint
# ---------------------------------------------------------------------------

@app.get("/api/v1/me", tags=["Auth"])
async def get_me(user: CurrentUser = Depends(get_current_user)):
    """Return the authenticated user's profile and tenant context.

    Requires a valid Clerk Bearer token.
    """
    return {
        "user_id": user.user_id,
        "college_id": str(user.college_id),
        "role": user.role.value,
        "email": user.email,
        "full_name": user.full_name,
        "org_slug": user.org_slug,
        "permissions": user.permissions,
    }
