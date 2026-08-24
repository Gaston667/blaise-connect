"""Contrat de modification d'un profil enseignant."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.phone_number import normalize_international_phone


class TeacherUpdate(BaseModel):
    """Accepte les coordonnées modifiables d'un enseignant."""

    model_config = ConfigDict(extra="forbid")

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    nationality: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    hire_date: date | None = None
    qualification: str | None = None
    photo_path: str | None = Field(default=None, max_length=500)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: str | None) -> str | None:
        """Valide le téléphone lorsqu'il est renseigné."""

        return normalize_international_phone(phone)
