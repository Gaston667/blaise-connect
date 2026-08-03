"""Option d'évaluation pour saisir une note."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class GradeAssessmentOption(BaseModel):
    """Évaluation existante autorisée pour le compte connecté."""

    id: UUID
    title: str
    assessment_date: date
    maximum_score: Decimal
    coefficient: Decimal
    class_id: UUID
    subject_id: UUID
    teacher_name: str
