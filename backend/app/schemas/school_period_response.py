"""Contrat de lecture d'une période scolaire."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SchoolPeriodResponse(BaseModel):
    """Expose une période rattachée à son année scolaire."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    school_year_id: UUID
    name: str
    start_date: date
    end_date: date
    created_at: datetime
    updated_at: datetime
