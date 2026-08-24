"""Routes HTTP de consultation et de gestion des enseignants."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError

from app.core.authentication import CurrentAdminDependency, CurrentStaffDependency, DatabaseSession
from app.core.postgres_error_message import extract_postgres_error_message
from app.core.teacher_assignment_conflict_error import TeacherAssignmentConflictError
from app.schemas.teacher_assignment_create import TeacherAssignmentCreate
from app.schemas.teacher_assignment_end import TeacherAssignmentEnd
from app.schemas.teacher_assignment_option import TeacherAssignmentOption
from app.schemas.teacher_detail import TeacherDetail
from app.schemas.teacher_overview import TeacherOverview
from app.schemas.teacher_update import TeacherUpdate
from app.services.teacher_service import (
    create_teacher_assignment,
    end_teacher_assignment,
    get_teacher_detail,
    list_available_teacher_assignments,
    list_teachers_overview,
    update_teacher_profile,
)


router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("/overview", response_model=list[TeacherOverview])
def get_teachers_overview(
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
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


@router.patch("/{teacher_id}", response_model=TeacherDetail)
def patch_teacher_route(
    teacher_id: str,
    body: TeacherUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Met à jour les informations personnelles modifiables d'un enseignant."""

    try:
        detail = update_teacher_profile(db=db, teacher_id=teacher_id, data=body)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=extract_postgres_error_message(error)) from error

    if not detail:
        raise HTTPException(status_code=404, detail="Enseignant introuvable.")
    return detail


@router.get(
    "/{teacher_id}/available-assignments",
    response_model=list[TeacherAssignmentOption],
)
def get_available_teacher_assignments_route(
    teacher_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> list[TeacherAssignmentOption]:
    """Retourne les matières de classes disponibles pour cet enseignant."""

    return list_available_teacher_assignments(db=db, teacher_id=teacher_id)


@router.post(
    "/{teacher_id}/assignments",
    response_model=TeacherDetail,
    status_code=status.HTTP_201_CREATED,
)
def post_teacher_assignment_route(
    teacher_id: UUID,
    body: TeacherAssignmentCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> TeacherDetail:
    """Affecte une matière de classe à un enseignant."""

    try:
        create_teacher_assignment(db=db, teacher_id=teacher_id, data=body)
    except TeacherAssignmentConflictError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    detail = get_teacher_detail(db=db, teacher_id=str(teacher_id))
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enseignant introuvable.")
    return detail


@router.patch(
    "/{teacher_id}/assignments/{assignment_id}/end",
    response_model=TeacherDetail,
)
def end_teacher_assignment_route(
    teacher_id: UUID,
    assignment_id: UUID,
    body: TeacherAssignmentEnd,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> TeacherDetail:
    """Termine une affectation tout en conservant son historique."""

    try:
        end_teacher_assignment(
            db=db,
            teacher_id=teacher_id,
            assignment_id=assignment_id,
            data=body,
        )
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    detail = get_teacher_detail(db=db, teacher_id=str(teacher_id))
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enseignant introuvable.")
    return detail
