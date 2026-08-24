"""Option de période pour filtrer les notes."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class GradePeriodOption(BaseModel):
    """Période de bulletin déduite des dates d'évaluation."""

    id: UUID
    school_year_id: UUID
    name: str
    start_date: date
    end_date: date
