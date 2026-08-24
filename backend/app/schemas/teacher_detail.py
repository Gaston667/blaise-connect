"""Contrat de lecture détaillée d'un enseignant."""
from datetime import date, datetime
from pydantic import BaseModel
from app.schemas.teacher_evaluation_item import TeacherEvaluationItem
from app.schemas.teacher_evaluation_summary import TeacherEvaluationSummary


class TeacherClassSummary(BaseModel):
    """Résumé d'une classe dans laquelle intervient l'enseignant."""

    id: str
    name: str
    level_name: str
    group_label: str
    school_year_name: str
    role_label: str
    student_count: int
    capacity: int | None
    is_main_teacher: bool


class TeacherSubjectSummary(BaseModel):
    """Résumé d'une affectation active à une matière de classe."""

    id: str
    class_subject_id: str
    class_id: str
    subject_name: str
    class_name: str
    level_name: str
    school_year_name: str
    school_year_end_date: date
    coefficient: float
    start_date: date
    end_date: date | None


class TeacherDetail(BaseModel):
    """Vue complète utilisée par la fiche enseignant."""

    id: str
    account_id: str
    registration_number: str
    first_name: str
    last_name: str
    birth_date: date | None
    gender: str | None
    nationality: str | None
    email: str | None
    phone: str | None
    address: str | None
    hire_date: date
    qualification: str | None
    photo_path: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    status: str
    subjects: list[str]
    classes: list[TeacherClassSummary]
    taught_subjects: list[TeacherSubjectSummary]
    total_students: int
    evaluations: list[TeacherEvaluationItem]
    evaluation_summary: TeacherEvaluationSummary
