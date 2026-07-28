"""Contrat de lecture d'un responsable légal."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class GuardianResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID | None
    first_name: str
    last_name: str
    email: str | None
    phone: str
    address: str | None
    occupation: str | None
    employer: str | None
    created_at: datetime
    updated_at: datetime


class StudentGuardianResponse(GuardianResponse):
    """Responsable vu depuis la fiche d'un élève, avec le lien."""
    link_id: UUID
    relationship: str
    is_primary_contact: bool