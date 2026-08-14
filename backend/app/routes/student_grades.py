"""Routes HTTP pour la consultation des notes par l'élève lui-même."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.authentication import DatabaseSession
from app.core.student_self import CurrentStudentDependency
from app.schemas.student_grade_item import StudentGradeItem
from app.schemas.student_assessment_detail import StudentAssessmentDetail
from app.schemas.student_grade_summary import StudentGradeSummary
from app.schemas.student_me_profile import StudentMeProfile
from app.services.student_grade_service import (
    get_my_class_name,
    get_my_grade_summary,
    get_my_school_year_name,
    get_my_assessment_detail,
    list_my_grades,
)

router = APIRouter(prefix="/students/me", tags=["student-grades"])


@router.get("", response_model=StudentMeProfile)
def get_my_profile(
    db: DatabaseSession,
    current_student: CurrentStudentDependency,
):
    """Retourne le profil résumé de l'élève connecté pour l'en-tête du tableau de bord."""
    return {
        "first_name": current_student.first_name,
        "last_name": current_student.last_name,
        "gender": current_student.gender,
        "class_name": get_my_class_name(db=db, student_id=current_student.id),
        "school_year_name": get_my_school_year_name(db=db, student_id=current_student.id),
    }


@router.get("/grades", response_model=list[StudentGradeItem])
def get_my_grades(
    db: DatabaseSession,
    current_student: CurrentStudentDependency,
):
    """Retourne les notes de l'élève connecté."""
    return list_my_grades(db=db, student_id=current_student.id)


@router.get("/grades/summary", response_model=StudentGradeSummary)
def get_my_grades_summary(
    db: DatabaseSession,
    current_student: CurrentStudentDependency,
):
    """Retourne la moyenne générale, les moyennes par matière et les évaluations à venir."""
    return get_my_grade_summary(db=db, student_id=current_student.id)


@router.get(
    "/grades/assessments/{assessment_id}",
    response_model=StudentAssessmentDetail,
)
def get_my_assessment_detail_route(
    assessment_id: UUID,
    db: DatabaseSession,
    current_student: CurrentStudentDependency,
):
    """Retourne le détail d'une évaluation appartenant à l'élève connecté."""

    try:
        return get_my_assessment_detail(
            db=db,
            student_id=current_student.id,
            assessment_id=assessment_id,
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
