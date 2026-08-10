"""Contrat de suppression logique d'un incident d'assiduite."""

from pydantic import BaseModel, Field


class AttendanceRecordDelete(BaseModel):
    """Motif obligatoire de la suppression administrative."""

    change_reason: str = Field(min_length=3, max_length=500)
