"""Schéma Pydantic de modification d'un compte."""

from typing import Self

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator


class AccountUpdate(BaseModel):
    """Données qu'un administrateur peut modifier sur un compte."""

    model_config = ConfigDict(extra="forbid")

    # Le matricule et le rôle sont absents car ils sont immuables.
    password: SecretStr | None = Field(default=None, min_length=1)
    is_active: bool | None = None

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> Self:
        """Refuse une requête ne contenant aucun changement."""

        if self.password is None and self.is_active is None:
            raise ValueError("Au moins un champ doit être fourni pour modifier le compte.")

        return self
