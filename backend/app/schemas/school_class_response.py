"""Contrat de lecture d'une classe."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SchoolClassResponse(BaseModel):
    """Expose les informations d'une classe."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    school_year_id: UUID
    name: str
    level: str
    is_active: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
