"""Contrat de mise à jour d'un responsable légal."""

from pydantic import BaseModel, field_validator

from app.schemas.phone_number import normalize_international_phone


class GuardianUpdate(BaseModel):
    """Informations personnelles modifiables du responsable."""

    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    nationality: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    occupation: str | None = None
    employer: str | None = None
    photo_path: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, phone: str | None) -> str | None:
        """Valide le téléphone lorsqu'il est renseigné."""

        return normalize_international_phone(phone)
