"""Contrôleur HTTP de gestion des classes de l'US-004."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import DBAPIError, IntegrityError
from app.schemas.school_class_overview import SchoolClassOverview
from app.services.school_class_service import list_school_classes_overview
from app.core.authentication import CurrentAccountDependency, CurrentAdminDependency, DatabaseSession
from app.core.postgres_error_message import extract_postgres_error_message
from app.core.school_class_not_found_error import SchoolClassNotFoundError
from app.core.school_class_level_locked_error import SchoolClassLevelLockedError
from app.schemas.school_class_create import SchoolClassCreate
from app.schemas.school_class_response import SchoolClassResponse
from app.schemas.school_class_update import SchoolClassUpdate
from app.schemas.school_class_detail import SchoolClassDetail
from app.schemas.school_class_subject_item import SchoolClassSubjectItem
from app.services.school_class_service import get_school_class_detail, delete_school_class
from app.services.school_class_service import list_school_class_subjects
from app.schemas.class_subject_add import ClassSubjectAdd
from app.schemas.class_subject_coefficient_update import ClassSubjectCoefficientUpdate
from app.services.school_class_service import (
    add_class_subject,
    list_available_subjects_for_class,
    remove_class_subject,
    update_class_subject_coefficient,
)

from app.services.school_class_service import (
    create_school_class,
    get_school_class_by_id,
    list_school_classes,
    update_school_class,
)

router = APIRouter(
    prefix="/school-classes",
    tags=["school-classes"],
)


@router.get(
    "",
    response_model=list[SchoolClassResponse],
    status_code=status.HTTP_200_OK,
)
def get_school_classes(
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
) -> list[SchoolClassResponse]:
    """Retourne toutes les classes à un administrateur connecté."""

    school_classes = list_school_classes(db)
    return [
        SchoolClassResponse.model_validate(school_class)
        for school_class in school_classes
    ]
@router.get("/overview", response_model=list[SchoolClassOverview])
def get_school_classes_overview(
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
    q: str | None = None,
    school_year_id: str | None = None,
    class_level_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SchoolClassOverview]:
    """Vue enrichie des classes pour l'écran de gestion (noms, effectif, statut)."""
    return list_school_classes_overview(
        db=db, q=q, school_year_id=school_year_id, class_level_id=class_level_id,
        status=status, limit=limit, offset=offset,
    )

@router.get(
    "/{school_class_id}",
    response_model=SchoolClassResponse,
    status_code=status.HTTP_200_OK,
)
def get_school_class(
    school_class_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolClassResponse:
    """Retourne une classe à partir de son identifiant."""

    try:
        school_class = get_school_class_by_id(db, school_class_id)
    except SchoolClassNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classe introuvable.",
        ) from error
    return SchoolClassResponse.model_validate(school_class)


@router.post(
    "",
    response_model=SchoolClassResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_school_class(
    school_class_data: SchoolClassCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolClassResponse:
    """Crée une classe liée à une année, un niveau et un professeur principal."""

    try:
        school_class = create_school_class(db, school_class_data)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error
    except DBAPIError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La base de données a refusé la création de la classe.",
        ) from error

    return SchoolClassResponse.model_validate(school_class)


@router.patch(
    "/{school_class_id}",
    response_model=SchoolClassResponse,
    status_code=status.HTTP_200_OK,
)
def patch_school_class(
    school_class_id: UUID,
    school_class_data: SchoolClassUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolClassResponse:
    """Modifie une classe tant que son année scolaire n'est pas clôturée."""

    try:
        school_class = update_school_class(
            db,
            school_class_id,
            school_class_data,
        )
    except SchoolClassNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Classe introuvable.",
        ) from error
    except SchoolClassLevelLockedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Le niveau ne peut plus être modifié car la classe possède une inscription.",
        ) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error
    except DBAPIError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La base de données a refusé la modification de la classe.",
        ) from error

    return SchoolClassResponse.model_validate(school_class)
@router.get("/{school_class_id}/detail", response_model=SchoolClassDetail)
def get_school_class_detail_route(
    school_class_id: UUID,
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
):
    """Vue détaillée d'une classe avec effectif, professeur et statut."""
    detail = get_school_class_detail(db=db, school_class_id=str(school_class_id))
    if not detail:
        raise HTTPException(status_code=404, detail="Classe introuvable.")
    return detail


@router.get(
    "/{school_class_id}/subjects",
    response_model=list[SchoolClassSubjectItem],
)
def get_school_class_subjects(
    school_class_id: UUID,
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
    q: str | None = Query(None, description="Recherche par nom de matière"),
    is_active: bool | None = Query(None, description="Filtre sur les matières actives"),
):
    """Retourne les matières réellement associées à une classe."""

    try:
        get_school_class_by_id(db, school_class_id)
    except SchoolClassNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classe introuvable.") from error

    return list_school_class_subjects(
        db=db,
        school_class_id=str(school_class_id),
        q=q,
        is_active=is_active,
    )


@router.get("/{school_class_id}/available-subjects")
def get_available_subjects(
    school_class_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Retourne les matières actives non encore associées à cette classe."""
    try:
        get_school_class_by_id(db, school_class_id)
    except SchoolClassNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classe introuvable.") from error
    return list_available_subjects_for_class(db=db, school_class_id=str(school_class_id))


@router.post(
    "/{school_class_id}/subjects",
    response_model=SchoolClassSubjectItem,
    status_code=status.HTTP_201_CREATED,
)
def post_class_subject(
    school_class_id: UUID,
    body: ClassSubjectAdd,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Associe une matière à la classe avec un coefficient."""
    try:
        get_school_class_by_id(db, school_class_id)
    except SchoolClassNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classe introuvable.") from error
    try:
        cs = add_class_subject(
            db=db,
            class_id=str(school_class_id),
            subject_id=body.subject_id,
            coefficient=body.coefficient,
        )
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette matière est déjà associée à la classe.",
        ) from error
    return {
        "id": cs.id,
        "subject_id": cs.subject_id,
        "name": "",
        "coefficient": cs.coefficient,
        "is_active": True,
        "teacher_name": None,
    }


@router.patch("/{school_class_id}/subjects/{class_subject_id}", response_model=SchoolClassSubjectItem)
def patch_class_subject(
    school_class_id: UUID,
    class_subject_id: UUID,
    body: ClassSubjectCoefficientUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Met à jour le coefficient d'une matière de la classe."""
    try:
        cs = update_class_subject_coefficient(
            db=db,
            class_subject_id=class_subject_id,
            coefficient=body.coefficient,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=extract_postgres_error_message(error)) from error
    return {
        "id": cs.id,
        "subject_id": cs.subject_id,
        "name": "",
        "coefficient": cs.coefficient,
        "is_active": True,
        "teacher_name": None,
    }


@router.delete("/{school_class_id}/subjects/{class_subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class_subject(
    school_class_id: UUID,
    class_subject_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Retire une matière de la classe."""
    try:
        remove_class_subject(db=db, class_subject_id=class_subject_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Impossible de retirer cette matière : une affectation enseignant "
                "ou une donnée pédagogique y est rattachée."
            ),
        ) from error


@router.delete("/{school_class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_school_class_route(
    school_class_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Supprime une classe. Refuse si des élèves ou matières y sont rattachés."""
    try:
        get_school_class_by_id(db, school_class_id)
        delete_school_class(db=db, school_class_id=str(school_class_id))
    except SchoolClassNotFoundError as error:
        raise HTTPException(status_code=404, detail="Classe introuvable.") from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Impossible de supprimer : des élèves ou matières sont encore rattachés à cette classe.",
        ) from error
