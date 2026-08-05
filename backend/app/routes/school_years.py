"""Contrôleur HTTP de gestion des années scolaires de l'US-003."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.core.postgres_error_message import extract_postgres_error_message
from app.core.school_year_already_closed_error import (
    SchoolYearAlreadyClosedError,
)
from app.core.school_year_not_found_error import SchoolYearNotFoundError
from app.core.school_year_periods_mismatch_error import (
    SchoolYearPeriodsMismatchError,
)
from app.core.school_year_confirmation_mismatch_error import (
    SchoolYearConfirmationMismatchError,
)
from app.schemas.reporting_period_response import ReportingPeriodResponse
from app.schemas.school_year_create import SchoolYearCreate
from app.schemas.school_year_details_response import SchoolYearDetailsResponse
from app.schemas.school_year_details_update import SchoolYearDetailsUpdate
from app.schemas.school_year_deletion_confirmation import (
    SchoolYearDeletionConfirmation,
)
from app.schemas.school_year_deletion_preview import SchoolYearDeletionPreview
from app.schemas.school_year_deletion_response import SchoolYearDeletionResponse
from app.schemas.school_year_response import SchoolYearResponse
from app.schemas.school_year_update import SchoolYearUpdate
from app.services.school_year_service import (
    close_school_year,
    create_school_year,
    get_school_year_by_id,
    list_school_years,
    set_current_school_year,
    update_school_year,
    update_school_year_details,
    delete_open_school_year,
    get_school_year_deletion_preview,
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
    school_year_id: UUID,
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
    except DBAPIError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="La base de données a refusé la création de l'année scolaire.",
        ) from error

    return SchoolYearResponse.model_validate(school_year)


@router.post(
    "/{school_year_id}/set-current",
    response_model=SchoolYearResponse,
    status_code=status.HTTP_200_OK,
)
def post_set_current_school_year(
    school_year_id: UUID,
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
    school_year_id: UUID,
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


@router.patch(
    "/{school_year_id}",
    response_model=SchoolYearResponse,
    status_code=status.HTTP_200_OK,
)
def patch_school_year(
    school_year_id: UUID,
    school_year_data: SchoolYearUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolYearResponse:
    """Modifie une année scolaire non clôturée."""

    try:
        school_year = update_school_year(db, school_year_id, school_year_data)
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error
    except SchoolYearAlreadyClosedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une année clôturée ne peut plus être modifiée.",
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
            detail="La base de données a refusé la modification de l'année scolaire.",
        ) from error

    return SchoolYearResponse.model_validate(school_year)


@router.patch(
    "/{school_year_id}/details",
    response_model=SchoolYearDetailsResponse,
    status_code=status.HTTP_200_OK,
)
def patch_school_year_details(
    school_year_id: UUID,
    details_data: SchoolYearDetailsUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolYearDetailsResponse:
    """Modifie atomiquement une année scolaire et toutes ses périodes."""

    try:
        school_year, periods = update_school_year_details(
            db,
            school_year_id,
            details_data,
        )
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error
    except SchoolYearAlreadyClosedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une année clôturée ne peut plus être modifiée.",
        ) from error
    except SchoolYearPeriodsMismatchError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    return SchoolYearDetailsResponse(
        school_year=SchoolYearResponse.model_validate(school_year),
        periods=[
            ReportingPeriodResponse.model_validate(period)
            for period in periods
        ],
    )


@router.get(
    "/{school_year_id}/deletion-preview",
    response_model=SchoolYearDeletionPreview,
    status_code=status.HTTP_200_OK,
)
def get_deletion_preview(
    school_year_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolYearDeletionPreview:
    """Retourne les conséquences d'une suppression avant confirmation."""

    try:
        return get_school_year_deletion_preview(db, school_year_id)
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error
    except SchoolYearAlreadyClosedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une année clôturée ne peut jamais être supprimée.",
        ) from error


@router.delete(
    "/{school_year_id}",
    response_model=SchoolYearDeletionResponse,
    status_code=status.HTTP_200_OK,
)
def delete_school_year(
    school_year_id: UUID,
    confirmation: SchoolYearDeletionConfirmation,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> SchoolYearDeletionResponse:
    """Supprime définitivement une année ouverte après confirmation forte."""

    try:
        deleted_counts = delete_open_school_year(
            db,
            school_year_id,
            confirmation.confirmation_name,
            current_admin.id,
        )
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error
    except SchoolYearAlreadyClosedError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une année clôturée ne peut jamais être supprimée.",
        ) from error
    except SchoolYearConfirmationMismatchError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nom saisi ne correspond pas à l'année scolaire.",
        ) from error
    except DBAPIError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    return SchoolYearDeletionResponse(
        message="L'année scolaire et toutes ses données ont été supprimées.",
        deleted_counts=deleted_counts,
    )
