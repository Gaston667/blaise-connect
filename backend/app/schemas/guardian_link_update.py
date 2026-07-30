"""Contrat de modification d'un lien élève-responsable."""

from typing import Literal

from pydantic import BaseModel, Field


class GuardianLinkUpdate(BaseModel):
    """Champs modifiables sans modifier les dossiers liés."""

    relationship_type: Literal["FATHER", "MOTHER", "OTHER"] | None = None
    relationship_details: str | None = Field(default=None, max_length=100)
    is_legal_guardian: bool | None = None
    is_primary_contact: bool | None = None
    is_emergency_contact: bool | None = None
