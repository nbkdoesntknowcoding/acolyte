"""File upload/download routes — generic R2 storage API.

All file operations go through these routes. Engines don't interact
with R2 directly — they call these endpoints or use the storage client
via the get_storage() dependency.

Routes:
    POST   /api/v1/files/upload       — Upload a file (multipart/form-data)
    GET    /api/v1/files/{key}/url     — Get a presigned download URL
    DELETE /api/v1/files/{key}         — Delete a file
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.core.storage import (
    ALLOWED_CONTENT_TYPES,
    R2StorageClient,
    build_storage_path,
    get_storage,
    validate_file,
)
from app.dependencies.auth import get_current_user
from app.middleware.clerk_auth import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/files", tags=["Files"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class FileUploadResponse(BaseModel):
    key: str
    url: str | None = None
    content_type: str
    size_bytes: int


class PresignedUrlResponse(BaseModel):
    url: str
    expires_in: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=FileUploadResponse, status_code=201)
async def upload_file(
    file: UploadFile,
    engine: str = Form(..., pattern="^(student|faculty|compliance|admin|integration|ai)$"),
    entity_type: str = Form(..., min_length=1, max_length=50),
    entity_id: str = Form(..., min_length=1, max_length=100),
    user: CurrentUser = Depends(get_current_user),
    storage: R2StorageClient = Depends(get_storage),
):
    """Upload a file to Cloudflare R2.

    Accepts multipart/form-data with:
    - file: The file to upload
    - engine: Which engine owns this file (student, faculty, compliance, admin, integration, ai)
    - entity_type: The type of entity (e.g., "saf-reports", "logbooks", "assessments")
    - entity_id: The entity UUID or identifier

    Files are stored at: {college_id}/{engine}/{entity_type}/{entity_id}/{filename}
    """
    # Validate content type and extension
    try:
        content_type, max_size = validate_file(file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Read file and check size
    contents = await file.read()
    size_bytes = len(contents)

    if size_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )

    if size_bytes > max_size:
        max_mb = max_size / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({size_bytes / (1024*1024):.1f} MB). Max: {max_mb:.0f} MB for {content_type}",
        )

    # Build the storage path
    path = build_storage_path(
        college_id=user.college_id,
        engine=engine,
        entity_type=entity_type,
        entity_id=entity_id,
        filename=file.filename or "upload",
    )

    # Reset file position and upload
    await file.seek(0)
    key = await storage.upload_file(file=file, path=path, content_type=content_type)

    return FileUploadResponse(
        key=key,
        content_type=content_type,
        size_bytes=size_bytes,
    )


@router.get("/{key:path}/url", response_model=PresignedUrlResponse)
async def get_file_url(
    key: str,
    expires_in: int = 3600,
    user: CurrentUser = Depends(get_current_user),
    storage: R2StorageClient = Depends(get_storage),
):
    """Get a presigned URL for downloading a file.

    The key must start with the user's college_id to enforce tenant isolation
    at the storage level — users can only access their own college's files.
    """
    # Tenant isolation: verify the file belongs to the user's college
    expected_prefix = str(user.college_id) + "/"
    if not key.startswith(expected_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: file belongs to a different college",
        )

    # Clamp expires_in
    expires_in = max(60, min(expires_in, 7 * 24 * 3600))

    url = await storage.get_presigned_url(key=key, expires_in=expires_in)
    return PresignedUrlResponse(url=url, expires_in=expires_in)


@router.delete("/{key:path}", status_code=204)
async def delete_file(
    key: str,
    user: CurrentUser = Depends(get_current_user),
    storage: R2StorageClient = Depends(get_storage),
):
    """Delete a file from R2.

    Requires authentication. Tenant isolation enforced via key prefix.
    """
    expected_prefix = str(user.college_id) + "/"
    if not key.startswith(expected_prefix):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: file belongs to a different college",
        )

    deleted = await storage.delete_file(key)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file",
        )
