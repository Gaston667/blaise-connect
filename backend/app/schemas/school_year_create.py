"""Contrat de création d'une année scolaire."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SchoolYearCreate(BaseModel):
    """Valide les données nécessaires à une année scolaire."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=20)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self) -> "SchoolYearCreate":
        """Refuse une date de fin antérieure ou égale au début."""

        if self.end_date <= self.start_date:
            raise ValueError("La date de fin doit suivre la date de début.")
        return self
