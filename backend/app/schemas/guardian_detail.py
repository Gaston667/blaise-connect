"""Contrat de lecture détaillée d'un responsable légal."""
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class GuardianStudentSummary(BaseModel):
    id: str
    first_name: str
    last_name: str
    registration_number: str | None
    birth_date: date | None
    photo_path: str | None
    status: str
    relationship: str
    relationship_label: str
    is_primary_contact: bool
    is_legal_guardian: bool
    is_emergency_contact: bool
    school_year_name: str | None
    class_name: str | None


class GuardianDetail(BaseModel):
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
    students: list[GuardianStudentSummary]