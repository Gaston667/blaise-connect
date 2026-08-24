"""Contrat des calculs officiels d'une évaluation."""

from decimal import Decimal

from pydantic import BaseModel


class AssessmentStatistics(BaseModel):
    """Statistiques calculées exclusivement par le backend."""

    enrolled_count: int
    grade_count: int
    scored_count: int
    absent_count: int
    missing_count: int
    pending_absence_count: int
    official_average_on_20: Decimal | None
    highest_score_on_20: Decimal | None
    lowest_score_on_20: Decimal | None
    excellent_count: int
    good_count: int
    average_count: int
    weak_count: int
