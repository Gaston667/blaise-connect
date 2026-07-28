"""Contrat de lecture enrichi d'une classe pour l'écran de gestion."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class SchoolClassOverview(BaseModel):
    id: UUID
    school_year_id: UUID
    class_level_id: UUID
    main_teacher_id: UUID
    group_label: str
    capacity: int | None
    created_at: datetime
    updated_at: datetime
    level_name: str
    school_year_name: str
    teacher_name: str
    status: str
    student_count: int

    