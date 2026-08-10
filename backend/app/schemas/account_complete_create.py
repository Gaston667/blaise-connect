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

        required_common_fields = {
            "gender": self.profile.gender,
            "address": self.profile.address,
        }
        if self.role not in {"STUDENT", "GUARDIAN"}:
            required_common_fields["email"] = self.profile.email
        if self.role != "STUDENT":
            required_common_fields["phone"] = self.profile.phone
        missing_common_fields = [
            field_name
            for field_name, field_value in required_common_fields.items()
            if field_value is None or not str(field_value).strip()
        ]
        if missing_common_fields:
            raise ValueError(
                "Le sexe, l'adresse et les coordonnées requises pour ce rôle sont obligatoires."
            )
        if self.role in {"STUDENT", "TEACHER"} and self.profile.birth_date is None:
            raise ValueError("La date de naissance est obligatoire pour ce rôle.")
        if self.role == "STUDENT" and self.profile.admission_date is None:
            raise ValueError("La date d'admission est obligatoire pour un élève.")
        if self.role in {"TEACHER", "ADMIN"} and self.profile.hire_date is None:
            raise ValueError("La date d'embauche est obligatoire pour ce rôle.")
        if self.role == "TEACHER" and not self.profile.qualification:
            raise ValueError("La qualification est obligatoire pour un enseignant.")
        if self.role == "ADMIN" and not self.profile.job_title:
            raise ValueError("La fonction est obligatoire pour un administrateur.")
        if self.role == "GUARDIAN" and (
            not self.profile.occupation or not self.profile.employer
        ):
            raise ValueError(
                "La profession et l'employeur sont obligatoires pour un responsable."
            )
        return self
