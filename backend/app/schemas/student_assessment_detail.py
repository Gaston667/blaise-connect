"""Contrat du détail d'une évaluation consulté par l'élève concerné."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class StudentAssessmentDetail(BaseModel):
    """Informations personnelles et statistiques anonymisées d'une évaluation."""

    assessment_id: UUID
    title: str
    description: str | None
    assessment_date: date
    subject_name: str
    class_name: str
    teacher_name: str | None
    maximum_score: Decimal
    coefficient: Decimal
    result_type: str
    score: Decimal | None
    comment: str | None
    justification_status: str | None
    highest_score: Decimal | None
    lowest_score: Decimal | None
    class_average: Decimal | None
    class_appreciation: str | None
    rank: int | None
    ranked_students_count: int
