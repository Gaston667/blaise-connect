"""Contrat de modification d'un profil enseignant."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class TeacherUpdate(BaseModel):
    """Accepte les coordonnées modifiables d'un enseignant."""

    model_config = ConfigDict(extra="forbid")

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    hire_date: date | None = None
    qualification: str | None = None
    photo_path: str | None = Field(default=None, max_length=500)
