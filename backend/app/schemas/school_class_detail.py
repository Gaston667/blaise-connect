"""Contrat de lecture détaillée d'une classe."""
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel


class SchoolClassDetail(BaseModel):
    id: UUID
    school_year_id: UUID
    class_level_id: UUID
    main_teacher_id: UUID
    group_label: str
    capacity: int | None
    observations: str | None
    created_at: datetime
    updated_at: datetime
    level_name: str
    school_year_name: str
    school_year_start: date
    school_year_end: date
    teacher_first_name: str
    teacher_last_name: str
    teacher_email: str | None
    teacher_phone: str | None
    status: str
    student_count: int
    subject_count: int