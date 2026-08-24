"""Contrat de création d'une évaluation."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class AssessmentCreate(BaseModel):
    """Données nécessaires à la création d'une évaluation."""

    teacher_assignment_id: UUID
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    assessment_date: date
    maximum_score: Decimal = Field(gt=0, max_digits=6, decimal_places=2)
    coefficient: Decimal = Field(gt=0, max_digits=6, decimal_places=2)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        """Retire les espaces inutiles du titre."""

        return value.strip()

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        """Transforme une description vide en valeur absente."""

        if value is None:
            return None
        normalized = value.strip()
        return normalized or None
