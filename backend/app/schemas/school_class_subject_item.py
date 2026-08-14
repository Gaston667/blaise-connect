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
    is_specialty: bool
    teacher_id: UUID | None = None
    teacher_name: str | None = None
    teacher_qualification: str | None = None
