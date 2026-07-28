"""Contrat des informations non sensibles liées à un compte."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AccountProfileResponse(BaseModel):
    """Regroupe les champs communs et professionnels d'un profil."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    gender: str | None = None
    birth_date: date | None = None
    birth_place: str | None = None
    nationality: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    hire_date: date | None = None
    admission_date: date | None = None
    qualification: str | None = None
    job_title: str | None = None
    occupation: str | None = None
    employer: str | None = None
    photo_path: str | None = None
    status: str | None = None
    archived_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
