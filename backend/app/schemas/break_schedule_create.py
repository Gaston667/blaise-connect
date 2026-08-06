"""Contrat de création d'une pause scolaire."""

from datetime import time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BreakScheduleCreate(BaseModel):
    """Pause rattachée à une journée scolaire configurée."""

    model_config = ConfigDict(extra="forbid")

    school_day_schedule_id: UUID
    label: str = Field(min_length=1, max_length=100)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_time_order(self) -> "BreakScheduleCreate":
        """Refuse une pause dont la fin précède le début."""

        if self.end_time <= self.start_time:
            raise ValueError("L'heure de fin doit être après l'heure de début.")
        return self
