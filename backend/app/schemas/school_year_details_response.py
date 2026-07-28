"""Réponse complète d'une année scolaire et de ses périodes."""

from pydantic import BaseModel

from app.schemas.reporting_period_response import ReportingPeriodResponse
from app.schemas.school_year_response import SchoolYearResponse


class SchoolYearDetailsResponse(BaseModel):
    """Résultat d'une modification globale et atomique."""

    school_year: SchoolYearResponse
    periods: list[ReportingPeriodResponse]
