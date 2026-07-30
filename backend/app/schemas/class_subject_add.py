"""Corps de la requête d'ajout d'une matière à une classe."""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ClassSubjectAdd(BaseModel):
    subject_id: UUID
    coefficient: Decimal = Field(gt=0, decimal_places=2)
