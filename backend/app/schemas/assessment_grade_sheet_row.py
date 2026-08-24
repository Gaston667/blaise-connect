"""Contrat d'une ligne de feuille de notes."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class AssessmentGradeSheetRow(BaseModel):
    """Inscription attendue et éventuel résultat déjà enregistré."""

    student_enrollment_id: UUID
    student_id: UUID
    registration_number: str
    student_name: str
    grade_id: UUID | None
    result_type: str | None
    score: Decimal | None
    normalized_score_on_20: Decimal | None
    comment: str | None
    justification_status: str | None
    reviewed_by_account_id: UUID | None
    reviewed_at: datetime | None
    created_at: datetime | None
    updated_at: datetime | None
