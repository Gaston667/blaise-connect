"""Contrat de lecture d'une année scolaire."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SchoolYearResponse(BaseModel):
    """Expose les informations non sensibles d'une année scolaire."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime
