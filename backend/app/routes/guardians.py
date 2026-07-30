"""Routes HTTP des responsables légaux et de leurs liens aux élèves."""

from fastapi import APIRouter, HTTPException, Query, status

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.guardian_create import GuardianCreate
from app.schemas.guardian_link_create import GuardianLinkCreate
from app.schemas.guardian_link_update import GuardianLinkUpdate
from app.schemas.guardian_response import GuardianResponse
from app.schemas.guardian_update import GuardianUpdate
from app.schemas.student_guardian_response import StudentGuardianResponse
from app.services.guardian_service import (
    create_guardian,
    link_guardian_to_student,
    list_guardians,
    list_guardians_for_student,
    unlink_guardian_from_student,
    update_guardian,
    update_guardian_link,
)

router = APIRouter(tags=["guardians"])


@router.get("/guardians", response_model=list[GuardianResponse])
def get_guardians(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    q: str | None = Query(None, description="Recherche par nom, prénom ou téléphone"),
):
    """Liste les responsables accessibles à un administrateur."""

    return list_guardians(db=db, q=q)


@router.post(
    "/guardians",
    response_model=GuardianResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_guardian(
    data: GuardianCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Crée un responsable et éventuellement son premier lien élève."""

    try:
        return create_guardian(db=db, data=data)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.patch("/guardians/{guardian_id}", response_model=GuardianResponse)
def patch_guardian(
    guardian_id: str,
    data: GuardianUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Met à jour les informations personnelles d'un responsable."""

    guardian = update_guardian(db=db, guardian_id=guardian_id, data=data)
    if guardian is None:
        raise HTTPException(status_code=404, detail="Responsable introuvable.")
    return guardian


@router.get(
    "/students/{student_id}/guardians",
    response_model=list[StudentGuardianResponse],
)
def get_student_guardians(
    student_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Liste les responsables associés à un élève."""

    return list_guardians_for_student(db=db, student_id=student_id)


@router.post(
    "/students/{student_id}/guardians/{guardian_id}",
    status_code=status.HTTP_201_CREATED,
)
def post_link_guardian(
    student_id: str,
    guardian_id: str,
    data: GuardianLinkCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Associe un responsable existant à un élève."""

    try:
        return link_guardian_to_student(
            db=db,
            student_id=student_id,
            guardian_id=guardian_id,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.patch("/students/{student_id}/guardians/{guardian_id}")
def patch_guardian_link(
    student_id: str,
    guardian_id: str,
    data: GuardianLinkUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Met à jour le rôle familial et les indicateurs de contact."""

    try:
        result = update_guardian_link(
            db=db,
            student_id=student_id,
            guardian_id=guardian_id,
            data=data,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    if result is None:
        raise HTTPException(status_code=404, detail="Lien introuvable.")
    return result


@router.delete(
    "/students/{student_id}/guardians/{guardian_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_guardian_link(
    student_id: str,
    guardian_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Détache un responsable sans supprimer son dossier."""

    success = unlink_guardian_from_student(
        db=db,
        student_id=student_id,
        guardian_id=guardian_id,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Lien introuvable.")
