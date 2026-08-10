"""Contrat de modification d'une matière."""

from pydantic import BaseModel, ConfigDict, Field


class SubjectUpdate(BaseModel):
    """Accepte les informations modifiables d'une matière."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    is_active: bool | None = None
    is_specialty: bool | None = None
