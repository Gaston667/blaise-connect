"""Contrat de lecture d'un responsable légal."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class GuardianResponse(BaseModel):
    """Expose les informations non sensibles d'un responsable."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID | None
    first_name: str
    last_name: str
    gender: str | None
    email: str | None
    phone: str
    address: str | None
    occupation: str | None
    employer: str | None
    photo_path: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
