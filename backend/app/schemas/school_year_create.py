"""Schéma Pydantic de création d'une année scolaire."""

from datetime import date

from pydantic import BaseModel, Field, field_validator


class SchoolYearCreate(BaseModel):
    """Données nécessaires à la création d'une année scolaire.

    `is_current`, `closed_at` et `closed_by_account_id` ne sont pas
    saisissables à la création : une année démarre toujours ouverte
    et non courante par défaut (l'administrateur la définit comme
    courante via une action dédiée).
    """

    name: str = Field(min_length=1, max_length=20)
    start_date: date
    end_date: date

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Retire les espaces superflus, comme l'exige la contrainte SQL."""
        stripped = value.strip()
        if not stripped:
            raise ValueError("Le nom de l'année scolaire ne peut pas être vide.")
        return stripped

    @field_validator("end_date")
    @classmethod
    def check_end_after_start(cls, end_date: date, info) -> date:
        """Réplique côté API la contrainte ck_school_years_dates."""
        start_date = info.data.get("start_date")
        if start_date is not None and end_date <= start_date:
            raise ValueError("La date de fin doit être postérieure à la date de début.")
        return end_date