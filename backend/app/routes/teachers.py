"""Routes HTTP pour consulter les enseignants."""
from fastapi import APIRouter, Query

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.teacher_overview import TeacherOverview
from app.services.teacher_service import list_teachers_overview

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("/overview", response_model=list[TeacherOverview])
def get_teachers_overview(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    q: str | None = Query(None),
):
    """Vue enrichie des enseignants : matricule, matières, statut brut."""
    return list_teachers_overview(db=db, q=q)