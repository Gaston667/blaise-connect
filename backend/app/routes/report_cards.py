"""Routes de consultation des bulletins scolaires."""

from uuid import UUID

from fastapi import APIRouter, Query

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.services.report_card_service import list_report_cards


router = APIRouter(prefix="/report-cards", tags=["report-cards"])


@router.get("")
def get_report_cards(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    school_year_id: UUID | None = Query(default=None),
    school_class_id: UUID | None = Query(default=None),
    reporting_period_id: UUID | None = Query(default=None),
) -> list[dict]:
    """Liste les bulletins existants pour l'administrateur connecté."""

    return list_report_cards(
        db=db,
        school_year_id=school_year_id,
        school_class_id=school_class_id,
        reporting_period_id=reporting_period_id,
    )
