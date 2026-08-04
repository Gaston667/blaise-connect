"""Contrat de synthèse des évaluations d'un enseignant."""

from pydantic import BaseModel


class TeacherEvaluationSummary(BaseModel):
    """Compteurs calculés côté backend pour la fiche enseignant."""

    assessment_count: int
    class_count: int
    subject_count: int
    expected_grade_count: int
    grade_count: int
