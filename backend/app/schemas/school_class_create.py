"""Contrat de création d'une classe annuelle."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SchoolClassCreate(BaseModel):
    """Valide les colonnes saisissables de la table ``classes``."""

    model_config = ConfigDict(extra="forbid")

    school_year_id: UUID
    class_level_id: UUID
    main_teacher_id: UUID
    group_label: str = Field(min_length=1, max_length=30)
    capacity: int | None = Field(default=None, gt=0, le=32767)

    @field_validator("group_label")
    @classmethod
    def normalize_group_label(cls, value: str) -> str:
        """Retire les espaces et convertit le groupe en majuscules."""

        normalized_value = value.strip().upper()
        if not normalized_value:
            raise ValueError("Le groupe de la classe ne peut pas être vide.")
        return normalized_value
