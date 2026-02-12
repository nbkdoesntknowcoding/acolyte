"""Faculty Engine — Public Interface.

Other engines import ONLY from this file.
"""

from app.engines.faculty.models import ClinicalRotation

__all__ = ["ClinicalRotation"]
