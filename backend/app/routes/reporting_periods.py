"""Contrôleur HTTP de gestion des périodes de bulletin de l'US-003."""
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.core.postgres_error_message import extract_postgres_error_message
from app.core.reporting_period_not_found_error import (
    ReportingPeriodNotFoundError,
)
from app.core.school_year_not_found_error import SchoolYearNotFoundError
from app.schemas.reporting_period_create import ReportingPeriodCreate
from app.schemas.reporting_period_response import ReportingPeriodResponse
from app.schemas.reporting_period_update import ReportingPeriodUpdate
from app.services.reporting_period_service import (
    create_reporting_period,
    get_reporting_period_by_id,
    list_reporting_periods,
    update_reporting_period,
)
from app.services.school_year_service import get_school_year_by_id

router = APIRouter(
    prefix="/school-years/{school_year_id}/reporting-periods",
    tags=["reporting-periods"],
)


@router.get(
    "",
    response_model=list[ReportingPeriodResponse],
    status_code=status.HTTP_200_OK,
)
def get_reporting_periods(
    school_year_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> list[ReportingPeriodResponse]:
    """Retourne les périodes d'une année scolaire, ordonnées par date."""

    try:
        get_school_year_by_id(db, school_year_id)
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error

    reporting_periods = list_reporting_periods(db, school_year_id)

    return [
        ReportingPeriodResponse.model_validate(period)
        for period in reporting_periods
    ]


@router.post(
    "",
    response_model=ReportingPeriodResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_reporting_period(
    school_year_id: UUID,
    period_data: ReportingPeriodCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> ReportingPeriodResponse:
    """Crée une période : le backend calcule sa date de début."""

    if period_data.school_year_id != school_year_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'année scolaire de l'URL et du corps de la requête doivent correspondre.",
        )

    try:
        reporting_period = create_reporting_period(db, period_data)
    except SchoolYearNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Année scolaire introuvable.",
        ) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    return ReportingPeriodResponse.model_validate(reporting_period)


@router.patch(
    "/{reporting_period_id}",
    response_model=ReportingPeriodResponse,
    status_code=status.HTTP_200_OK,
)
def patch_reporting_period(
    school_year_id: UUID,
    reporting_period_id: UUID,
    period_data: ReportingPeriodUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> ReportingPeriodResponse:
    """Modifie une période et ajuste la suivante dans la même transaction."""

    try:
        reporting_period = get_reporting_period_by_id(db, reporting_period_id)
        if reporting_period.school_year_id != school_year_id:
            raise ReportingPeriodNotFoundError(reporting_period_id)

        updated_period = update_reporting_period(
            db,
            reporting_period_id,
            period_data,
        )
    except ReportingPeriodNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Période scolaire introuvable.",
        ) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error

    return ReportingPeriodResponse.model_validate(updated_period)
