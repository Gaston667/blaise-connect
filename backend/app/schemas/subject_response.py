"""Contrat de lecture d'une matière."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SubjectResponse(BaseModel):
    """Expose une matière sans son coefficient de classe."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
