"""Service métier minimal pour la consultation des étudiants."""

from typing import Iterable
from sqlalchemy.orm import Session
from sqlalchemy import or_, select, text, func

from app.schemas.student_update import StudentUpdate
from app.schemas.student_create import StudentCreate
from app.models.student import Student
from app.models.account import Account
from app.core.account_already_exists_error import AccountAlreadyExistsError
from app.core.security import hash_password
from app.services.account_service import find_account_by_registration_number


def list_students(
    db: Session,
    q: str | None = None,
    status: str | None = None,
    class_id: str | None = None,
    school_year_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> Iterable[dict]:
    """Retourne une liste d'étudiants filtrée par recherche et statut.

    - `q` recherche dans le prénom, nom ou matricule d'un compte associé.
    - `status` filtre sur la colonne `status` si fourni.
    """

    sql = text(
        """
        SELECT
            s.id,
            s.account_id,
            a.registration_number,
            s.first_name,
            s.last_name,
            s.birth_date,
            s.birth_place,
            s.gender,
            s.nationality,
            s.email,
            s.phone,
            s.address,
            s.previous_level,
            s.admission_date,
            s.status,
            s.photo_path,
            s.observations,
            s.internal_code,
            s.archived_at,
            s.created_at,
            s.updated_at,
            se.class_id as class_id,
            c.school_year_id as school_year_id
        FROM students s
        LEFT JOIN accounts a ON s.account_id = a.id
        LEFT JOIN LATERAL (
            SELECT class_id FROM student_enrollments se
            WHERE se.student_id = s.id AND se.end_date IS NULL
            LIMIT 1
        ) se ON true
        LEFT JOIN classes c ON se.class_id = c.id
        WHERE 1 = 1
        """
    )

    params: dict = {"limit": limit, "offset": offset}
    where_clauses: list[str] = []

    if q:
        params["q"] = f"%{q}%"
        where_clauses.append("(s.first_name ILIKE :q OR s.last_name ILIKE :q OR a.registration_number ILIKE :q)")

    if status:
        params["status"] = status
        where_clauses.append("s.status = :status")

    if class_id:
        params["class_id"] = class_id
        where_clauses.append("se.class_id = :class_id")

    if school_year_id:
        params["school_year_id"] = school_year_id
        where_clauses.append("c.school_year_id = :school_year_id")

    if where_clauses:
        sql = text(str(sql) + " AND " + " AND ".join(where_clauses))

    sql = text(str(sql) + " ORDER BY s.last_name, s.first_name LIMIT :limit OFFSET :offset")

    rows = db.execute(sql, params).all()

    results: list[dict] = []
    for row in rows:
        record = {
            'id': row.id,
            'account_id': row.account_id,
            'registration_number': row.registration_number,
            'first_name': row.first_name,
            'last_name': row.last_name,
            'birth_date': row.birth_date,
            'birth_place': row.birth_place,
            'gender': row.gender,
            'nationality': row.nationality,
            'email': row.email,
            'phone': row.phone,
            'address': row.address,
            'previous_level': row.previous_level,
            'admission_date': row.admission_date,
            'status': row.status,
            'photo_path': row.photo_path,
            'observations': row.observations,
            'internal_code': row.internal_code,
            'archived_at': row.archived_at,
            'created_at': row.created_at,
            'updated_at': row.updated_at,
            'class_id': row.class_id,
            'school_year_id': row.school_year_id,
        }
        results.append(record)

    return results


def get_student(db: Session, student_id):
    """Renvoie un étudiant par `id` ou `None` si absent. Retourne un dict
    contenant les mêmes champs que `list_students` fournit.
    """

    sql = text(
        """
        SELECT
            s.id,
            s.account_id,
            a.registration_number,
            s.first_name,
            s.last_name,
            s.birth_date,
            s.birth_place,
            s.gender,
            s.nationality,
            s.email,
            s.phone,
            s.address,
            s.previous_level,
            s.admission_date,
            s.status,
            s.photo_path,
            s.observations,
            s.internal_code,
            s.archived_at,
            s.created_at,
            s.updated_at,
            se.class_id as class_id,
            c.school_year_id as school_year_id
        FROM students s
        LEFT JOIN accounts a ON s.account_id = a.id
        LEFT JOIN LATERAL (
            SELECT class_id FROM student_enrollments se
            WHERE se.student_id = s.id AND se.end_date IS NULL
            LIMIT 1
        ) se ON true
        LEFT JOIN classes c ON se.class_id = c.id
        WHERE s.id = :student_id
        """
    )

    row = db.execute(sql, {"student_id": student_id}).first()
    if not row:
        return None

    return {
        'id': row.id,
        'account_id': row.account_id,
        'registration_number': row.registration_number,
        'first_name': row.first_name,
        'last_name': row.last_name,
        'birth_date': row.birth_date,
        'birth_place': row.birth_place,
        'gender': row.gender,
        'nationality': row.nationality,
        'email': row.email,
        'phone': row.phone,
        'address': row.address,
        'previous_level': row.previous_level,
        'admission_date': row.admission_date,
        'status': row.status,
        'photo_path': row.photo_path,
        'observations': row.observations,
        'internal_code': row.internal_code,
        'archived_at': row.archived_at,
        'created_at': row.created_at,
        'updated_at': row.updated_at,
        'class_id': row.class_id,
        'school_year_id': row.school_year_id,
    }


def create_student(db: Session, data: StudentCreate) -> dict:
    """Crée un compte élève, son profil, et l'inscrit dans une classe si fournie."""

    existing_account = find_account_by_registration_number(
        db=db, registration_number=data.registration_number
    )
    if existing_account is not None:
        raise AccountAlreadyExistsError(data.registration_number)

    password_hash = hash_password(data.password.get_secret_value())
    account = Account(
        registration_number=data.registration_number,
        password_hash=password_hash,
        role="STUDENT",
    )
    db.add(account)
    db.flush()

    student = Student(
        account_id=account.id,
        first_name=data.first_name,
        last_name=data.last_name,
        birth_date=data.birth_date,
        gender=data.gender,
        email=data.email,
        phone=data.phone,
        address=data.address,
        admission_date=data.admission_date,
    )
    db.add(student)
    db.flush()

    if data.class_id:
        start_date = data.enrollment_start_date or data.admission_date
        db.execute(
            text(
                "INSERT INTO student_enrollments (student_id, class_id, start_date) "
                "VALUES (:student_id, :class_id, :start_date)"
            ),
            {
                "student_id": str(student.id),
                "class_id": data.class_id,
                "start_date": start_date,
            },
        )

    db.commit()

    return get_student(db=db, student_id=str(student.id))


def _apply_status_change(db: Session, student_id: str, new_status: str, admin_account_id, require_current: list[str] | None = None):
    student = db.get(Student, student_id)
    if not student:
        return None

    if require_current and student.status not in require_current:
        raise ValueError(
            f"Transition invalide : l'élève est actuellement '{student.status}'."
        )

    student.status = new_status
    student.archived_at = func.now() if new_status == "ARCHIVED" else None
    student.updated_by_account_id = admin_account_id
    db.commit()
    return get_student(db=db, student_id=str(student_id))


def update_student(db: Session, student_id: str, data: StudentUpdate, admin_account_id) -> dict | None:
    """Met à jour les champs fournis sur la fiche d'un élève."""
    student = db.get(Student, student_id)
    if not student:
        return None

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(student, field, value)

    student.updated_by_account_id = admin_account_id
    db.commit()
    return get_student(db=db, student_id=str(student_id))


def archive_student(db: Session, student_id: str, admin_account_id) -> dict | None:
    """Archive un élève (statut terminal)."""
    return _apply_status_change(db, student_id, "ARCHIVED", admin_account_id)


def deactivate_student(db: Session, student_id: str, admin_account_id) -> dict | None:
    """Désactive temporairement un élève actif."""
    return _apply_status_change(db, student_id, "INACTIVE", admin_account_id, require_current=["ACTIVE"])


def reactivate_student(db: Session, student_id: str, admin_account_id) -> dict | None:
    """Réactive un élève inactif ou archivé."""
    return _apply_status_change(db, student_id, "ACTIVE", admin_account_id, require_current=["INACTIVE", "ARCHIVED"])
def get_student_status_history(db: Session, student_id: str) -> list[dict]:
    """Retourne l'historique des changements de statut d'un élève, plus récent en premier."""
    sql = text(
        """
        SELECT h.status, h.changed_at, h.note, a.registration_number as changed_by
        FROM student_status_history h
        LEFT JOIN accounts a ON h.changed_by_account_id = a.id
        WHERE h.student_id = :student_id
        ORDER BY h.changed_at DESC
        """
    )
    rows = db.execute(sql, {"student_id": student_id}).all()
    return [
        {
            "status": row.status,
            "changed_at": row.changed_at,
            "note": row.note,
            "changed_by": row.changed_by,
        }
        for row in rows
    ]