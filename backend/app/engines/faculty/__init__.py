"""Faculty Engine — Public Interface.

Other engines import ONLY from this file.
"""

from app.engines.faculty.models import ClinicalRotation
from app.engines.faculty.services.qr_handlers import register_faculty_qr_handlers

__all__ = [
    "ClinicalRotation",
    "register_faculty_qr_handlers",
]
