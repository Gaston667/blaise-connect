"""Routes HTTP des évaluations et feuilles de notes collectives."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError

from app.core.authentication import DatabaseSession
from app.core.grade_authorization import GradeManagerDependency
from app.core.postgres_error_message import extract_postgres_error_message
from app.schemas.assessment_assignment_option import AssessmentAssignmentOption
from app.schemas.assessment_create import AssessmentCreate
from app.schemas.assessment_dashboard_summary import AssessmentDashboardSummary
from app.schemas.assessment_grade_sheet_response import AssessmentGradeSheetResponse
from app.schemas.assessment_overview import AssessmentOverview
from app.schemas.assessment_update import AssessmentUpdate
from app.schemas.grade_sheet_submit import GradeSheetSubmit
from app.services.assessment_service import (
    create_assessment,
    get_assessment,
    get_dashboard_summary,
    get_grade_sheet,
    list_assessment_assignment_options,
    list_assessments,
    submit_grade_sheet,
    update_assessment,
)


router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("", response_model=list[AssessmentOverview])
def get_assessments(
    db: DatabaseSession,
    actor: GradeManagerDependency,
    q: str | None = Query(default=None),
    class_id: UUID | None = Query(default=None),
    subject_id: UUID | None = Query(default=None),
    reporting_period_id: UUID | None = Query(default=None),
    teacher_id: UUID | None = Query(default=None),
) -> list[dict]:
    """Liste les évaluations visibles, avec ou sans note."""

    return list_assessments(
        db=db,
        actor=actor,
        q=q,
        class_id=class_id,
        subject_id=subject_id,
        reporting_period_id=reporting_period_id,
        teacher_id=teacher_id,
    )


@router.get("/summary", response_model=AssessmentDashboardSummary)
def get_assessments_summary(
    db: DatabaseSession,
    actor: GradeManagerDependency,
    q: str | None = Query(default=None),
    class_id: UUID | None = Query(default=None),
    subject_id: UUID | None = Query(default=None),
    reporting_period_id: UUID | None = Query(default=None),
) -> dict:
    """Retourne les indicateurs officiels de l'écran Notes."""

    return get_dashboard_summary(
        db=db,
        actor=actor,
        q=q,
        class_id=class_id,
        subject_id=subject_id,
        reporting_period_id=reporting_period_id,
    )


@router.get("/assignment-options", response_model=list[AssessmentAssignmentOption])
def get_assessment_assignment_options(
    db: DatabaseSession,
    actor: GradeManagerDependency,
    class_id: UUID | None = Query(default=None),
) -> list[dict]:
    """Propose les affectations utilisables par le compte connecté."""

    return list_assessment_assignment_options(
        db=db,
        actor=actor,
        class_id=class_id,
    )


@router.post("", response_model=AssessmentOverview, status_code=status.HTTP_201_CREATED)
def post_assessment(
    assessment_data: AssessmentCreate,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Crée une évaluation pour une affectation autorisée."""

    try:
        return create_assessment(db=db, actor=actor, assessment_data=assessment_data)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error


@router.get("/{assessment_id}", response_model=AssessmentOverview)
def get_assessment_detail(
    assessment_id: UUID,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Retourne le détail d'une évaluation autorisée."""

    try:
        return get_assessment(db=db, actor=actor, assessment_id=assessment_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/{assessment_id}", response_model=AssessmentOverview)
def patch_assessment(
    assessment_id: UUID,
    assessment_data: AssessmentUpdate,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Modifie les données encore modifiables d'une évaluation."""

    try:
        return update_assessment(
            db=db,
            actor=actor,
            assessment_id=assessment_id,
            assessment_data=assessment_data,
        )
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=extract_postgres_error_message(error),
        ) from error


@router.get(
    "/{assessment_id}/grade-sheet",
    response_model=AssessmentGradeSheetResponse,
)
def get_assessment_grade_sheet(
    assessment_id: UUID,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Charge tous les inscrits et leurs éventuels résultats."""

    try:
        return get_grade_sheet(db=db, actor=actor, assessment_id=assessment_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post(
    "/{assessment_id}/grade-sheet",
    response_model=AssessmentGradeSheetResponse,
)
def post_assessment_grade_sheet(
    assessment_id: UUID,
    sheet_data: GradeSheetSubmit,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Enregistre atomiquement les premières notes de plusieurs élèves."""

    try:
        return submit_grade_sheet(
            db=db,
            actor=actor,
            assessment_id=assessment_id,
            sheet_data=sheet_data,
        )
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une note existe déjà ou ne respecte pas le barème.",
        ) from error
