"""Contrat d'une année dans l'historique scolaire d'un élève."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class StudentAcademicHistoryItem(BaseModel):
    """Inscription historique accompagnée de sa moyenne calculée."""

    enrollment_id: UUID
    class_id: UUID
    class_name: str
    school_year_id: UUID
    school_year_name: str
    start_date: date
    end_date: date | None
    end_reason: str | None
    general_average_on_20: Decimal | None
