"""Contrôleur HTTP de gestion des années scolaires de l'US-003."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.core.postgres_error_message import extract_postgres_error_message
from app.core.school_year_already_closed_error import (
    SchoolYearAlreadyClosedError,
)
from app.core.school_year_not_found_error import SchoolYearNotFoundError
from app.schemas.school_year_create import SchoolYearCreate
from app.schemas.school_year_response import SchoolYearResponse
from app.services.school_year_service import (
    close_school_year,
    create_school_year,
    get_school_year_by_id,
    list_school_years,
    set_current_school_year,
)

router = APIRouter(
    prefix="/school-years",
    tags=["school-years"],
)


@router.get(
    "",
    response_model=list[SchoolYearResponse],
    status_code=status.HTTP_200_OK,
)
def get_school_years(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> list[SchoolYearResponse]:
    """Retourne les années scolaires à un administrateur connecté."""

    school_years = list_school_years(db)

    return [
        SchoolYearResponse.model_validate(school_year)
        for school_year in school_years
    ]


@router.get(
    "/{school_year_id}",
    response_model=SchoolYearResponse,
    status_code=status.HTTP_200_OK,
)
def get_school_year(
    school_year_id,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolYearResponse:
    """Retourne le détail d'une année scolaire."""

    try:
        school_year = get_school_year_by_id(db, school_year_id)
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error

    return SchoolYearResponse.model_validate(school_year)


@router.post(
    "",
    response_model=SchoolYearResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_school_year(
    school_year_data: SchoolYearCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolYearResponse:
    """Crée une nouvelle année scolaire."""

    try:
        school_year = create_school_year(db, school_year_data)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    return SchoolYearResponse.model_validate(school_year)


@router.post(
    "/{school_year_id}/set-current",
    response_model=SchoolYearResponse,
    status_code=status.HTTP_200_OK,
)
def post_set_current_school_year(
    school_year_id,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolYearResponse:
    """Définit l'année donnée comme l'unique année courante."""

    try:
        school_year = set_current_school_year(db, school_year_id)
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error
    except SchoolYearAlreadyClosedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une année clôturée ne peut pas redevenir courante.",
        ) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    return SchoolYearResponse.model_validate(school_year)


@router.post(
    "/{school_year_id}/close",
    response_model=SchoolYearResponse,
    status_code=status.HTTP_200_OK,
)
def post_close_school_year(
    school_year_id,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolYearResponse:
    """Clôture une année scolaire.

    Ferme automatiquement les inscriptions ouvertes de cette année
    (trigger PostgreSQL) et rend l'année immuable.
    """

    try:
        school_year = close_school_year(
            db=db,
            school_year_id=school_year_id,
            closed_by_account_id=current_admin.id,
        )
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error
    except SchoolYearAlreadyClosedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cette année scolaire est déjà clôturée.",
        ) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    return SchoolYearResponse.model_validate(school_year)