"""Contrat de création d'un cours particulier."""

from datetime import time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SpecialCourseCreate(BaseModel):
    """Valide les informations d'un nouveau cours particulier."""

    model_config = ConfigDict(extra="forbid")

    student_id: UUID
    subject_id: UUID
    title: str = Field(min_length=1, max_length=150)
    day_of_week: int = Field(ge=1, le=7)
    start_time: time
    end_time: time
    note: str | None = None
