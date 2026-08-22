"""Service métier de consultation et de gestion des élèves."""

from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.student import Student
from app.schemas.student_enrollment_create import StudentEnrollmentCreate
from app.schemas.student_update import StudentUpdate
from app.services.guardian_service import list_guardians_for_student


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
            s.previous_establishment,
            s.medical_condition,
            s.is_enrolled_in_cned,
            s.admission_date,
            s.status,
            s.photo_path,
            s.archived_at,
            s.created_at,
            s.updated_at,
            se.class_id as class_id,
            c.main_teacher_id as class_main_teacher_id,
            c.school_year_id as school_year_id,
            CONCAT_WS(' ', cl.name, NULLIF(c.group_label, '')) AS class_name,
            sy.name AS school_year_name
        FROM students s
        LEFT JOIN accounts a ON s.account_id = a.id
        LEFT JOIN LATERAL (
            SELECT class_id FROM student_enrollments se
            WHERE se.student_id = s.id AND se.end_date IS NULL
            LIMIT 1
        ) se ON true
        LEFT JOIN classes c ON se.class_id = c.id
        LEFT JOIN class_levels cl ON c.class_level_id = cl.id
        LEFT JOIN school_years sy ON c.school_year_id = sy.id
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
            'previous_establishment': row.previous_establishment,
            'medical_condition': row.medical_condition,
            'is_enrolled_in_cned': row.is_enrolled_in_cned,
            'admission_date': row.admission_date,
            'status': row.status,
            'photo_path': row.photo_path,
            'archived_at': row.archived_at,
            'created_at': row.created_at,
            'updated_at': row.updated_at,
            'class_id': row.class_id,
            'school_year_id': row.school_year_id,
            'class_name': row.class_name,
            'school_year_name': row.school_year_name,
        }
        results.append(record)

    return results


def count_students(
    db: Session,
    q: str | None = None,
    status: str | None = None,
    class_id: str | None = None,
    school_year_id: str | None = None,
) -> int:
    """Compte les élèves correspondant aux mêmes filtres que la liste paginée."""

    where_clauses: list[str] = ["1 = 1"]
    params: dict = {}

    if q:
        params["q"] = f"%{q}%"
        where_clauses.append(
            "(s.first_name ILIKE :q OR s.last_name ILIKE :q OR a.registration_number ILIKE :q)"
        )
    if status:
        params["status"] = status
        where_clauses.append("s.status = :status")
    if class_id:
        params["class_id"] = class_id
        where_clauses.append("se.class_id = :class_id")
    if school_year_id:
        params["school_year_id"] = school_year_id
        where_clauses.append("c.school_year_id = :school_year_id")

    query = text(
        """
        SELECT COUNT(*)
        FROM students AS s
        LEFT JOIN accounts AS a ON a.id = s.account_id
        LEFT JOIN LATERAL (
            SELECT class_id
            FROM student_enrollments
            WHERE student_id = s.id AND end_date IS NULL
            LIMIT 1
        ) AS se ON true
        LEFT JOIN classes AS c ON c.id = se.class_id
        WHERE """
        + " AND ".join(where_clauses)
    )
    return db.execute(query, params).scalar_one()


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
            s.previous_establishment,
            s.medical_condition,
            s.is_enrolled_in_cned,
            s.admission_date,
            s.status,
            s.photo_path,
            s.archived_at,
            s.created_at,
            s.updated_at,
            se.class_id as class_id,
            c.main_teacher_id as class_main_teacher_id,
            c.school_year_id as school_year_id,
            CONCAT_WS(' ', cl.name, NULLIF(c.group_label, '')) AS class_name,
            sy.name AS school_year_name
        FROM students s
        LEFT JOIN accounts a ON s.account_id = a.id
        LEFT JOIN LATERAL (
            SELECT class_id FROM student_enrollments se
            WHERE se.student_id = s.id AND se.end_date IS NULL
            LIMIT 1
        ) se ON true
        LEFT JOIN classes c ON se.class_id = c.id
        LEFT JOIN class_levels cl ON c.class_level_id = cl.id
        LEFT JOIN school_years sy ON c.school_year_id = sy.id
        WHERE s.id = :student_id
        """
    )

    row = db.execute(sql, {"student_id": student_id}).first()
    if not row:
        return None
    guardians = list_guardians_for_student(db=db, student_id=str(student_id))   
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
        'previous_establishment': row.previous_establishment,
        'medical_condition': row.medical_condition,
        'is_enrolled_in_cned': row.is_enrolled_in_cned,
        'admission_date': row.admission_date,
        'status': row.status,
        'photo_path': row.photo_path,
        'archived_at': row.archived_at,
        'created_at': row.created_at,
        'updated_at': row.updated_at,
        'class_id': row.class_id,
        'class_main_teacher_id': row.class_main_teacher_id,
        'class_name': row.class_name,
        'guardians': guardians,
        'school_year_id': row.school_year_id,
        'school_year_name': row.school_year_name,
    }


def enroll_student(
    db: Session,
    student_id: str,
    enrollment_data: StudentEnrollmentCreate,
) -> dict | None:
    """Inscrit un élève ou le change de classe dans une année ouverte."""

    student = db.get(Student, student_id)
    if student is None:
        return None

    open_enrollment = db.execute(
        text(
            """
                        SELECT id, class_id, start_date
            FROM student_enrollments
            WHERE student_id = :student_id
              AND end_date IS NULL
            """
        ),
        {"student_id": student_id},
    ).first()
    school_class = db.execute(
        text(
            """
            SELECT c.id, sy.start_date, sy.end_date, sy.closed_at,
                   cl.code AS level_code
            FROM classes AS c
            JOIN school_years AS sy ON sy.id = c.school_year_id
            JOIN class_levels AS cl ON cl.id = c.class_level_id
            WHERE c.id = :class_id
            """
        ),
        {"class_id": str(enrollment_data.class_id)},
    ).first()
    if school_class is None:
        raise ValueError("La classe sélectionnée est introuvable.")
    if school_class.closed_at is not None:
        raise ValueError("L'année scolaire de cette classe est clôturée.")
    if not school_class.start_date <= enrollment_data.start_date <= school_class.end_date:
        raise ValueError("La date d'inscription doit appartenir à l'année scolaire.")

    from app.services.student_specialty_service import (
        validate_specialty_selection_for_class,
    )

    validate_specialty_selection_for_class(
        db=db,
        class_id=enrollment_data.class_id,
        level_code=school_class.level_code,
        subject_ids=enrollment_data.specialty_subject_ids,
    )

    if open_enrollment is not None:
        if str(open_enrollment.class_id) == str(enrollment_data.class_id):
            raise ValueError("Cet élève est déjà inscrit dans cette classe.")
        if enrollment_data.start_date <= open_enrollment.start_date:
            raise ValueError(
                "La date de changement de classe doit être postérieure au début de l'inscription en cours."
            )

        db.execute(
            text(
                """
                UPDATE student_enrollments
                SET end_date = :end_date,
                    end_reason = 'CLASS_CHANGE'
                WHERE id = :enrollment_id
                """
            ),
            {
                "enrollment_id": open_enrollment.id,
                "end_date": enrollment_data.start_date - timedelta(days=1),
            },
        )

    enrollment_id = db.execute(
        text(
            """
            INSERT INTO student_enrollments (student_id, class_id, start_date)
            VALUES (:student_id, :class_id, :start_date)
            RETURNING id
            """
        ),
        {
            "student_id": student_id,
            "class_id": str(enrollment_data.class_id),
            "start_date": enrollment_data.start_date,
        },
    ).scalar_one()

    for subject_id in enrollment_data.specialty_subject_ids:
        db.execute(
            text(
                """
                INSERT INTO student_specialties (student_enrollment_id, subject_id)
                VALUES (:enrollment_id, :subject_id)
                """
            ),
            {"enrollment_id": enrollment_id, "subject_id": subject_id},
        )
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise ValueError(
            "L'inscription n'a pas pu être enregistrée. Vérifiez la classe, "
            "la date et les spécialités choisies."
        ) from error

    return get_student(db=db, student_id=student_id)




def _get_linked_account(db: Session, student: Student) -> Account:
    """Retourne le compte obligatoire associé au dossier élève."""

    account = db.get(Account, student.account_id)
    if account is None:
        raise ValueError("Le compte associé à cet élève est introuvable.")
    return account


def _archive_student_account(
    db: Session,
    student: Student,
    change_time: datetime,
) -> None:
    """Désactive et archive le compte dans la transaction du profil."""

    account = _get_linked_account(db=db, student=student)
    account.is_active = False
    account.archived_at = change_time
    account.updated_at = change_time


def _close_open_enrollment(
    db: Session,
    student_id: str,
    requested_end_date,
) -> bool:
    """Clôture l'inscription ouverte en conservant un historique cohérent."""

    enrollment = db.execute(
        text(
            """
            SELECT se.id, se.start_date, sy.end_date AS school_year_end_date
            FROM student_enrollments AS se
            JOIN classes AS c ON c.id = se.class_id
            JOIN school_years AS sy ON sy.id = c.school_year_id
            WHERE se.student_id = :student_id
              AND se.end_date IS NULL
            FOR UPDATE
            """
        ),
        {"student_id": student_id},
    ).first()
    if enrollment is None:
        return False

    effective_end_date = min(
        max(requested_end_date, enrollment.start_date),
        enrollment.school_year_end_date,
    )
    db.execute(
        text(
            """
            UPDATE student_enrollments
            SET end_date = :end_date,
                end_reason = 'LEFT_SCHOOL',
                updated_at = now()
            WHERE id = :enrollment_id
            """
        ),
        {"enrollment_id": enrollment.id, "end_date": effective_end_date},
    )
    return True


def _restore_archived_student_account(
    db: Session,
    student: Student,
    change_time: datetime,
) -> None:
    """Restaure l'accès du compte lorsqu'un élève archivé est réactivé."""

    account = _get_linked_account(db=db, student=student)
    account.is_active = True
    account.archived_at = None
    account.failed_login_attempts = 0
    account.locked_until = None
    account.updated_at = change_time


def _apply_status_change(
    db: Session,
    student_id: str,
    new_status: str,
    admin_account_id,
    require_current: list[str] | None = None,
):
    """Applique une transition et synchronise l'archivage du compte."""

    student = db.get(Student, student_id)
    if student is None:
        return None

    if require_current and student.status not in require_current:
        raise ValueError(
            f"Transition invalide : l'élève est actuellement '{student.status}'."
        )

    previous_status = student.status
    change_time = datetime.now(timezone.utc)

    if new_status == "ARCHIVED":
        _close_open_enrollment(
            db=db,
            student_id=str(student.id),
            requested_end_date=change_time.date(),
        )
        _archive_student_account(
            db=db,
            student=student,
            change_time=change_time,
        )
    elif previous_status == "ARCHIVED":
        _restore_archived_student_account(
            db=db,
            student=student,
            change_time=change_time,
        )

    student.status = new_status
    student.archived_at = change_time if new_status == "ARCHIVED" else None
    student.updated_by_account_id = admin_account_id
    student.updated_at = change_time

    # Un seul commit valide ou annule ensemble le compte et le profil.
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


def unenroll_student(db: Session, student_id: str) -> dict | None:
    """Désinscrit un élève de sa classe annuelle ouverte."""

    student = db.get(Student, student_id)
    if student is None:
        return None
    if not _close_open_enrollment(
        db=db,
        student_id=str(student.id),
        requested_end_date=datetime.now(timezone.utc).date(),
    ):
        raise ValueError("Cet élève ne possède pas d'inscription en cours.")
    db.commit()
    return get_student(db=db, student_id=str(student.id))


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
