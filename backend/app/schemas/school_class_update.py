"""Contrat de modification d'une classe."""

from pydantic import BaseModel, ConfigDict, Field


class SchoolClassUpdate(BaseModel):
    """Accepte uniquement les informations modifiables d'une classe."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=100)
    level: str | None = Field(default=None, min_length=1, max_length=50)
    is_active: bool | None = None
