"""Contrat de création d'une inscription annuelle d'élève."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class StudentEnrollmentCreate(BaseModel):
    """Données nécessaires pour inscrire un élève dans une classe."""

    class_id: UUID
    start_date: date
