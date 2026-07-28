"""Routes HTTP pour gérer les responsables légaux et leurs liens aux élèves."""
from fastapi import APIRouter, HTTPException, Query, status

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.guardian_create import GuardianCreate
from app.schemas.guardian_response import GuardianResponse, StudentGuardianResponse
from app.schemas.guardian_update import GuardianUpdate, GuardianLinkUpdate
from app.services.guardian_service import (
    list_guardians,
    create_guardian,
    update_guardian,
    list_guardians_for_student,
    link_guardian_to_student,
    update_guardian_link,
    unlink_guardian_from_student,
)

router = APIRouter(tags=["guardians"])


@router.get("/guardians", response_model=list[GuardianResponse])
def get_guardians(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    q: str | None = Query(None, description="Recherche par nom, prénom ou téléphone"),
):
    """Liste/recherche des responsables existants (pour rattacher un responsable à un autre enfant)."""
    return list_guardians(db=db, q=q)


@router.post("/guardians", response_model=GuardianResponse, status_code=status.HTTP_201_CREATED)
def post_guardian(
    data: GuardianCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Crée un responsable légal, et le rattache à un élève si `student_id` est fourni."""
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
    """Met à jour les informations d'un responsable."""
    guardian = update_guardian(db=db, guardian_id=guardian_id, data=data)
    if not guardian:
        raise HTTPException(status_code=404, detail="Guardian not found")
    return guardian


@router.get("/students/{student_id}/guardians", response_model=list[StudentGuardianResponse])
def get_student_guardians(
    student_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Liste les responsables rattachés à un élève."""
    return list_guardians_for_student(db=db, student_id=student_id)


@router.post("/students/{student_id}/guardians/{guardian_id}", status_code=status.HTTP_201_CREATED)
def post_link_guardian(
    student_id: str,
    guardian_id: str,
    relationship: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    is_primary_contact: bool = False,
):
    """Rattache un responsable existant à un élève."""
    return link_guardian_to_student(
        db=db,
        student_id=student_id,
        guardian_id=guardian_id,
        relationship=relationship,
        is_primary_contact=is_primary_contact,
    )


@router.patch("/students/{student_id}/guardians/{guardian_id}")
def patch_guardian_link(
    student_id: str,
    guardian_id: str,
    data: GuardianLinkUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Met à jour le type de lien ou le statut de contact principal."""
    result = update_guardian_link(db=db, student_id=student_id, guardian_id=guardian_id, data=data)
    if not result:
        raise HTTPException(status_code=404, detail="Link not found")
    return result


@router.delete("/students/{student_id}/guardians/{guardian_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guardian_link(
    student_id: str,
    guardian_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Détache un responsable d'un élève (ne supprime pas le responsable)."""
    success = unlink_guardian_from_student(db=db, student_id=student_id, guardian_id=guardian_id)
    if not success:
        raise HTTPException(status_code=404, detail="Link not found")