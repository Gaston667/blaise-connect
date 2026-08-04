"""Contrat de la scolarité calculée d'un élève."""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.student_academic_history_item import StudentAcademicHistoryItem
from app.schemas.student_subject_average import StudentSubjectAverage


class StudentAcademicSummary(BaseModel):
    """Indicateurs officiels de l'inscription scolaire courante."""

    student_id: UUID
    current_enrollment_id: UUID | None
    absence_count: int
    late_count: int
    scored_assessment_count: int
    pending_absence_count: int
    general_average_on_20: Decimal | None
    subject_averages: list[StudentSubjectAverage]
    history: list[StudentAcademicHistoryItem]
