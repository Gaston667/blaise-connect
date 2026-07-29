"""Contrat de création atomique d'un compte et de son profil."""

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator

from app.schemas.account_creation_role import AccountCreationRole
from app.schemas.account_profile_create import AccountProfileCreate
from app.schemas.registration_number import RegistrationNumber


class AccountCompleteCreate(BaseModel):
    """Valide l'accès et les données métier exigées par le rôle."""

    model_config = ConfigDict(extra="forbid")

    registration_number: RegistrationNumber | None = None
    password: SecretStr = Field(min_length=8, max_length=128)
    role: AccountCreationRole
    profile: AccountProfileCreate

    @model_validator(mode="after")
    def validate_role_requirements(self) -> "AccountCompleteCreate":
        """Vérifie les champs obligatoires propres au profil choisi."""

        if self.role == "STUDENT" and self.profile.admission_date is None:
            raise ValueError("La date d'admission est obligatoire pour un élève.")
        if self.role in {"TEACHER", "ADMIN"} and self.profile.hire_date is None:
            raise ValueError("La date d'embauche est obligatoire pour ce rôle.")
        if self.role == "ADMIN" and not self.profile.job_title:
            raise ValueError("La fonction est obligatoire pour un administrateur.")
        if self.role == "GUARDIAN" and not self.profile.phone:
            raise ValueError("Le téléphone est obligatoire pour un responsable.")
        return self
