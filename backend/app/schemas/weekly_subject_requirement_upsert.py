"""Contrat du volume horaire hebdomadaire d'une matière."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WeeklySubjectRequirementUpsert(BaseModel):
    """Volume hebdomadaire d'une matière pour le niveau de la classe."""

    model_config = ConfigDict(extra="forbid")

    class_subject_id: UUID
    weekly_minutes: int = Field(ge=15, le=2400)
