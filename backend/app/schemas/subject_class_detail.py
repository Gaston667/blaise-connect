"""Contrat d'une matière configurée dans une classe."""

from uuid import UUID

from pydantic import BaseModel


class SubjectClassDetail(BaseModel):
    """Expose la configuration et la performance d'une matière par classe."""

    class_id: UUID
    class_name: str
    level_name: str
    school_year_name: str
    coefficient: float
    teacher_id: UUID | None
    teacher_name: str | None
    best_average: float | None
    best_student_id: UUID | None
    best_student_name: str | None
