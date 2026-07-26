"""Contrat de lecture d'un profil enseignant."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TeacherResponse(BaseModel):
    """Expose les informations utiles d'un enseignant."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    first_name: str
    last_name: str
    birth_date: date | None
    gender: str | None
    email: str | None
    phone: str | None
    address: str | None
    hire_date: date
    qualification: str | None
    photo_path: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
