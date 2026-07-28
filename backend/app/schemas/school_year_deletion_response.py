"""Réponse d'une suppression d'année scolaire."""

from pydantic import BaseModel


class SchoolYearDeletionResponse(BaseModel):
    """Confirme la suppression et expose les nombres de lignes supprimées."""

    message: str
    deleted_counts: dict[str, int]
