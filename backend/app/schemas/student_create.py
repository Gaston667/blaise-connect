"""Contrat de création d'un élève (compte + profil + inscription optionnelle)."""
from datetime import date
from pydantic import BaseModel, Field, SecretStr


class StudentCreate(BaseModel):
    """Données nécessaires pour créer un élève complet."""

    registration_number: str = Field(..., min_length=7, max_length=7, pattern=r"^[aeup][0-9]{6}$")
    password: SecretStr = Field(..., min_length=8, max_length=128)

    first_name: str
    last_name: str
    birth_date: date | None = None
    gender: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    admission_date: date

    class_id: str | None = None
    enrollment_start_date: date | None = None