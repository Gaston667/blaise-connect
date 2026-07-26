"""Contrat de création d'une période scolaire."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class SchoolPeriodCreate(BaseModel):
    """Valide une période sans imposer trimestre ou semestre."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    end_date: date
