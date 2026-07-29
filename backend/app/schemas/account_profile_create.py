"""Contrat des informations de profil créées avec un compte."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class AccountProfileCreate(BaseModel):
    """Regroupe les champs communs et spécifiques aux quatre profils."""

    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    birth_date: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = None
    admission_date: date | None = None
    hire_date: date | None = None
    qualification: str | None = None
    job_title: str | None = Field(default=None, max_length=100)
    occupation: str | None = Field(default=None, max_length=150)
    employer: str | None = Field(default=None, max_length=150)
