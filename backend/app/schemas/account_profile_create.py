"""Contrat des informations de profil créées avec un compte."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.phone_number import normalize_international_phone


class AccountProfileCreate(BaseModel):
    """Regroupe les champs communs et spécifiques aux quatre profils."""

    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    nationality: str = Field(min_length=1, max_length=100)
    address: str | None = None
    birth_place: str | None = Field(default=None, max_length=150)
    admission_date: date | None = None
    previous_establishment: str | None = Field(default=None, max_length=150)
    medical_condition: str | None = None
    is_enrolled_in_cned: bool = False
    hire_date: date | None = None
    qualification: str | None = None
    job_title: str | None = Field(default=None, max_length=100)
    occupation: str | None = Field(default=None, max_length=150)
    employer: str | None = Field(default=None, max_length=150)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: str | None) -> str | None:
        """Valide le téléphone lorsqu'il est renseigné."""

        return normalize_international_phone(phone)
