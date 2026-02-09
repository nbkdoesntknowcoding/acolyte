"""Cloudflare R2 storage client (S3-compatible).

Zero egress fees — critical for TB-scale medical imaging.
"""

from uuid import uuid4

import boto3
from botocore.config import Config

from app.config import get_settings

settings = get_settings()


def get_r2_client():
    """Create an S3-compatible client for Cloudflare R2."""
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


async def upload_file(
    file_content: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
    college_id: str = "",
) -> str:
    """Upload a file to R2. Returns the object key."""
    client = get_r2_client()
    key = f"{college_id}/{uuid4()}/{filename}" if college_id else f"{uuid4()}/{filename}"

    client.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=file_content,
        ContentType=content_type,
    )
    return key


async def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for file download."""
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )


async def delete_file(key: str) -> None:
    """Delete a file from R2."""
    client = get_r2_client()
    client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
