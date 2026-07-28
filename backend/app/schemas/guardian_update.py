"""Contrat de mise à jour d'un responsable légal."""
from pydantic import BaseModel


class GuardianUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    occupation: str | None = None
    employer: str | None = None


class GuardianLinkUpdate(BaseModel):
    """Mise à jour du lien élève-responsable (pas du responsable lui-même)."""
    relationship: str | None = None
    is_primary_contact: bool | None = None