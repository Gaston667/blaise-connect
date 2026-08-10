"""Routes HTTP de consultation et de gestion des eleves."""

from uuid import UUID
from app.schemas.student_specialties_update import (
    StudentSpecialtiesUpdate,
)


from app.services.student_specialty_service import (
    list_available_student_specialties,
    list_student_specialties,
    update_student_specialties,
)


from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import text

from app.core.authentication import (
    CurrentAdminDependency,
    CurrentStaffDependency,
    DatabaseSession,
)
from app.schemas.student_academic_summary import StudentAcademicSummary
from app.schemas.student_enrollment_create import StudentEnrollmentCreate
from app.schemas.student_response import StudentListResponse, StudentResponse
from app.schemas.student_update import StudentUpdate
from app.services.academic_calculation_service import get_student_academic_summary
from app.services.student_document_service import (
    archive_student_document,
    get_student_document_file,
    list_student_documents,
    upload_student_document,
)
from app.services.student_service import (
    archive_student,
    count_students,
    deactivate_student,
    enroll_student,
    get_student,
    get_student_status_history,
    list_students,
    reactivate_student,
    update_student,
)


router = APIRouter(
    prefix="/students",
    tags=["students"],
)


def _resolve_own_teacher_id(db: DatabaseSession, account_id) -> str | None:
    row = db.execute(
        text("SELECT id FROM teachers WHERE account_id = :account_id"),
        {"account_id": account_id},
    ).first()
    return str(row.id) if row else None


def _is_main_teacher_of_student(db: DatabaseSession, teacher_id: str, student_id) -> bool:
    row = db.execute(
        text(
            """
            SELECT 1
            FROM student_enrollments AS enrollment
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            WHERE enrollment.student_id = :student_id
              AND enrollment.end_date IS NULL
              AND school_class.main_teacher_id = :teacher_id
            """
        ),
        {"student_id": str(student_id), "teacher_id": teacher_id},
    ).first()
    return row is not None


@router.get("/{student_id}/academic-summary", response_model=StudentAcademicSummary)
def get_student_academic_summary_route(
    student_id: UUID,
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
) -> dict:
    """Retourne les notes, moyennes et absences calculees cote backend."""

    if current_staff.role == "TEACHER":
        teacher_id = _resolve_own_teacher_id(db, current_staff.id)
        if teacher_id is None or not _is_main_teacher_of_student(db, teacher_id, student_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous n'etes pas le professeur principal de cet eleve.",
            )

    summary = get_student_academic_summary(db=db, student_id=student_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Eleve introuvable.")
    return summary


@router.post("/{student_id}/enroll", response_model=StudentResponse)
def post_student_enrollment(
    student_id: str,
    enrollment_data: StudentEnrollmentCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Inscrit un eleve existant dans une classe annuelle."""

    try:
        student = enroll_student(
            db=db,
            student_id=student_id,
            enrollment_data=enrollment_data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Eleve introuvable.",
        )
    return student


@router.get("/", response_model=StudentListResponse)
def read_students(
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
    q: str | None = Query(None, description="Recherche par nom, prenom ou matricule"),
    status: str | None = Query(None, description="Filtrer par statut : ACTIVE, INACTIVE, ARCHIVED"),
    class_id: str | None = Query(None, description="Filtrer par classe id"),
    school_year_id: str | None = Query(None, description="Filtrer par annee scolaire id"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Liste et recherche basique des eleves."""

    students = list_students(
        db=db,
        q=q,
        status=status,
        class_id=class_id,
        school_year_id=school_year_id,
        limit=limit,
        offset=offset,
    )

    return {
        "items": students,
        "total": count_students(
            db=db,
            q=q,
            status=status,
            class_id=class_id,
            school_year_id=school_year_id,
        ),
    }


@router.get("/{student_id}", response_model=StudentResponse)
def read_student(
    student_id: str,
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
):
    """Detail lecture seule d'un eleve."""

    student = get_student(db=db, student_id=student_id)

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    viewer_is_main_teacher = False
    if current_staff.role == "TEACHER":
        teacher_id = _resolve_own_teacher_id(db, current_staff.id)
        viewer_is_main_teacher = (
            teacher_id is not None and str(student.get("class_main_teacher_id")) == teacher_id
        )
    student["viewer_is_main_teacher"] = viewer_is_main_teacher
    return student


@router.patch("/{student_id}", response_model=StudentResponse)
def patch_student(
    student_id: str,
    data: StudentUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Met a jour les informations d'un eleve."""

    student = update_student(db=db, student_id=student_id, data=data, admin_account_id=current_admin.id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("/{student_id}/archive", response_model=StudentResponse)
def post_archive_student(
    student_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Archive un eleve."""

    try:
        student = archive_student(db=db, student_id=student_id, admin_account_id=current_admin.id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("/{student_id}/deactivate", response_model=StudentResponse)
def post_deactivate_student(
    student_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Desactive un eleve actif."""

    try:
        student = deactivate_student(db=db, student_id=student_id, admin_account_id=current_admin.id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("/{student_id}/reactivate", response_model=StudentResponse)
def post_reactivate_student(
    student_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Reactive un eleve inactif ou archive."""

    try:
        student = reactivate_student(db=db, student_id=student_id, admin_account_id=current_admin.id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.get("/{student_id}/status-history")
def get_status_history(
    student_id: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Historique des changements de statut d'un eleve."""

    return get_student_status_history(db=db, student_id=student_id)


@router.get("/{student_id}/documents")
def get_student_documents(
    student_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Liste les documents actifs associes au dossier de l'eleve."""

    try:
        return list_student_documents(
            db=db,
            student_id=student_id,
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.post(
    "/{student_id}/documents",
    status_code=status.HTTP_201_CREATED,
)
def post_student_document(
    student_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    title: str = Form(...),
    document_type_code: str = Form(...),
    document: UploadFile = File(...),
):
    """Televerse un document general dans le dossier de l'eleve."""

    try:
        return upload_student_document(
            db=db,
            actor=current_admin,
            student_id=student_id,
            title=title,
            document_type_code=document_type_code,
            upload=document,
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.get(
    "/{student_id}/documents/{document_id}/content",
    response_class=FileResponse,
)
def get_student_document_content(
    student_id: UUID,
    document_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Telecharge ou affiche un document de l'eleve."""

    try:
        physical_path, mime_type, original_filename = (
            get_student_document_file(
                db=db,
                student_id=student_id,
                document_id=document_id,
            )
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    return FileResponse(
        path=physical_path,
        media_type=mime_type,
        filename=original_filename,
    )


@router.post(
    "/{student_id}/documents/{document_id}/archive",
    status_code=status.HTTP_204_NO_CONTENT,
)
def post_archive_student_document(
    student_id: UUID,
    document_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Archive un document du dossier eleve."""

    try:
        archive_student_document(
            db=db,
            student_id=student_id,
            document_id=document_id,
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    return None

@router.get("/{student_id}/specialties")
def get_student_specialties_route(
    student_id: UUID,
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
):
    """Retourne les spécialités de l'inscription actuelle."""

    try:
        return list_student_specialties(
            db=db,
            student_id=student_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@router.get("/{student_id}/available-specialties")
def get_available_student_specialties_route(
    student_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Retourne les spécialités proposées dans la classe actuelle."""

    try:
        return list_available_student_specialties(
            db=db,
            student_id=student_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    


@router.put("/{student_id}/specialties")
def put_student_specialties(
    student_id: UUID,
    data: StudentSpecialtiesUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Remplace les spécialités de l'inscription annuelle actuelle."""

    try:
        return update_student_specialties(
            db=db,
            student_id=student_id,
            subject_ids=data.subject_ids,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

