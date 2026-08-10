"""Contrat de traitement administratif d'une correction."""

from typing import Literal

from pydantic import BaseModel, Field


class AttendanceChangeRequestReview(BaseModel):
    """Decision d'un administrateur sur une demande enseignante."""

    decision: Literal["APPROVED", "REJECTED"]
    review_comment: str | None = Field(default=None, max_length=500)
