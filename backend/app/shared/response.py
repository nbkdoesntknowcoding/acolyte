"""Response helpers for standardized API responses.

Success responses use the envelope:
{
    "data": <payload>,
    "meta": {
        "timestamp": "2026-02-10T12:00:00Z"
    }
}

Paginated responses use:
{
    "data": [<items>],
    "meta": {
        "total": 100,
        "page": 1,
        "page_size": 20,
        "total_pages": 5,
        "timestamp": "2026-02-10T12:00:00Z"
    }
}

IMPORTANT: Routes that use these helpers should NOT declare response_model
on the route decorator, because the wrapper adds data/meta keys that differ
from the raw Pydantic schema shape. Existing routes that return Pydantic
models directly (with response_model) continue to work — these helpers are
opt-in for new routes that want the envelope.
"""

import math
from datetime import datetime, timezone
from typing import Any

from fastapi.responses import JSONResponse


def success_response(
    data: Any,
    status_code: int = 200,
    message: str | None = None,
) -> JSONResponse:
    """Wrap a payload in the standard success envelope.

    Args:
        data: The response payload (dict, list, or Pydantic model.model_dump()).
        status_code: HTTP status code (default 200).
        message: Optional human-readable message for the meta block.

    Returns:
        JSONResponse with {"data": ..., "meta": {"timestamp": ...}}.
    """
    meta: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if message:
        meta["message"] = message

    body: dict[str, Any] = {
        "data": data,
        "meta": meta,
    }
    return JSONResponse(status_code=status_code, content=body)


def paginated_response(
    items: list[Any],
    total: int,
    page: int,
    page_size: int,
    status_code: int = 200,
) -> JSONResponse:
    """Wrap a paginated list in the standard paginated envelope.

    Args:
        items: List of items (dicts or Pydantic model.model_dump() results).
        total: Total number of matching records (before pagination).
        page: Current page number (1-indexed).
        page_size: Number of items per page.
        status_code: HTTP status code (default 200).

    Returns:
        JSONResponse with {"data": [...], "meta": {"total", "page", ...}}.
    """
    total_pages = max(1, math.ceil(total / page_size))
    body = {
        "data": items,
        "meta": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }
    return JSONResponse(status_code=status_code, content=body)
