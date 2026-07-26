"""Contrat de lecture d'une association classe-matière."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ClassSubjectResponse(BaseModel):
    """Expose une matière associée à une classe."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    school_class_id: UUID
    subject_id: UUID
    coefficient: Decimal
    created_at: datetime
    updated_at: datetime
