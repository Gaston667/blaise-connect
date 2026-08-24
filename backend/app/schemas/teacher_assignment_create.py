"""Contrat de création d'une affectation pédagogique."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class TeacherAssignmentCreate(BaseModel):
    """Associe un enseignant à une matière déjà disponible dans une classe."""

    class_subject_id: UUID
    start_date: date
