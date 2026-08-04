"""Contrat de création d'une salle."""

from pydantic import BaseModel, ConfigDict, Field


class RoomCreate(BaseModel):
    """Valide les informations d'une nouvelle salle."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=50)
    capacity: int | None = Field(default=None, gt=0)
