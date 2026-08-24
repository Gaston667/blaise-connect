"""Contrat de création d'un cours manuel à une date précise."""

from datetime import date, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TimetableDateSlotCreate(BaseModel):
    """Valide un cours ponctuel ajouté au brouillon d'une classe."""

    model_config = ConfigDict(extra="forbid")

    class_subject_id: UUID
    course_date: date
    start_time: time
    end_time: time
    room_id: UUID | None = None
