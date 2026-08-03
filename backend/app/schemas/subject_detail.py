"""Contrat de la fiche détaillée d'une matière."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.subject_class_detail import SubjectClassDetail


class SubjectDetail(BaseModel):
    """Expose une matière, ses classes et ses futures performances."""

    id: UUID
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    class_count: int
    teacher_count: int
    best_establishment_average: float | None
    best_establishment_student_id: UUID | None
    best_establishment_student_name: str | None
    classes: list[SubjectClassDetail]
