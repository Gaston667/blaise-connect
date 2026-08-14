"""Routes des appréciations de période avant génération du bulletin."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.core.authentication import DatabaseSession
from app.core.grade_authorization import GradeManagerDependency
from app.schemas.appreciation_save import OverallAppreciationSave, SubjectAppreciationSave
from app.services.appreciation_service import (
    get_appreciation_contexts,
    get_overall_appreciations,
    get_subject_appreciations,
    save_overall_appreciation,
    save_subject_appreciation,
)


router = APIRouter(prefix="/appreciations", tags=["appreciations"])


def raise_appreciation_error(error: Exception) -> None:
    """Transforme les erreurs métier en réponses HTTP compréhensibles."""

    if isinstance(error, LookupError):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, PermissionError):
        raise HTTPException(status_code=403, detail=str(error)) from error
    raise HTTPException(status_code=409, detail=str(error)) from error


@router.get("/contexts")
def get_contexts(db: DatabaseSession, actor: GradeManagerDependency) -> list[dict]:
    """Liste les matières/classes/périodes utilisables par le compte connecté."""

    return get_appreciation_contexts(db=db, actor=actor)


@router.get("/subject")
def get_subject_rows(
    db: DatabaseSession,
    actor: GradeManagerDependency,
    class_subject_id: UUID = Query(...),
    reporting_period_id: UUID = Query(...),
) -> list[dict]:
    """Charge les élèves et leurs appréciations pour une matière."""

    try:
        return get_subject_appreciations(db, actor, class_subject_id, reporting_period_id)
    except (LookupError, PermissionError, ValueError) as error:
        raise_appreciation_error(error)


@router.put("/subject/{student_enrollment_id}")
def put_subject_appreciation(
    student_enrollment_id: UUID,
    data: SubjectAppreciationSave,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Crée ou met à jour une appréciation de matière."""

    try:
        return save_subject_appreciation(db, actor, student_enrollment_id, data)
    except (LookupError, PermissionError, ValueError) as error:
        raise_appreciation_error(error)


@router.get("/overall")
def get_overall_rows(
    db: DatabaseSession,
    actor: GradeManagerDependency,
    class_id: UUID = Query(...),
    reporting_period_id: UUID = Query(...),
) -> list[dict]:
    """Charge les appréciations générales d'une classe."""

    try:
        return get_overall_appreciations(db, actor, class_id, reporting_period_id)
    except (LookupError, PermissionError, ValueError) as error:
        raise_appreciation_error(error)


@router.put("/overall/{student_enrollment_id}")
def put_overall_appreciation(
    student_enrollment_id: UUID,
    data: OverallAppreciationSave,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> dict:
    """Crée ou met à jour une appréciation générale."""

    try:
        return save_overall_appreciation(db, actor, student_enrollment_id, data)
    except (LookupError, PermissionError, ValueError) as error:
        raise_appreciation_error(error)
