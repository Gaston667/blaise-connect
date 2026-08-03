"""Contrat de lecture enrichie d'une note."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class GradeOverview(BaseModel):
    """Note accompagnée de son élève, sa classe et son évaluation."""

    id: UUID
    assessment_id: UUID
    assessment_title: str
    student_enrollment_id: UUID
    student_id: UUID
    registration_number: str
    student_name: str
    class_id: UUID
    class_name: str
    subject_id: UUID
    subject_name: str
    reporting_period_id: UUID | None
    reporting_period_name: str | None
    result_type: str
    score: Decimal | None
    maximum_score: Decimal
    coefficient: Decimal
    assessment_date: date
    comment: str | None
    justification_status: str | None
    created_at: datetime
