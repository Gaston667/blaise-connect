"""Contrat de la feuille collective d'une évaluation."""

from pydantic import BaseModel

from app.schemas.assessment_grade_sheet_row import AssessmentGradeSheetRow
from app.schemas.assessment_overview import AssessmentOverview
from app.schemas.assessment_statistics import AssessmentStatistics


class AssessmentGradeSheetResponse(BaseModel):
    """Évaluation, inscrits attendus et statistiques officielles."""

    assessment: AssessmentOverview
    rows: list[AssessmentGradeSheetRow]
    statistics: AssessmentStatistics
