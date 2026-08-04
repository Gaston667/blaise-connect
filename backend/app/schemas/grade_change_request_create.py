"""Contrat de demande de correction d'une note."""

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class GradeChangeRequestCreate(BaseModel):
    """Nouvelle valeur proposée sans modifier directement la note."""

    grade_id: UUID
    proposed_result_type: Literal["SCORED", "ABSENT"]
    proposed_score: Decimal | None = Field(default=None, ge=0)
    proposed_justification_status: Literal[
        "UNJUSTIFIED",
        "PENDING",
        "JUSTIFIED",
        "REJECTED",
    ] | None = None
    request_reason: str = Field(min_length=3, max_length=2000)

    @model_validator(mode="after")
    def validate_proposal(self) -> "GradeChangeRequestCreate":
        """Garantit la cohérence de la valeur proposée."""

        if self.proposed_result_type == "SCORED":
            if self.proposed_score is None:
                raise ValueError("La nouvelle note est obligatoire.")
            if self.proposed_justification_status is not None:
                raise ValueError("Une note chiffrée ne possède pas de justificatif.")
        else:
            if self.proposed_score is not None:
                raise ValueError("Une absence ne possède pas de note chiffrée.")
            if self.proposed_justification_status is None:
                self.proposed_justification_status = "UNJUSTIFIED"
        self.request_reason = self.request_reason.strip()
        return self
