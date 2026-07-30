"""Contrat de création d'un lien entre un élève et un responsable."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class GuardianLinkCreate(BaseModel):
    """Décrit la responsabilité exercée auprès d'un élève."""

    relationship_type: Literal["FATHER", "MOTHER", "OTHER"]
    relationship_details: str | None = Field(default=None, max_length=100)
    is_legal_guardian: bool = False
    is_primary_contact: bool = False
    is_emergency_contact: bool = False

    @model_validator(mode="after")
    def validate_relationship_details(self) -> "GuardianLinkCreate":
        """Exige une précision uniquement pour une relation de type OTHER."""

        details = self.relationship_details.strip() if self.relationship_details else None
        if self.relationship_type == "OTHER" and not details:
            raise ValueError("Précisez le lien lorsque le type est OTHER.")
        if self.relationship_type != "OTHER" and details:
            raise ValueError("La précision du lien est réservée au type OTHER.")
        self.relationship_details = details
        return self
