"""Routes HTTP pour gérer les matières."""
from fastapi import APIRouter, HTTPException, Query, status

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.subject_create import SubjectCreate
from app.schemas.subject_overview import SubjectOverview
from app.schemas.subject_response import SubjectResponse
from app.schemas.subject_update import SubjectUpdate
from app.services.subject_service import (
    create_subject,
    list_subjects_overview,
    update_subject,
)

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("/overview", response_model=list[SubjectOverview])
def get_subjects_overview(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    q: str | None = Query(None),
    class_id: str | None = Query(None),
    teacher_id: str | None = Query(None),
    is_active: str | None = Query(None),
):
    """Vue enrichie des matières pour l'écran de gestion."""
    return list_subjects_overview(
        db=db, q=q, class_id=class_id, teacher_id=teacher_id, is_active=is_active
    )


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
