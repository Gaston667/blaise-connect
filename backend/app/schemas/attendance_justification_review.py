"""Contrat de validation d'un justificatif d'assiduite."""

from typing import Literal

from pydantic import BaseModel, Field


class AttendanceJustificationReview(BaseModel):
    """Decision administrative sur le justificatif d'un eleve."""

    status: Literal["JUSTIFIED", "REJECTED"]
    review_comment: str | None = Field(default=None, max_length=500)
