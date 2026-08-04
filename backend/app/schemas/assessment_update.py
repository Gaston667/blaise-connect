"""Contrat de modification d'une évaluation."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


class AssessmentUpdate(BaseModel):
    """Champs modifiables avant validation d'un bulletin."""

    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    assessment_date: date | None = None
    maximum_score: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=6,
        decimal_places=2,
    )
    coefficient: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=6,
        decimal_places=2,
    )

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        """Normalise le titre lorsqu'il est fourni."""

        return value.strip() if value is not None else None

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        """Transforme une description vide en valeur absente."""

        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def require_one_change(self) -> "AssessmentUpdate":
        """Refuse une requête de modification vide."""

        if not self.model_fields_set:
            raise ValueError("Au moins un champ doit être modifié.")
        return self
