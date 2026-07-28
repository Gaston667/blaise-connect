"""Routes HTTP pour consulter les enseignants."""
from fastapi import APIRouter
from sqlalchemy import select

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.models.teacher import Teacher
from app.schemas.teacher_response import TeacherResponse

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("", response_model=list[TeacherResponse])
def get_teachers(db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Liste les enseignants actifs, triés par nom."""
    statement = select(Teacher).order_by(Teacher.last_name)
    return list(db.scalars(statement).all())