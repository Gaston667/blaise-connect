"""Contrat de création d'une inscription annuelle d'élève."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class StudentEnrollmentCreate(BaseModel):
    """Données nécessaires pour inscrire un élève dans une classe."""

    class_id: UUID
    start_date: date
    specialty_subject_ids: list[UUID] = Field(default_factory=list)
