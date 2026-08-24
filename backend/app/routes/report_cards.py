"""Routes de consultation des bulletins scolaires."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.services.report_card_service import (
    get_report_card_detail,
    list_report_cards,
)
from app.services.latex_report_card_service import compile_report_card_preview


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


@router.get("/{report_card_id}")
def get_report_card(
    report_card_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> dict:
    """Retourne le détail d'un bulletin consultable par un administrateur."""

    try:
        return get_report_card_detail(db=db, report_card_id=report_card_id)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.post("/{report_card_id}/test-pdf")
def post_report_card_test_pdf(
    report_card_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> Response:
    """Compile un aperçu PDF distant sans valider ni modifier le bulletin."""

    try:
        report_card = get_report_card_detail(db=db, report_card_id=report_card_id)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    pdf_content = compile_report_card_preview(report_card)
    filename = f"bulletin-test-{report_card['registration_number']}.pdf"
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
