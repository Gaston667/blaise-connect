"""Contrat de création d'une matière."""

from pydantic import BaseModel, ConfigDict, Field


class SubjectCreate(BaseModel):
    """Valide les informations d'une nouvelle matière."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    is_specialty: bool = False
