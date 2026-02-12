"""Cloudflare R2 storage client (S3-compatible).

Zero egress fees — critical for TB-scale medical imaging (DICOM, WSI, PDFs).

Path convention:
    {college_id}/{engine}/{entity_type}/{entity_id}/{filename}

Examples:
    college-uuid/compliance/saf-reports/report-uuid/SAF_AI_2025.pdf
    college-uuid/student/logbooks/student-uuid/anatomy_logbook.pdf
    college-uuid/faculty/assessments/assessment-uuid/blueprint.xlsx
    college-uuid/admin/certificates/student-uuid/degree_cert.pdf

NOTE: For production at scale, consider Cloudflare R2 presigned upload URLs
for direct browser → R2 uploads. This bypasses our API for large files and
avoids tying up a Fly.io machine during multi-hundred-MB video uploads.
The proxy approach below is fine for MVP (documents, images, small files).
"""

import logging
from uuid import UUID

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import UploadFile

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# File validation constants
# ---------------------------------------------------------------------------

# Max file sizes in bytes
MAX_DOCUMENT_SIZE = 50 * 1024 * 1024      # 50 MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024         # 500 MB

ALLOWED_CONTENT_TYPES: dict[str, int] = {
    # Documents
    "application/pdf": MAX_DOCUMENT_SIZE,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": MAX_DOCUMENT_SIZE,  # .docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": MAX_DOCUMENT_SIZE,        # .xlsx
    "text/csv": MAX_DOCUMENT_SIZE,
    # Images
    "image/png": MAX_DOCUMENT_SIZE,
    "image/jpeg": MAX_DOCUMENT_SIZE,
    # Video
    "video/mp4": MAX_VIDEO_SIZE,
}

ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".xlsx", ".csv",
    ".png", ".jpg", ".jpeg",
    ".mp4",
}


def validate_file(file: UploadFile, max_size_override: int | None = None) -> tuple[str, int]:
    """Validate file content type and size.

    Returns:
        (content_type, max_allowed_size) if valid.

    Raises:
        ValueError: If content type or extension is not allowed.
    """
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename or ""

    # Check content type
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"Content type '{content_type}' is not allowed. "
            f"Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES.keys()))}"
        )

    # Check extension
    ext = ""
    if "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"File extension '{ext}' is not allowed. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    max_size = max_size_override or ALLOWED_CONTENT_TYPES[content_type]
    return content_type, max_size


def build_storage_path(
    college_id: UUID,
    engine: str,
    entity_type: str,
    entity_id: str,
    filename: str,
) -> str:
    """Build the canonical R2 object key.

    Format: {college_id}/{engine}/{entity_type}/{entity_id}/{filename}
    """
    safe_filename = filename.replace("/", "_").replace("\\", "_")
    return f"{college_id}/{engine}/{entity_type}/{entity_id}/{safe_filename}"


# ---------------------------------------------------------------------------
# R2StorageClient
# ---------------------------------------------------------------------------

class R2StorageClient:
    """Cloudflare R2 storage operations via S3-compatible API.

    Uses boto3 synchronously (R2 operations are fast, no async driver needed).
    Wrapped in the FastAPI route layer which runs in the async event loop via
    run_in_executor automatically for sync I/O.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client = None
        self._bucket = self._settings.R2_BUCKET_NAME

    @property
    def client(self):
        """Lazy-init the boto3 S3 client."""
        if self._client is None:
            s = self._settings
            if not s.R2_ACCOUNT_ID:
                logger.warning("R2_ACCOUNT_ID not set — storage operations will fail")
            self._client = boto3.client(
                "s3",
                endpoint_url=f"https://{s.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                aws_access_key_id=s.R2_ACCESS_KEY_ID,
                aws_secret_access_key=s.R2_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
            )
        return self._client

    async def upload_file(
        self,
        file: UploadFile,
        path: str,
        content_type: str | None = None,
    ) -> str:
        """Upload a file to R2.

        Args:
            file: FastAPI UploadFile from multipart form.
            path: Full R2 object key (use build_storage_path).
            content_type: Override content type. Defaults to file.content_type.

        Returns:
            The R2 object key.
        """
        ct = content_type or file.content_type or "application/octet-stream"
        body = await file.read()

        self.client.put_object(
            Bucket=self._bucket,
            Key=path,
            Body=body,
            ContentType=ct,
        )
        logger.info("Uploaded %s (%d bytes, %s)", path, len(body), ct)
        return path

    async def upload_bytes(
        self,
        data: bytes,
        path: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload raw bytes to R2. For programmatic uploads (generated PDFs, etc.)."""
        self.client.put_object(
            Bucket=self._bucket,
            Key=path,
            Body=data,
            ContentType=content_type,
        )
        logger.info("Uploaded %s (%d bytes)", path, len(data))
        return path

    async def download_file(self, key: str) -> bytes:
        """Download a file from R2.

        Raises:
            FileNotFoundError: If the key does not exist.
        """
        try:
            response = self.client.get_object(Bucket=self._bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"R2 object not found: {key}")
            raise

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned URL for direct browser download.

        Args:
            key: R2 object key.
            expires_in: URL validity in seconds (default 1 hour, max 7 days).

        Returns:
            Presigned HTTPS URL.
        """
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=min(expires_in, 7 * 24 * 3600),
        )

    async def get_presigned_upload_url(
        self,
        key: str,
        content_type: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate a presigned URL for direct browser upload (bypasses API).

        Use this for large files (video, DICOM) to avoid tying up API machines.
        """
        return self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self._bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=min(expires_in, 3600),
        )

    async def delete_file(self, key: str) -> bool:
        """Delete a file from R2. Returns True if successful."""
        try:
            self.client.delete_object(Bucket=self._bucket, Key=key)
            logger.info("Deleted %s", key)
            return True
        except ClientError as e:
            logger.error("Failed to delete %s: %s", key, e)
            return False

    async def list_files(self, prefix: str) -> list[str]:
        """List all object keys under a prefix.

        Args:
            prefix: Key prefix (e.g., "college-uuid/compliance/").

        Returns:
            List of object keys.
        """
        keys: list[str] = []
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                keys.append(obj["Key"])
        return keys

    async def file_exists(self, key: str) -> bool:
        """Check if a file exists in R2."""
        try:
            self.client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError:
            return False


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

_storage_client: R2StorageClient | None = None


def get_storage() -> R2StorageClient:
    """FastAPI dependency for the R2 storage client (singleton)."""
    global _storage_client
    if _storage_client is None:
        _storage_client = R2StorageClient()
    return _storage_client
