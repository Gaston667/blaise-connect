"""Contrat de création d'une note."""

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class GradeCreate(BaseModel):
    """Résultat d'un élève pour une évaluation existante."""

    assessment_id: UUID
    student_enrollment_id: UUID
    result_type: Literal["SCORED", "ABSENT"] = "SCORED"
    score: Decimal | None = Field(default=None, ge=0)
    comment: str | None = Field(default=None, max_length=2000)
    justification_status: Literal["UNJUSTIFIED", "PENDING"] | None = None

    @model_validator(mode="after")
    def validate_result(self) -> "GradeCreate":
        """Vérifie la cohérence entre résultat, valeur et absence."""

        if self.result_type == "SCORED":
            if self.score is None:
                raise ValueError("La note est obligatoire pour un résultat noté.")
            if self.justification_status is not None:
                raise ValueError("Une note chiffrée ne possède pas de justificatif d'absence.")
        elif self.score is not None:
            raise ValueError("Une absence ne possède pas de note chiffrée.")

        return self
