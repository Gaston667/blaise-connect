"""Contrat de génération d'une proposition d'emploi du temps."""

from pydantic import BaseModel, ConfigDict

from app.schemas.weekly_subject_requirement_upsert import (
    WeeklySubjectRequirementUpsert,
)


class TimetableGenerationRequest(BaseModel):
    """Besoins à enregistrer avant de produire un brouillon."""

    model_config = ConfigDict(extra="forbid")

    requirements: list[WeeklySubjectRequirementUpsert]
