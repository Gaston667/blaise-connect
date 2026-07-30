"""Contrat de mise à jour du profil d'un élève."""
from datetime import date
from pydantic import BaseModel


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
    admission_date: date | None = None
