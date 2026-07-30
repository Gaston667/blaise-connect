"""Contrat de mise à jour d'un responsable légal."""

from pydantic import BaseModel


class GuardianUpdate(BaseModel):
    """Informations personnelles modifiables du responsable."""

    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    occupation: str | None = None
    employer: str | None = None
    photo_path: str | None = None
