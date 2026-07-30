"""Routes HTTP pour consulter les enseignants."""
from fastapi import APIRouter, HTTPException, Query

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.teacher_detail import TeacherDetail
from app.schemas.teacher_overview import TeacherOverview
from app.services.teacher_service import get_teacher_detail, list_teachers_overview


router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("/overview", response_model=list[TeacherOverview])
def get_teachers_overview(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    q: str | None = Query(None),
):
    """Vue enrichie des enseignants : matricule, matières, statut brut."""
    return list_teachers_overview(db=db, q=q)


@router.get("/{teacher_id}/detail", response_model=TeacherDetail)
def get_teacher_detail_route(
    teacher_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Vue détaillée d'un enseignant : profil, classes, matières, effectif."""
    detail = get_teacher_detail(db=db, teacher_id=teacher_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Enseignant introuvable.")
    return detail