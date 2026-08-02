"""Contrat d'une matière de classe disponible pour un enseignant."""

from datetime import date

from pydantic import BaseModel


class TeacherAssignmentOption(BaseModel):
    """Décrit une matière de classe et son éventuelle affectation active."""

    class_subject_id: str
    class_id: str
    class_name: str
    level_name: str
    school_year_name: str
    school_year_start_date: date
    school_year_end_date: date
    subject_name: str
    coefficient: float
    is_assigned: bool
    assigned_teacher_name: str | None
