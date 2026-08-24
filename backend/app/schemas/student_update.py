"""Contrat de mise à jour du profil d'un élève."""
from datetime import date
from pydantic import BaseModel, field_validator

from app.schemas.phone_number import normalize_international_phone


class StudentUpdate(BaseModel):
    """Champs modifiables sur la fiche d'un élève."""
    first_name: str | None = None
    last_name: str | None = None
    birth_date: date | None = None
    birth_place: str | None = None
    gender: str | None = None
    nationality: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    previous_level: str | None = None
    previous_establishment: str | None = None
    medical_condition: str | None = None
    is_enrolled_in_cned: bool | None = None
    admission_date: date | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: str | None) -> str | None:
        """Valide le téléphone lorsqu'il est renseigné."""

        return normalize_international_phone(phone)
