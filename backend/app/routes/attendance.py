"""Routes securisees de gestion de l'assiduite."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.core.authentication import (
    CurrentAccountDependency,
    CurrentAdminDependency,
    CurrentStaffDependency,
    DatabaseSession,
)
from app.core.student_self import CurrentStudentDependency
from app.schemas.attendance_change_request_create import AttendanceChangeRequestCreate
from app.schemas.attendance_change_request_review import AttendanceChangeRequestReview
from app.schemas.attendance_event_create import AttendanceEventCreate
from app.schemas.attendance_justification_review import AttendanceJustificationReview
from app.schemas.attendance_record_update import AttendanceRecordUpdate
from app.schemas.attendance_record_delete import AttendanceRecordDelete
from app.services.attendance_document_service import (
    get_attendance_document_file,
    list_attendance_documents,
    upload_attendance_justification,
)
from app.services.attendance_service import (
    create_attendance_change_request,
    create_attendance_event,
    delete_attendance_record,
    get_attendance_event,
    get_attendance_record_detail,
    get_student_attendance,
    list_attendance_change_requests,
    list_attendance_events,
    list_attendance_options,
    list_attendance_records,
    list_attendance_roster,
    review_attendance_change_request,
    review_attendance_justification,
    update_attendance_record,
)


router = APIRouter(prefix="/attendance", tags=["attendance"])


def _raise_service_error(error: Exception) -> None:
    """Traduit les erreurs metier en reponses HTTP explicites."""

    if isinstance(error, LookupError):
        code = status.HTTP_404_NOT_FOUND
    elif isinstance(error, PermissionError):
        code = status.HTTP_403_FORBIDDEN
    else:
        code = status.HTTP_409_CONFLICT
    raise HTTPException(status_code=code, detail=str(error)) from error


@router.get("/options")
def get_options(db: DatabaseSession, current_staff: CurrentStaffDependency):
    """Liste les affectations utilisables pour effectuer un appel."""

    return list_attendance_options(db, current_staff)


@router.get("/roster")
def get_roster(
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
    assignment_id: UUID = Query(...),
    attendance_date: date = Query(...),
):
    """Liste les eleves inscrits dans la classe a une date."""

    try:
        return list_attendance_roster(db, current_staff, assignment_id, attendance_date)
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.post("/events", status_code=status.HTTP_201_CREATED)
def post_event(
    event_data: AttendanceEventCreate,
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
):
    """Enregistre un appel complet en une transaction."""

    try:
        return create_attendance_event(db, current_staff, event_data)
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.get("/events")
def get_events(
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
    class_id: UUID | None = Query(default=None),
    attendance_date: date | None = Query(default=None),
):
    """Liste les appels visibles par le personnel."""

    return list_attendance_events(db, current_staff, class_id, attendance_date)


@router.get("/events/{event_id}")
def get_event(
    event_id: UUID,
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
):
    """Retourne la feuille d'appel complete."""

    try:
        return get_attendance_event(db, current_staff, event_id)
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.get("/records")
def get_records(
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
    event_id: UUID | None = Query(default=None),
    justification_status: str | None = Query(default=None),
):
    """Liste les absences et retards visibles."""

    return list_attendance_records(
        db, current_staff, event_id, justification_status
    )


@router.get("/records/{record_id}/detail")
def get_record_detail(
    record_id: UUID,
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
):
    """Affiche les informations complètes d'une absence ou d'un retard."""

    try:
        detail = get_attendance_record_detail(db, current_account, record_id)
        detail["documents"] = list_attendance_documents(
            db, current_account, record_id
        )
        return detail
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.patch("/records/{record_id}")
def patch_record(
    record_id: UUID,
    update_data: AttendanceRecordUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Corrige directement un incident avec audit."""

    try:
        return update_attendance_record(db, current_admin, record_id, update_data)
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.post("/records/{record_id}/delete")
def post_delete_record(
    record_id: UUID,
    delete_data: AttendanceRecordDelete,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Supprime logiquement un incident avec un motif audite."""

    try:
        return delete_attendance_record(
            db, current_admin, record_id, delete_data.change_reason
        )
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.post("/records/{record_id}/change-requests", status_code=status.HTTP_201_CREATED)
def post_change_request(
    record_id: UUID,
    request_data: AttendanceChangeRequestCreate,
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
):
    """Signale une correction sans modifier directement l'incident."""

    try:
        return create_attendance_change_request(
            db, current_account, record_id, request_data
        )
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.get("/change-requests")
def get_change_requests(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    request_status: str | None = Query(default=None, alias="status"),
):
    """Liste les signalements a traiter."""

    return list_attendance_change_requests(db, current_admin, request_status)


@router.patch("/change-requests/{request_id}")
def patch_change_request(
    request_id: UUID,
    review: AttendanceChangeRequestReview,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Approuve ou rejette un signalement enseignant."""

    try:
        return review_attendance_change_request(
            db, current_admin, request_id, review
        )
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.patch("/records/{record_id}/justification")
def patch_justification(
    record_id: UUID,
    review: AttendanceJustificationReview,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Valide ou rejette un justificatif eleve."""

    try:
        return review_attendance_justification(
            db, current_admin, record_id, review.status, review.review_comment
        )
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.get("/records/{record_id}/documents")
def get_documents(
    record_id: UUID,
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
):
    """Liste les justificatifs autorises d'un incident."""

    try:
        return list_attendance_documents(db, current_account, record_id)
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)


@router.get("/records/{record_id}/documents/{document_id}/content")
def get_document_content(
    record_id: UUID,
    document_id: UUID,
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
):
    """Sert un justificatif prive apres controle de la session."""

    try:
        path, mime_type, filename = get_attendance_document_file(
            db, current_account, record_id, document_id
        )
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)
    return FileResponse(path=path, media_type=mime_type, filename=filename)


@router.get("/me")
def get_my_attendance(
    db: DatabaseSession,
    current_student: CurrentStudentDependency,
):
    """Retourne a l'eleve ses propres absences et retards."""

    return get_student_attendance(db, current_student.id)


@router.post("/me/{record_id}/justification", status_code=status.HTTP_201_CREATED)
def post_my_justification(
    record_id: UUID,
    db: DatabaseSession,
    current_student: CurrentStudentDependency,
    current_account: CurrentAccountDependency,
    reason: str = Form(...),
    document: UploadFile | None = File(default=None),
):
    """Permet a l'eleve de justifier son propre incident."""

    try:
        return upload_attendance_justification(
            db, current_account, record_id, reason, document
        )
    except (LookupError, PermissionError, ValueError) as error:
        _raise_service_error(error)
