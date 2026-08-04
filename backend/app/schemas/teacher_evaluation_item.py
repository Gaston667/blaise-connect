"""Contrat d'une évaluation affichée dans la fiche enseignant."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class TeacherEvaluationItem(BaseModel):
    """Évaluation créée dans une affectation de l'enseignant."""

    id: UUID
    title: str
    description: str | None
    subject_id: UUID
    subject_name: str
    class_id: UUID
    class_name: str
    assessment_date: date
    coefficient: Decimal
    maximum_score: Decimal
    enrolled_count: int
    grade_count: int
    official_average_on_20: Decimal | None
