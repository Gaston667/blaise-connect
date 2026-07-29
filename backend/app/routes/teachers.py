"""Routes HTTP pour consulter les enseignants."""
from fastapi import APIRouter
from sqlalchemy import select

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.models.account import Account
from app.models.teacher import Teacher
from app.schemas.teacher_response import TeacherResponse

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("", response_model=list[TeacherResponse])
def get_teachers(db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Liste les enseignants actifs, triés par nom."""
    statement = (
        select(
            Teacher.id,
            Teacher.account_id,
            Account.registration_number,
            Teacher.first_name,
            Teacher.last_name,
            Teacher.email,
            Teacher.phone,
            Teacher.hire_date,
        )
        .join(Account, Account.id == Teacher.account_id)
        .where(Account.archived_at.is_(None), Account.is_active.is_(True))
        .order_by(Teacher.last_name, Teacher.first_name)
    )
    return list(db.execute(statement).mappings().all())
