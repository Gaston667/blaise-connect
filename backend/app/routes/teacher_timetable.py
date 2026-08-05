"""Route HTTP pour la consultation de l'emploi du temps par l'enseignant lui-même."""

from fastapi import APIRouter

from app.core.authentication import DatabaseSession
from app.core.teacher_self import CurrentTeacherDependency
from app.services import timetable_service

router = APIRouter(prefix="/teachers/me", tags=["teacher-timetable"])


@router.get("/timetable")
def get_my_timetable(db: DatabaseSession, current_teacher: CurrentTeacherDependency):
    """Retourne l'emploi du temps de l'enseignant connecté, toutes classes confondues."""
    return timetable_service.get_teacher_timetable(db=db, teacher_id=current_teacher.id)
