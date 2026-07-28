"""Contrat de lecture d'un profil enseignant."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TeacherResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    hire_date: date