"""Contrat de configuration d'une journée scolaire."""

from datetime import time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.education_stage import EducationStage


class SchoolDayScheduleUpsert(BaseModel):
    """Horaire d'un jour pour un cycle scolaire."""

    model_config = ConfigDict(extra="forbid")

    education_stage: EducationStage
    day_of_week: int = Field(ge=1, le=7)
    course_start_time: time
    course_end_time: time
    lesson_duration_minutes: int = Field(default=60, ge=15, le=240)

    @model_validator(mode="after")
    def validate_time_order(self) -> "SchoolDayScheduleUpsert":
        """Refuse une journée dont la fin précède le début."""

        if self.course_end_time <= self.course_start_time:
            raise ValueError("L'heure de fin doit être après l'heure de début.")
        return self
