"""Routes HTTP pour consulter et rechercher les élèves (lecture seule)."""

"""Routes HTTP pour consulter et créer des élèves."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.account_already_exists_error import AccountAlreadyExistsError
from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.services.student_service import list_students, get_student, create_student
from app.schemas.student_response import StudentResponse
from app.schemas.student_create import StudentCreate


router = APIRouter(
    prefix="/students",
    tags=["students"],
)


@router.get("/", response_model=List[StudentResponse])
def read_students(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
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
    current_admin: CurrentAdminDependency,
):
    """Détail lecture seule d'un élève."""

    student = get_student(db=db, student_id=student_id)

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return student
@router.post("/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def post_student(
    student_data: StudentCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Crée un nouvel élève (compte + profil + inscription optionnelle)."""
    try:
        student = create_student(db=db, data=student_data)
    except AccountAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte utilise déjà ce matricule.",
        ) from error
    return student