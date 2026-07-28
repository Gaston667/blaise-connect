"""Résumé des données supprimées avec une année scolaire."""

from uuid import UUID

from pydantic import BaseModel


class SchoolYearDeletionPreview(BaseModel):
    """Comptages présentés avant la confirmation définitive."""

    school_year_id: UUID
    school_year_name: str
    reporting_periods: int
    classes: int
    student_enrollments: int
    class_subjects: int
