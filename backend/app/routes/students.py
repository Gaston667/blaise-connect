"""Routes HTTP de consultation et de gestion des élèves."""
from typing import List
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import text
from app.schemas.student_update import StudentUpdate
from app.services.student_service import update_student, archive_student, deactivate_student, reactivate_student
from app.core.authentication import CurrentAdminDependency, CurrentStaffDependency, DatabaseSession
from app.services.student_service import list_students, get_student
from app.schemas.student_response import StudentResponse
from app.services.student_service import get_student_status_history
from app.schemas.student_enrollment_create import StudentEnrollmentCreate
from app.services.student_service import enroll_student
from app.schemas.student_academic_summary import StudentAcademicSummary
from app.services.academic_calculation_service import get_student_academic_summary


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
    """Retourne les notes, moyennes et absences calculées côté backend.
    Un enseignant ne peut consulter la scolarité que des élèves dont il est
    le professeur principal."""

    if current_staff.role == "TEACHER":
        teacher_id = _resolve_own_teacher_id(db, current_staff.id)
        if teacher_id is None or not _is_main_teacher_of_student(db, teacher_id, student_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous n'êtes pas le professeur principal de cet élève.",
            )

    summary = get_student_academic_summary(db=db, student_id=student_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Élève introuvable.")
    return summary


@router.post("/{student_id}/enroll", response_model=StudentResponse)
def post_student_enrollment(
    student_id: str,
    enrollment_data: StudentEnrollmentCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Inscrit un élève existant dans une classe annuelle."""

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
            detail="Élève introuvable.",
        )
    return student


@router.get("/", response_model=List[StudentResponse])
def read_students(
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
    q: str | None = Query(None, description="Recherche par nom, prénom ou matricule"),
    status: str | None = Query(None, description="Filtrer par statut : ACTIVE, INACTIVE, ARCHIVED"),
    class_id: str | None = Query(None, description="Filtrer par classe id"),
    school_year_id: str | None = Query(None, description="Filtrer par année scolaire id"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Liste et recherche basique des étudiants."""

    students = list_students(
        db=db,
        q=q,
        status=status,
        class_id=class_id,
        school_year_id=school_year_id,
        limit=limit,
        offset=offset,
    )

    return students


@router.get("/{student_id}", response_model=StudentResponse)
def read_student(
    student_id: str,
    db: DatabaseSession,
    current_staff: CurrentStaffDependency,
):
    """Détail lecture seule d'un élève."""

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
    """Met à jour les informations d'un élève."""
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
    """Archive un élève."""
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
    """Désactive un élève actif."""
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
    """Réactive un élève inactif ou archivé."""
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
    """Historique des changements de statut d'un élève."""
    return get_student_status_history(db=db, student_id=student_id)
