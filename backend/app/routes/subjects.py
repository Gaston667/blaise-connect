"""Routes HTTP pour gérer les matières."""
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import text

from app.core.authentication import CurrentAdminDependency, CurrentStaffDependency, DatabaseSession
from app.schemas.subject_create import SubjectCreate
from app.schemas.subject_detail import SubjectDetail
from app.schemas.subject_overview import SubjectOverview
from app.schemas.subject_response import SubjectResponse
from app.schemas.subject_update import SubjectUpdate
from app.services.subject_service import (
    create_subject,
    get_subject_detail,
    list_subjects_overview,
    update_subject,
)

router = APIRouter(prefix="/subjects", tags=["subjects"])


def _resolve_own_teacher_id(db: DatabaseSession, account_id) -> str | None:
    row = db.execute(
        text("SELECT id FROM teachers WHERE account_id = :account_id"),
        {"account_id": account_id},
    ).first()
    return str(row.id) if row else None


@router.get("/overview", response_model=list[SubjectOverview])
def get_subjects_overview(
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
    q: str | None = Query(None),
    class_id: str | None = Query(None),
    teacher_id: str | None = Query(None),
    is_active: str | None = Query(None),
):
    """Vue enrichie des matières pour l'écran de gestion. Un enseignant ne voit
    que les matières qu'il enseigne, quel que soit le filtre demandé côté
    client (le forçage est fait ici, pas seulement côté frontend)."""
    if current_staff.role == "TEACHER":
        teacher_id = _resolve_own_teacher_id(db, current_staff.id)
        if teacher_id is None:
            return []
    return list_subjects_overview(
        db=db, q=q, class_id=class_id, teacher_id=teacher_id, is_active=is_active
    )


@router.get("/{subject_id}/detail", response_model=SubjectDetail)
def get_subject_detail_route(
    subject_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Retourne la fiche d'une matière et ses classes associées."""

    detail = get_subject_detail(db=db, subject_id=subject_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Matière introuvable.")
    return detail


@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def post_subject(
    data: SubjectCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Crée une nouvelle matière."""
    return create_subject(db=db, data=data)


@router.patch("/{subject_id}", response_model=SubjectResponse)
def patch_subject(
    subject_id: str,
    data: SubjectUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Met à jour une matière."""
    subject = update_subject(db=db, subject_id=subject_id, data=data)
    if not subject:
        raise HTTPException(status_code=404, detail="Matière introuvable.")
    return subject
