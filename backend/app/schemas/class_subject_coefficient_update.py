"""Corps de la requête de modification du coefficient d'une matière de classe."""

from decimal import Decimal

from pydantic import BaseModel, Field


class ClassSubjectCoefficientUpdate(BaseModel):
    coefficient: Decimal = Field(gt=0, decimal_places=2)
