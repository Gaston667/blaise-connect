"""Routes du workflow de correction des notes."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.core.grade_authorization import GradeManagerDependency
from app.core.postgres_error_message import extract_postgres_error_message
from app.schemas.grade_change_request_create import GradeChangeRequestCreate
from app.schemas.grade_change_request_decision import GradeChangeRequestDecision
from app.schemas.grade_change_request_response import GradeChangeRequestResponse
from app.services.grade_change_request_service import (
    apply_grade_correction_directly,
    create_grade_change_request,
    list_grade_change_requests,
    review_grade_change_request,
)


router = APIRouter(
    prefix="/grade-change-requests",
    tags=["grade-change-requests"],
)


@router.get("", response_model=list[GradeChangeRequestResponse])
def get_grade_change_requests(
    db: DatabaseSession,
    actor: GradeManagerDependency,
    request_status: Literal["PENDING", "APPROVED", "REJECTED"] | None = Query(
        default=None,
        alias="status",
    ),
    grade_id: UUID | None = Query(default=None),
    assessment_id: UUID | None = Query(default=None),
) -> list[dict]:
    """Liste les demandes visibles par le compte connecté."""

    return list_grade_change_requests(
        db=db,
        actor=actor,
        status_filter=request_status,
        grade_id=grade_id,
        assessment_id=assessment_id,
    )


@router.post(
    "",
    response_model=GradeChangeRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_grade_change_request(
    request_data: GradeChangeRequestCreate,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Crée une demande sans modifier directement la note."""

    try:
        return create_grade_change_request(db=db, actor=actor, request_data=request_data)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une demande de correction est déjà en attente pour cette note.",
        ) from error


@router.post("/direct-application")
def post_direct_grade_correction(
    request_data: GradeChangeRequestCreate,
    db: DatabaseSession,
    admin: CurrentAdminDependency,
) -> dict:
    """Applique directement une correction de note par un administrateur."""

    try:
        return apply_grade_correction_directly(
            db=db,
            admin=admin,
            request_data=request_data,
        )
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error


@router.patch(
    "/{request_id}/decision",
    response_model=GradeChangeRequestResponse,
)
def patch_grade_change_request_decision(
    request_id: UUID,
    decision: GradeChangeRequestDecision,
    db: DatabaseSession,
    reviewer: GradeManagerDependency,
) -> dict:
    """Approuve ou refuse une demande de correction."""

    try:
        return review_grade_change_request(
            db=db,
            reviewer=reviewer,
            request_id=request_id,
            decision=decision,
        )
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except PermissionError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error
