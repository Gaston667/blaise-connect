"""Contrat de génération des emplois du temps de toutes les classes."""

from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator


class TimetableGenerateAllRequest(BaseModel):
    """Plage facultative : sans dates, toute l'année scolaire courante est couverte."""

    model_config = ConfigDict(extra="forbid")

    target_start_date: date | None = None
    target_end_date: date | None = None

    @model_validator(mode="after")
    def validate_target_dates(self) -> "TimetableGenerateAllRequest":
        """Refuse une plage dont la fin précède le début, ou à moitié renseignée."""

        if (self.target_start_date is None) != (self.target_end_date is None):
            raise ValueError("Renseignez les deux dates, ou aucune.")
        if (
            self.target_start_date is not None
            and self.target_end_date < self.target_start_date
        ):
            raise ValueError(
                "La date de fin de génération doit être postérieure ou égale à la date de début."
            )
        return self
