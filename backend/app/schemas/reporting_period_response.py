"""Schéma Pydantic de lecture d'une période de bulletin."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReportingPeriodResponse(BaseModel):
    """Informations d'une période retournées par l'API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    school_year_id: UUID
    name: str
    start_date: date
    end_date: date
    created_at: datetime
    updated_at: datetime
