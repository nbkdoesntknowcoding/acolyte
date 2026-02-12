from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8081"
    CORS_ORIGIN_REGEX: str = ""

    # Database (Neon PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/acolyte"

    # Redis (Upstash)
    REDIS_URL: str = "redis://localhost:6379"

    # Clerk Auth
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_JWKS_URL: str = ""
    CLERK_ISSUER: str = ""

    # Permify (hosted on Fly.io — use `flyctl proxy 3476:3476 -a acolyte-permify` for local dev)
    PERMIFY_ENDPOINT: str = "localhost"
    PERMIFY_PORT_HTTP: int = 3476
    PERMIFY_PORT_GRPC: int = 3478
    PERMIFY_API_KEY: str = ""

    @property
    def permify_http_url(self) -> str:
        """Full Permify HTTP base URL."""
        if self.PERMIFY_ENDPOINT in ("localhost", "127.0.0.1"):
            return f"http://{self.PERMIFY_ENDPOINT}:{self.PERMIFY_PORT_HTTP}"
        return f"https://{self.PERMIFY_ENDPOINT}"

    @property
    def permify_grpc_target(self) -> str:
        """Permify gRPC target for the SDK."""
        if self.PERMIFY_ENDPOINT in ("localhost", "127.0.0.1"):
            return f"{self.PERMIFY_ENDPOINT}:{self.PERMIFY_PORT_GRPC}"
        return f"{self.PERMIFY_ENDPOINT}:443"

    # AI Keys
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    LITELLM_MASTER_KEY: str = ""

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "acolyte-storage"
    R2_PUBLIC_URL: str = ""

    # Langfuse
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_HOST: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
