"""Contrat de lecture d'une évaluation et de sa progression."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class AssessmentOverview(BaseModel):
    """Évaluation indépendante des notes déjà saisies."""

    id: UUID
    teacher_assignment_id: UUID
    title: str
    description: str | None
    assessment_date: date
    maximum_score: Decimal
    coefficient: Decimal
    class_id: UUID
    class_name: str
    school_year_id: UUID
    school_year_name: str
    subject_id: UUID
    subject_name: str
    teacher_id: UUID
    teacher_name: str
    reporting_period_id: UUID | None
    reporting_period_name: str | None
    enrolled_count: int
    grade_count: int
    scored_count: int
    absent_count: int
    pending_absence_count: int
    official_average_on_20: Decimal | None
    completion_status: Literal["EMPTY", "PARTIAL", "PENDING_REVIEW", "COMPLETE"]
    created_at: datetime
    updated_at: datetime
