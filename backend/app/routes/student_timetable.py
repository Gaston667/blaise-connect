"""Route HTTP pour la consultation de l'emploi du temps par l'élève lui-même."""

from fastapi import APIRouter

from app.core.authentication import DatabaseSession
from app.core.student_self import CurrentStudentDependency
from app.services import timetable_service

router = APIRouter(prefix="/students/me", tags=["student-timetable"])


@router.get("/timetable")
def get_my_timetable(db: DatabaseSession, current_student: CurrentStudentDependency):
    """Retourne l'emploi du temps de la classe active de l'élève connecté."""
    return timetable_service.get_student_timetable(db=db, student_id=current_student.id)
