"""Contrat des listes nécessaires à l'écran de saisie des notes."""

from pydantic import BaseModel

from app.schemas.grade_assessment_option import GradeAssessmentOption
from app.schemas.grade_class_option import GradeClassOption
from app.schemas.grade_period_option import GradePeriodOption
from app.schemas.grade_student_option import GradeStudentOption
from app.schemas.grade_subject_option import GradeSubjectOption


class GradeOptionsResponse(BaseModel):
    """Regroupe filtres, évaluations et inscriptions autorisées."""

    classes: list[GradeClassOption]
    subjects: list[GradeSubjectOption]
    periods: list[GradePeriodOption]
    assessments: list[GradeAssessmentOption]
    students: list[GradeStudentOption]
