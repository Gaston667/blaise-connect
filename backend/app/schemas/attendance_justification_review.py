"""Contrat de validation d'un justificatif d'assiduite."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AttendanceJustificationReview(BaseModel):
    """Decision administrative sur le justificatif d'un eleve."""

    status: Literal["JUSTIFIED", "REJECTED"]
    review_comment: str | None = Field(default=None, max_length=500)

    @field_validator("review_comment")
    @classmethod
    def validate_comment(cls, value: str | None) -> str | None:
        """Un commentaire vide est ignoré ; sinon il doit être assez explicite (règle de la base)."""

        if value is None or not value.strip():
            return None
        if len(value.strip()) < 3:
            raise ValueError("Le commentaire doit contenir au moins 3 caractères.")
        return value.strip()
