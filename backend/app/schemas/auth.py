"""Schémas Pydantic des requêtes et réponses d'authentification."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr

from app.schemas.account import AccountRole, RegistrationNumber


class LoginRequest(BaseModel):
    """Données envoyées par l'utilisateur pour se connecter."""

    # Refuse tout champ inattendu, par exemple password_hash ou role.
    model_config = ConfigDict(extra="forbid")

    registration_number: RegistrationNumber

    # SecretStr masque le mot de passe dans les affichages et les journaux Pydantic.
    password: SecretStr = Field(min_length=1)


class LoginResponse(BaseModel):
    """Jeton renvoyé après une authentification réussie."""

    access_token: str = Field(min_length=1)
    token_type: Literal["bearer"] = "bearer"


class CurrentAccountResponse(BaseModel):
    """Informations non sensibles du compte actuellement connecté."""

    # Autorise Pydantic à lire directement les attributs d'un modèle SQLAlchemy.
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
