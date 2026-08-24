"""Contrat de génération d'une proposition d'emploi du temps."""

from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.weekly_subject_requirement_upsert import (
    WeeklySubjectRequirementUpsert,
)


class TimetableGenerationRequest(BaseModel):
    """Besoins à enregistrer avant de produire un brouillon."""

    model_config = ConfigDict(extra="forbid")

    requirements: list[WeeklySubjectRequirementUpsert]
    target_start_date: date
    target_end_date: date

    @model_validator(mode="after")
    def validate_target_dates(self) -> "TimetableGenerationRequest":
        """Refuse une plage dont la fin précède le début."""

        if self.target_end_date < self.target_start_date:
            raise ValueError(
                "La date de fin de génération doit être postérieure ou égale à la date de début."
            )
        return self
