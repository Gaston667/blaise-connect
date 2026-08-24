"""Contrat de lecture d'une note pour l'élève qui la consulte."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class StudentGradeItem(BaseModel):
    id: UUID
    assessment_id: UUID
    assessment_title: str
    subject_id: UUID
    subject_name: str
    reporting_period_name: str | None
    result_type: str
    score: Decimal | None
    maximum_score: Decimal
    coefficient: Decimal
    assessment_date: date
    comment: str | None
    justification_status: str | None
    created_at: datetime
