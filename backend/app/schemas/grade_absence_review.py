"""Contrat de validation d'un justificatif d'absence à une évaluation."""

from typing import Literal

from pydantic import BaseModel


class GradeAbsenceReview(BaseModel):
    """Décision finale prise par un administrateur."""

    justification_status: Literal["JUSTIFIED", "REJECTED"]
