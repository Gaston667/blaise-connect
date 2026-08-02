"""Contrat de lecture détaillée d'un enseignant."""
from datetime import date, datetime
from pydantic import BaseModel


class TeacherClassSummary(BaseModel):
    id: str
    name: str
    level_name: str
    group_label: str
    school_year_name: str
    role_label: str
    student_count: int
    capacity: int | None


class TeacherSubjectSummary(BaseModel):
    id: str
    subject_name: str
    class_name: str
    level_name: str
    school_year_name: str
    coefficient: float


class TeacherDetail(BaseModel):
    id: str
    account_id: str
    registration_number: str
    first_name: str
    last_name: str
    birth_date: date | None
    gender: str | None
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