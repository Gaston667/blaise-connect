"""Routes HTTP de consultation et de saisie des notes."""

from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.exc import IntegrityError

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.core.grade_authorization import GradeManagerDependency
from app.schemas.grade_create import GradeCreate
from app.schemas.grade_options_response import GradeOptionsResponse
from app.schemas.grade_overview import GradeOverview
from app.schemas.grade_absence_review import GradeAbsenceReview
from app.schemas.grade_document_response import GradeDocumentResponse
from app.services.grade_justification_service import (
    get_grade_document_file,
    list_grade_documents,
    upload_grade_justification,
)
from app.services.grade_service import (
    create_grade,
    get_grade_options,
    list_grades,
    review_grade_absence,
)


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


@router.patch("/{grade_id}/absence-review", response_model=GradeOverview)
def patch_grade_absence_review(
    grade_id: UUID,
    review: GradeAbsenceReview,
    db: DatabaseSession,
    admin: CurrentAdminDependency,
) -> dict:
    """Valide ou rejette le justificatif d'une absence d'évaluation."""

    try:
        return review_grade_absence(
            db=db,
            admin=admin,
            grade_id=grade_id,
            justification_status=review.justification_status,
        )
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("/{grade_id}/documents", response_model=list[GradeDocumentResponse])
def get_grade_documents(
    grade_id: UUID,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> list[dict]:
    """Liste les justificatifs d'une absence autorisée."""

    try:
        return list_grade_documents(db=db, actor=actor, grade_id=grade_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("/{grade_id}/documents/{document_id}/content")
def get_grade_document_content(
    grade_id: UUID,
    document_id: UUID,
    db: DatabaseSession,
    actor: GradeManagerDependency,
) -> FileResponse:
    """Télécharge un justificatif après vérification des droits métier."""

    try:
        file_path, mime_type, original_filename = get_grade_document_file(
            db=db,
            actor=actor,
            grade_id=grade_id,
            document_id=document_id,
        )
        return FileResponse(
            path=file_path,
            media_type=mime_type,
            filename=original_filename,
        )
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post(
    "/{grade_id}/documents",
    response_model=GradeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_grade_document(
    grade_id: UUID,
    db: DatabaseSession,
    actor: GradeManagerDependency,
    document: UploadFile = File(...),
) -> dict:
    """Ajoute un justificatif et place l'absence en attente de validation."""

    try:
        return upload_grade_justification(
            db=db,
            actor=actor,
            grade_id=grade_id,
            upload=document,
        )
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
