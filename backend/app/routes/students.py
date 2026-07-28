"""Routes HTTP pour consulter et rechercher les élèves (lecture seule)."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.services.student_service import list_students, get_student
from app.schemas.student_response import StudentResponse


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
