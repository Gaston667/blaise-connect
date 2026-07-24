"""Schéma Pydantic de la requête de connexion."""

from pydantic import BaseModel, ConfigDict, Field, SecretStr

from app.schemas.registration_number import RegistrationNumber


class LoginRequest(BaseModel):
    """Données envoyées par l'utilisateur pour se connecter."""

    # Refuse les champs inattendus comme password_hash ou role.
    model_config = ConfigDict(extra="forbid")

    registration_number: RegistrationNumber
    password: SecretStr = Field(min_length=1)
