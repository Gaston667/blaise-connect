"""Contrat de lecture enrichi d'une matière pour l'écran de gestion."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class SubjectOverview(BaseModel):
    id: UUID
    name: str
    description: str | None
    is_active: bool
    coefficient: float | None
    teacher_count: int
    class_count: int
    created_at: datetime
    updated_at: datetime
