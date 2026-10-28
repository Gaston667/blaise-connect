"""Routes du portail parents : consultation seule des enfants rattachés.

Chaque route `/guardian/children/{student_id}/...` vérifie d'abord que l'élève
est bien rattaché au responsable connecté (`get_guardian_child`). Les données
sont ensuite produites par les mêmes services que l'espace élève, afin que les
chiffres vus par un parent soient exactement ceux vus par l'élève.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.authentication import DatabaseSession
from app.core.guardian_self import CurrentGuardianDependency, get_guardian_child
from app.schemas.guardian_child import GuardianChild
from app.schemas.student_assessment_detail import StudentAssessmentDetail
from app.schemas.student_grade_item import StudentGradeItem
from app.schemas.student_grade_summary import StudentGradeSummary
from app.schemas.student_me_profile import StudentMeProfile
from app.services import timetable_service
from app.services.attendance_service import get_student_attendance
from app.services.guardian_portal_service import (
    get_child_report_card,
    list_child_report_cards,
    list_guardian_children,
)
from app.services.student_grade_service import (
    get_my_assessment_detail,
    get_my_class_name,
    get_my_grade_summary,
    get_my_school_year_name,
    list_my_grades,
)

router = APIRouter(prefix="/guardian", tags=["guardian-portal"])


@router.get("/children", response_model=list[GuardianChild])
def get_children(db: DatabaseSession, guardian: CurrentGuardianDependency):
    """Liste les enfants rattachés au responsable connecté."""

    return list_guardian_children(db=db, guardian_id=guardian.id)


@router.get("/children/{student_id}", response_model=StudentMeProfile)
def get_child_profile(
    student_id: UUID, db: DatabaseSession, guardian: CurrentGuardianDependency
):
    """Retourne l'identité et la classe actuelle d'un enfant."""

    student = get_guardian_child(db, guardian, student_id)
    return {
        "first_name": student.first_name,
        "last_name": student.last_name,
        "gender": student.gender,
        "class_name": get_my_class_name(db=db, student_id=student.id),
        "school_year_name": get_my_school_year_name(db=db, student_id=student.id),
    }


@router.get("/children/{student_id}/grades", response_model=list[StudentGradeItem])
def get_child_grades(
    student_id: UUID, db: DatabaseSession, guardian: CurrentGuardianDependency
):
    """Retourne les notes d'un enfant."""

    student = get_guardian_child(db, guardian, student_id)
    return list_my_grades(db=db, student_id=student.id)


@router.get("/children/{student_id}/grades/summary", response_model=StudentGradeSummary)
def get_child_grades_summary(
    student_id: UUID, db: DatabaseSession, guardian: CurrentGuardianDependency
):
    """Retourne les moyennes, le rang et les évaluations à venir d'un enfant."""

    student = get_guardian_child(db, guardian, student_id)
    return get_my_grade_summary(db=db, student_id=student.id)


@router.get(
    "/children/{student_id}/grades/assessments/{assessment_id}",
    response_model=StudentAssessmentDetail,
)
def get_child_assessment_detail(
    student_id: UUID,
    assessment_id: UUID,
    db: DatabaseSession,
    guardian: CurrentGuardianDependency,
):
    """Retourne le détail d'une évaluation de l'enfant."""

    student = get_guardian_child(db, guardian, student_id)
    try:
        return get_my_assessment_detail(
            db=db, student_id=student.id, assessment_id=assessment_id
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error


@router.get("/children/{student_id}/timetable")
def get_child_timetable(
    student_id: UUID, db: DatabaseSession, guardian: CurrentGuardianDependency
):
    """Retourne l'emploi du temps publié de la classe de l'enfant."""

    student = get_guardian_child(db, guardian, student_id)
    return timetable_service.get_student_timetable(db=db, student_id=student.id)


@router.get("/children/{student_id}/attendance")
def get_child_attendance(
    student_id: UUID, db: DatabaseSession, guardian: CurrentGuardianDependency
):
    """Retourne les absences et retards d'un enfant, en lecture seule (V1)."""

    student = get_guardian_child(db, guardian, student_id)
    attendance = get_student_attendance(db, student.id)
    # V1 : le parent consulte seulement. Le dépôt d'un justificatif viendra plus tard.
    for incident in attendance.get("incidents", []):
        incident["can_justify"] = False
    return attendance


@router.get("/children/{student_id}/report-cards")
def get_child_report_cards(
    student_id: UUID, db: DatabaseSession, guardian: CurrentGuardianDependency
):
    """Liste les bulletins validés d'un enfant."""

    student = get_guardian_child(db, guardian, student_id)
    return list_child_report_cards(db=db, student_id=student.id)


@router.get("/children/{student_id}/report-cards/{report_card_id}")
def get_child_report_card_detail(
    student_id: UUID,
    report_card_id: UUID,
    db: DatabaseSession,
    guardian: CurrentGuardianDependency,
):
    """Retourne le détail d'un bulletin validé d'un enfant."""

    student = get_guardian_child(db, guardian, student_id)
    try:
        return get_child_report_card(
            db=db, student_id=student.id, report_card_id=report_card_id
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
