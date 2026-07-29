"""Contrôleur HTTP de gestion des classes de l'US-004."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import DBAPIError, IntegrityError
from app.schemas.school_class_overview import SchoolClassOverview
from app.services.school_class_service import list_school_classes_overview
from app.core.authentication import CurrentAdminDependency, DatabaseSession
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
    current_admin: CurrentAdminDependency,
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
    current_admin: CurrentAdminDependency,
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
    current_admin: CurrentAdminDependency,
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
    current_admin: CurrentAdminDependency,
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
