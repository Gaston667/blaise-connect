"""Contrat de modification d'un profil administrateur."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.phone_number import normalize_international_phone


class AdministratorUpdate(BaseModel):
    """Accepte les coordonnées et le rôle modifiables d'un administrateur."""

    model_config = ConfigDict(extra="forbid")

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    gender: str | None = Field(default=None, max_length=20)
    nationality: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    job_title: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: str | None) -> str | None:
        """Valide le téléphone lorsqu'il est renseigné."""

        return normalize_international_phone(phone)
