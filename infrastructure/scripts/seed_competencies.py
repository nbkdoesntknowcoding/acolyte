"""Seed NMC CBME competencies into the database.

Loads from infrastructure/seed/ JSON files:
- competencies_vol1.json (1,118 preclinical)
- competencies_vol2.json (1,299 clinical)
- competencies_vol3.json (~900 surgical)
- aetcom_modules.json (27 modules, 54 competencies)
"""

import json
import asyncio
from pathlib import Path

SEED_DIR = Path(__file__).parent.parent / "seed"


async def seed_competencies():
    """Load competency data from JSON files and insert into database."""
    # TODO: Implement when seed JSON files are available
    print("Competency seeding not yet implemented — seed files pending")


if __name__ == "__main__":
    asyncio.run(seed_competencies())
