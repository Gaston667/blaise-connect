"""Schéma Pydantic du compte actuellement connecté."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.account_role import AccountRole
from app.schemas.registration_number import RegistrationNumber


class CurrentAccountResponse(BaseModel):
    """Informations non sensibles du compte connecté."""

    # Autorise la conversion d'un modèle SQLAlchemy Account.
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    registration_number: RegistrationNumber
    role: AccountRole
    is_active: bool
    locked_until: datetime | None
    last_login_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
