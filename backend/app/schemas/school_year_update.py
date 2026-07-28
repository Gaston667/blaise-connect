"""Schéma Pydantic de modification d'une année scolaire."""

from datetime import date

from pydantic import BaseModel, Field, field_validator


class SchoolYearUpdate(BaseModel):
    """Données modifiables d'une année scolaire non clôturée."""

    name: str = Field(min_length=1, max_length=20)
    start_date: date
    end_date: date

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        """Retire les espaces inutiles autour du nom."""

        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("Le nom de l'année scolaire ne peut pas être vide.")
        return stripped_value

    @field_validator("end_date")
    @classmethod
    def check_end_after_start(cls, end_date: date, info) -> date:
        """Vérifie que la fin est postérieure au début."""

        start_date = info.data.get("start_date")
        if start_date is not None and end_date <= start_date:
            raise ValueError("La date de fin doit être postérieure à la date de début.")
        return end_date
