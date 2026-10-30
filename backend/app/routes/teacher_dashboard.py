"""Route du tableau de bord de l'enseignant connecté."""

from fastapi import APIRouter

from app.core.authentication import CurrentAccountDependency, DatabaseSession
from app.core.teacher_self import CurrentTeacherDependency
from app.services.teacher_dashboard_service import get_teacher_dashboard

router = APIRouter(prefix="/teachers/me", tags=["teacher-dashboard"])


@router.get("/dashboard")
def get_my_dashboard(
    db: DatabaseSession,
    current_teacher: CurrentTeacherDependency,
    current_account: CurrentAccountDependency,
):
    """Cours du jour, prochain cours, évaluations à terminer et corrections en attente."""

    return get_teacher_dashboard(
        db=db, teacher_id=current_teacher.id, account_id=current_account.id
    )
