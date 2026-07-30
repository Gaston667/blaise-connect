"""Contrat de lecture détaillée d'un responsable légal."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class GuardianStudentSummary(BaseModel):
    id: str
    first_name: str
    last_name: str
    registration_number: str | None
    status: str
    relationship: str
    relationship_label: str
    is_primary_contact: bool
    class_name: str | None


class GuardianDetail(BaseModel):
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
    students: list[GuardianStudentSummary]