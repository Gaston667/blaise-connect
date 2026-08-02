"""Contrat de lecture enrichi d'un enseignant pour l'écran de gestion."""
from datetime import date
from pydantic import BaseModel


class TeacherOverview(BaseModel):
    id: str
    registration_number: str
    first_name: str
    last_name: str
    gender: str | None
    email: str | None
    phone: str | None
    hire_date: date
    is_main_teacher: bool
    subjects: list[str]
    photo_path: str | None = None
    status: str