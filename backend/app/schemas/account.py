"""Schémas Pydantic de création, modification et lecture des comptes."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    SecretStr,
    model_validator,
)


# La Version 1 expose uniquement les comptes administrateur et enseignant.
AccountRole = Literal["ADMIN", "TEACHER"]


def normalize_registration_number(value: object) -> object:
    """Retire les espaces et convertit le matricule en minuscules."""

    if isinstance(value, str):
        return value.strip().lower()

    return value


# Un matricule commence par a, e, u ou p, puis contient exactement six chiffres.
RegistrationNumber = Annotated[
    str,
    Field(min_length=7, max_length=7, pattern=r"^[aeup][0-9]{6}$"),
    BeforeValidator(normalize_registration_number),
]


class AccountCreate(BaseModel):
    """Données acceptées lors de la création d'un compte."""

    # Empêche l'envoi de champs internes comme password_hash ou archived_at.
    model_config = ConfigDict(extra="forbid")

    registration_number: RegistrationNumber

    # L'API reçoit le mot de passe, puis le service devra le hacher immédiatement.
    password: SecretStr = Field(min_length=1)
    role: AccountRole


class AccountUpdate(BaseModel):
    """Données qu'un administrateur peut modifier sur un compte."""

    model_config = ConfigDict(extra="forbid")

    # Le matricule et le rôle sont volontairement absents car ils sont immuables.
    password: SecretStr | None = Field(default=None, min_length=1)
    is_active: bool | None = None

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> "AccountUpdate":
        """Refuse une requête de modification ne contenant aucun changement."""

        if self.password is None and self.is_active is None:
            raise ValueError("Au moins un champ doit être fourni pour modifier le compte.")

        return self


class AccountResponse(BaseModel):
    """Informations d'un compte pouvant être retournées par l'API."""

    # Autorise la conversion d'un objet SQLAlchemy Account en réponse Pydantic.
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    registration_number: RegistrationNumber
    role: AccountRole
    is_active: bool
    archived_at: datetime | None
