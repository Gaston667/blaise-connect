"""Contrat d'association d'une matière à une classe."""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ClassSubjectCreate(BaseModel):
    """Valide une association et un coefficient strictement positif."""

    model_config = ConfigDict(extra="forbid")

    school_class_id: UUID
    subject_id: UUID
    coefficient: Decimal = Field(gt=0)
