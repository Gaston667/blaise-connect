"""Contrat de lecture d'une demande de correction."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class GradeChangeRequestResponse(BaseModel):
    """Demande enrichie du contexte scolaire concerné."""

    id: UUID
    grade_id: UUID
    assessment_id: UUID
    assessment_title: str
    student_name: str
    registration_number: str
    class_name: str
    subject_name: str
    can_review: bool
    requested_by_account_id: UUID
    requested_by_registration_number: str
    previous_result_type: str
    previous_score: Decimal | None
    previous_justification_status: str | None
    proposed_result_type: str
    proposed_score: Decimal | None
    proposed_justification_status: str | None
    request_reason: str
    status: str
    reviewed_by_account_id: UUID | None
    reviewed_at: datetime | None
    decision_comment: str | None
    created_at: datetime
    updated_at: datetime
