"""Contrat de réinitialisation administrative d'un mot de passe."""

from pydantic import BaseModel, ConfigDict, Field, SecretStr


class AccountPasswordReset(BaseModel):
    """Nouveau mot de passe et confirmation d'identité de l'administrateur."""

    model_config = ConfigDict(extra="forbid")

    new_password: SecretStr = Field(min_length=8, max_length=128)
    admin_password: SecretStr = Field(min_length=1, max_length=128)
