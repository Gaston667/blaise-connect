"""Contrôleur HTTP de gestion des classes de l'US-004."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.core.postgres_error_message import extract_postgres_error_message
from app.core.school_class_not_found_error import SchoolClassNotFoundError
from app.schemas.school_class_create import SchoolClassCreate
from app.schemas.school_class_response import SchoolClassResponse
from app.schemas.school_class_update import SchoolClassUpdate
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
