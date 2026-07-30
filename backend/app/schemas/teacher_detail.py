"""Contrat de lecture détaillée d'un enseignant."""
from datetime import date
from pydantic import BaseModel


class TeacherClassSummary(BaseModel):
    id: str
    name: str
    school_year_name: str
    student_count: int


class TeacherDetail(BaseModel):
    id: str
    registration_number: str
    first_name: str
    last_name: str
    email: str | None
    phone: str | None
    address: str | None
    hire_date: date
    qualification: str | None
    photo_path: str | None
    status: str
    subjects: list[str]
    classes: list[TeacherClassSummary]
    total_students: int