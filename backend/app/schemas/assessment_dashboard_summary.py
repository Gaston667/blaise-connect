"""Contrat du résumé global de l'écran Notes."""

from decimal import Decimal

from pydantic import BaseModel


class AssessmentDashboardSummary(BaseModel):
    """Indicateurs officiels calculés par le backend."""

    assessments_count: int
    students_count: int
    expected_grade_count: int
    grade_count: int
    scored_count: int
    absence_count: int
    missing_count: int
    official_average_on_20: Decimal | None
    excellent_count: int
    good_count: int
    average_count: int
    weak_count: int
