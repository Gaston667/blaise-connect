"""Contrat de création d'un créneau d'emploi du temps."""

from datetime import time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TimetableSlotCreate(BaseModel):
    """Valide les informations d'un nouveau créneau."""

    model_config = ConfigDict(extra="forbid")

    class_subject_id: UUID
    day_of_week: int = Field(ge=1, le=7)
    start_time: time
    end_time: time
    room_id: UUID | None = None
