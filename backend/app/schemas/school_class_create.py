"""Contrat de création d'une classe."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SchoolClassCreate(BaseModel):
    """Valide les informations initiales d'une classe."""

    model_config = ConfigDict(extra="forbid")

    school_year_id: UUID
    name: str = Field(min_length=1, max_length=100)
    level: str = Field(min_length=1, max_length=50)
