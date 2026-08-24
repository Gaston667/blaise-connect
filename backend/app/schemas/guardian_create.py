"""Contrat de création d'un responsable légal, avec lien facultatif."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.phone_number import normalize_international_phone


class GuardianCreate(BaseModel):
    """Données du responsable et, facultativement, de son lien à un élève."""

    first_name: str
    last_name: str
    phone: str
    gender: str | None = None
    nationality: str = Field(min_length=1, max_length=100)
    email: str | None = None
    address: str | None = None
    occupation: str | None = None
    employer: str | None = None

    student_id: str | None = None
    relationship_type: Literal["FATHER", "MOTHER", "OTHER"] | None = None
    relationship_details: str | None = Field(default=None, max_length=100)
    is_legal_guardian: bool = False
    is_emergency_contact: bool = False

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: str) -> str:
        """Valide le téléphone obligatoire du responsable."""

        normalized_phone = normalize_international_phone(phone)
        if normalized_phone is None:
            raise ValueError("Le téléphone est obligatoire.")
        return normalized_phone

    @model_validator(mode="after")
    def validate_optional_student_link(self) -> "GuardianCreate":
        """Valide les données du lien seulement lorsqu'un élève est fourni."""

        details = self.relationship_details.strip() if self.relationship_details else None
        if self.student_id is None:
            has_link_data = (
                self.relationship_type is not None
                or details is not None
                or self.is_legal_guardian
                or self.is_emergency_contact
            )
            if has_link_data:
                raise ValueError("student_id est requis pour créer un lien.")
            return self

        if self.relationship_type is None:
            raise ValueError("relationship_type est requis pour rattacher ce responsable.")
        if self.relationship_type == "OTHER" and not details:
            raise ValueError("Précisez le lien lorsque le type est OTHER.")
        if self.relationship_type != "OTHER" and details:
            raise ValueError("La précision du lien est réservée au type OTHER.")

        self.relationship_details = details
        return self
