"""Contrat d'une affectation proposée lors de la création d'une évaluation."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class AssessmentAssignmentOption(BaseModel):
    """Classe, matière et enseignant réunis dans une affectation."""

    id: UUID
    class_id: UUID
    class_name: str
    subject_id: UUID
    subject_name: str
    teacher_id: UUID
    teacher_name: str
    school_year_id: UUID
    school_year_name: str
    start_date: date
    end_date: date | None
