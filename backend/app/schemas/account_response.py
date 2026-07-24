"""Schéma Pydantic de lecture d'un compte."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.account_role import AccountRole
from app.schemas.registration_number import RegistrationNumber


class AccountResponse(BaseModel):
    """Informations d'un compte pouvant être retournées par l'API."""

    # Autorise la conversion d'un modèle SQLAlchemy Account.
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    registration_number: RegistrationNumber
    role: AccountRole
    is_active: bool
    archived_at: datetime | None
