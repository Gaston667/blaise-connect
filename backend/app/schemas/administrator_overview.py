"""Contrat de lecture enrichi d'un administrateur pour l'écran de gestion."""
from datetime import date, datetime
from pydantic import BaseModel


class AdministratorOverview(BaseModel):
    id: str
    registration_number: str
    first_name: str
    last_name: str
    gender: str | None
    email: str | None
    phone: str | None
    address: str | None
    hire_date: date
    job_title: str
    photo_path: str | None = None
    status: str
    account_created_at: datetime
    last_login_at: datetime | None
