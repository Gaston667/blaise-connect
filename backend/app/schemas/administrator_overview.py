"""Contrat de lecture enrichi d'un administrateur pour l'écran de gestion."""
from datetime import date
from pydantic import BaseModel


class AdministratorOverview(BaseModel):
    id: str
    registration_number: str
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    hire_date: date
    job_title: str
    photo_path: str | None = None
    status: str
