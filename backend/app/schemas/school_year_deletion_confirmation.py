"""Contrat de confirmation d'une suppression destructive."""

from pydantic import BaseModel, ConfigDict, Field


class SchoolYearDeletionConfirmation(BaseModel):
    """Nom que l'administrateur doit recopier exactement."""

    model_config = ConfigDict(extra="forbid")

    confirmation_name: str = Field(min_length=1, max_length=20)
