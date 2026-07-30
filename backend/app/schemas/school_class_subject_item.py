"""Contrat de lecture d'une matière associée à une classe."""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class SchoolClassSubjectItem(BaseModel):
    """Expose les informations utiles dans l'onglet matières d'une classe."""

    id: UUID
    subject_id: UUID
    name: str
    coefficient: Decimal
    is_active: bool
    teacher_name: str | None = None
