"""Base class for university portal adapters."""

from abc import ABC, abstractmethod


class UniversityAdapter(ABC):
    """Abstract base for per-university portal adapters (RGUHS, VTU, MUHS, etc.)."""

    @abstractmethod
    async def sync_results(self, college_id: str) -> dict:
        """Sync exam results from university portal."""
        pass

    @abstractmethod
    async def submit_enrollment(self, student_data: dict) -> dict:
        """Submit enrollment data to university."""
        pass
