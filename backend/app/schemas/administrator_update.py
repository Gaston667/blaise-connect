"""Contrat de modification d'un profil administrateur."""

from pydantic import BaseModel, ConfigDict, Field


class AdministratorUpdate(BaseModel):
    """Accepte les coordonnées et le rôle modifiables d'un administrateur."""

    model_config = ConfigDict(extra="forbid")

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    gender: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    job_title: str | None = Field(default=None, min_length=1, max_length=100)
