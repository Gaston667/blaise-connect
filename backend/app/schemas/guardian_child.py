"""Contrat de l'élève rattaché à un responsable (portail parents)."""

from uuid import UUID

from pydantic import BaseModel


class GuardianChild(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    gender: str | None
    photo_path: str | None
    relationship_type: str
    relationship_details: str | None
    is_legal_guardian: bool
    is_primary_contact: bool
    class_name: str | None
    school_year_name: str | None
