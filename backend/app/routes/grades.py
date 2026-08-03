"""Routes HTTP de consultation et de saisie des notes."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError

from app.core.authentication import DatabaseSession
from app.core.grade_authorization import GradeManagerDependency
from app.schemas.grade_create import GradeCreate
from app.schemas.grade_options_response import GradeOptionsResponse
from app.schemas.grade_overview import GradeOverview
from app.services.grade_service import create_grade, get_grade_options, list_grades


router = APIRouter(prefix="/grades", tags=["grades"])


@router.get("", response_model=list[GradeOverview])
def get_grades(
    db: DatabaseSession,
    actor: GradeManagerDependency,
    q: str | None = Query(default=None),
    class_id: UUID | None = Query(default=None),
    subject_id: UUID | None = Query(default=None),
    reporting_period_id: UUID | None = Query(default=None),
) -> list[dict]:
    """Liste les notes visibles par le compte connecté."""

    return list_grades(
        db=db,
        actor=actor,
        q=q,
        class_id=class_id,
        subject_id=subject_id,
        reporting_period_id=reporting_period_id,
    )


@router.get("/options", response_model=GradeOptionsResponse)
def get_grades_options(
    db: DatabaseSession,
    actor: GradeManagerDependency,
    class_id: UUID | None = Query(default=None),
    subject_id: UUID | None = Query(default=None),
    assessment_id: UUID | None = Query(default=None),
) -> dict:
    """Retourne les choix compatibles avec les droits et la sélection."""

    return get_grade_options(
        db=db,
        actor=actor,
        class_id=class_id,
        subject_id=subject_id,
        assessment_id=assessment_id,
    )


@router.post("", response_model=GradeOverview, status_code=status.HTTP_201_CREATED)
def post_grade(
    grade_data: GradeCreate,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Enregistre le résultat d'un élève pour une évaluation."""

    try:
        return create_grade(db=db, actor=actor, grade_data=grade_data)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cette note existe déjà ou ne respecte pas le barème, "
                "la classe ou la date de l'évaluation."
            ),
        ) from error
