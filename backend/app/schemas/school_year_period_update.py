"""Contrat de modification d'une période dans le formulaire global."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SchoolYearPeriodUpdate(BaseModel):
    """Données manuellement modifiables d'une période existante."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str = Field(min_length=1, max_length=100)
    end_date: date

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Retire les espaces inutiles autour du nom."""

        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("Le nom de la période ne peut pas être vide.")
        return stripped_value
