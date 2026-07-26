"""Contrat de création d'un profil enseignant."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TeacherCreate(BaseModel):
    """Valide les données initiales d'un enseignant."""

    model_config = ConfigDict(extra="forbid")

    account_id: UUID
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    hire_date: date
    qualification: str | None = None
    photo_path: str | None = Field(default=None, max_length=500)
