"""Contrat de modification d'une classe."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic import field_validator


class SchoolClassUpdate(BaseModel):
    """Accepte uniquement les colonnes modifiables de la table ``classes``."""

    model_config = ConfigDict(extra="forbid")

    class_level_id: UUID | None = None
    main_teacher_id: UUID | None = None
    group_label: str | None = Field(default=None, min_length=1, max_length=30)
    capacity: int | None = Field(default=None, gt=0, le=32767)

    @field_validator("group_label")
    @classmethod
    def normalize_group_label(cls, value: str | None) -> str | None:
        """Normalise le groupe lorsqu'il est fourni."""

        if value is None:
            return None
        normalized_value = value.strip().upper()
        if not normalized_value:
            raise ValueError("Le groupe de la classe ne peut pas être vide.")
        return normalized_value
