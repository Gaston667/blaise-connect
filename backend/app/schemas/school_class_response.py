"""Contrat de lecture d'une classe."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SchoolClassResponse(BaseModel):
    """Expose les colonnes de la table ``classes``."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    school_year_id: UUID
    class_level_id: UUID
    main_teacher_id: UUID
    group_label: str
    capacity: int | None
    created_at: datetime
    updated_at: datetime
