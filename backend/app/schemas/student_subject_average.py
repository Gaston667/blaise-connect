"""Contrat d'une moyenne officielle par matière."""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class StudentSubjectAverage(BaseModel):
    """Moyenne calculée depuis les notes sources d'une inscription."""

    subject_id: UUID
    subject_name: str
    class_subject_id: UUID
    class_coefficient: Decimal
    assessment_count: int
    pending_absence_count: int
    average_on_20: Decimal | None
