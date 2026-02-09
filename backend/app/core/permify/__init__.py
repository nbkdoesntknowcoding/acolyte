"""Permify authorization module — Zanzibar-style ReBAC for Acolyte.

Permify is hosted on Fly.io (acolyte-permify). For local dev:
    flyctl proxy 3476:3476 -a acolyte-permify
"""

from app.core.permify.client import PermifyClient

__all__ = ["PermifyClient"]
