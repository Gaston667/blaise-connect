"""Schéma Pydantic de création d'une période de bulletin."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ReportingPeriodCreate(BaseModel):
    """Données saisies par l'administrateur pour créer une période."""

    school_year_id: UUID
    name: str = Field(min_length=1, max_length=100)
    end_date: date

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Retire les espaces superflus, comme l'exige la contrainte SQL."""
        stripped = value.strip()
        if not stripped:
            raise ValueError("Le nom de la période ne peut pas être vide.")
        return stripped