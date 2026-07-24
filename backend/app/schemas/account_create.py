"""Schéma Pydantic de création d'un compte."""

from pydantic import BaseModel, ConfigDict, Field, SecretStr

from app.schemas.account_role import AccountRole
from app.schemas.registration_number import RegistrationNumber


class AccountCreate(BaseModel):
    """Données acceptées lors de la création d'un compte."""

    # Empêche l'envoi de champs internes comme password_hash ou archived_at.
    model_config = ConfigDict(extra="forbid")

    registration_number: RegistrationNumber

    # Le service devra hacher le mot de passe immédiatement.
    password: SecretStr = Field(min_length=1)
    role: AccountRole
