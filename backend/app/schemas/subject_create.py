"""Contrat de création d'une matière."""

from pydantic import BaseModel, ConfigDict, Field


class SubjectCreate(BaseModel):
    """Valide le nom d'une nouvelle matière."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
