"""Contrats des vacances scolaires d'une année."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SchoolHolidayCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    start_date: date
    end_date: date

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le nom des vacances est obligatoire.")
        return cleaned


class SchoolHolidayUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le nom des vacances est obligatoire.")
        return cleaned


class SchoolHolidayResponse(BaseModel):
    id: UUID
    school_year_id: UUID
    name: str
    start_date: date
    end_date: date
