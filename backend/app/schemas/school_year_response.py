"""Schéma Pydantic de lecture d'une année scolaire."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SchoolYearResponse(BaseModel):
    """Informations d'une année scolaire retournées par l'API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    start_date: date
    end_date: date
    is_current: bool
    closed_at: datetime | None
    closed_by_account_id: UUID | None
    created_at: datetime
    updated_at: datetime
