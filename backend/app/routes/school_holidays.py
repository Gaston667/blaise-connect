"""Routes des vacances scolaires : saisie réservée à l'administrateur, lecture pour tous."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.core.authentication import (
    CurrentAccountDependency,
    CurrentAdminDependency,
    DatabaseSession,
)
from app.schemas.school_holiday import (
    SchoolHolidayCreate,
    SchoolHolidayResponse,
    SchoolHolidayUpdate,
)
from app.services import school_holiday_service as service

router = APIRouter(tags=["school-holidays"])


@router.get("/school-holidays", response_model=list[SchoolHolidayResponse])
def get_school_holidays(
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """Vacances chevauchant une plage de dates (tous les comptes connectés)."""

    return service.list_school_holidays(db, date_from=date_from, date_to=date_to)


@router.get(
    "/school-years/{school_year_id}/holidays", response_model=list[SchoolHolidayResponse]
)
def get_year_holidays(
    school_year_id: UUID, db: DatabaseSession, current_admin: CurrentAdminDependency
):
    """Vacances d'une année scolaire."""

    return service.list_school_holidays(db, school_year_id=school_year_id)


@router.post(
    "/school-years/{school_year_id}/holidays",
    response_model=SchoolHolidayResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_year_holiday(
    school_year_id: UUID,
    data: SchoolHolidayCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Ajoute des vacances à une année."""

    try:
        return service.create_school_holiday(db, school_year_id, data)
    except LookupError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.patch(
    "/school-years/{school_year_id}/holidays/{holiday_id}",
    response_model=SchoolHolidayResponse,
)
def patch_year_holiday(
    school_year_id: UUID,
    holiday_id: UUID,
    data: SchoolHolidayUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Modifie des vacances."""

    try:
        return service.update_school_holiday(db, school_year_id, holiday_id, data)
    except LookupError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.delete(
    "/school-years/{school_year_id}/holidays/{holiday_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_year_holiday(
    school_year_id: UUID,
    holiday_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Supprime des vacances."""

    try:
        service.delete_school_holiday(db, school_year_id, holiday_id)
    except LookupError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
