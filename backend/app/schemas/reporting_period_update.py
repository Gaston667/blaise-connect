"""Schéma de modification d'une période de bulletin."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReportingPeriodUpdate(BaseModel):
    """Données modifiables d'une période non verrouillée."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    end_date: date

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Supprime les espaces inutiles autour du nom."""

        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("Le nom de la période ne peut pas être vide.")
        return stripped_value
