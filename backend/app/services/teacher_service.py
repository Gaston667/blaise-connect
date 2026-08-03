"""Services de consultation et de gestion des enseignants."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.teacher_assignment_conflict_error import TeacherAssignmentConflictError
from app.schemas.teacher_assignment_create import TeacherAssignmentCreate
from app.schemas.teacher_assignment_end import TeacherAssignmentEnd
from app.schemas.teacher_update import TeacherUpdate


TEACHER_UPDATE_COLUMNS = {
    "first_name",
    "last_name",
    "birth_date",
    "gender",
    "email",
    "phone",
    "address",
    "qualification",
}


def list_teachers_overview(db: Session, q: str | None = None) -> list[dict]:
    """Liste les enseignants avec leurs matières réellement affectées."""

    sql = """
        SELECT
            t.id,
            a.registration_number,
            t.first_name,
            t.last_name,
            t.gender,
            t.email,
            t.phone,
            t.hire_date,
            t.photo_path,
            t.archived_at,
            a.is_active
        FROM teachers AS t
        JOIN accounts AS a ON a.id = t.account_id
        WHERE 1 = 1
    """
    params: dict = {}
    if q:
        sql += " AND (t.first_name ILIKE :q OR t.last_name ILIKE :q OR a.registration_number ILIKE :q)"
        params["q"] = f"%{q}%"
    sql += " ORDER BY t.last_name, t.first_name"

    teachers = db.execute(text(sql), params).all()
    results: list[dict] = []

    for teacher in teachers:
        subject_rows = db.execute(
            text(
                """
                SELECT DISTINCT s.name
                FROM teacher_assignments AS ta
                JOIN class_subjects AS cs ON cs.id = ta.class_subject_id
                JOIN subjects AS s ON s.id = cs.subject_id
                WHERE ta.teacher_id = :teacher_id
                  AND ta.end_date IS NULL
                ORDER BY s.name
                """
            ),
            {"teacher_id": teacher.id},
        ).all()
        is_main_teacher = db.execute(
            text("SELECT 1 FROM classes WHERE main_teacher_id = :teacher_id LIMIT 1"),
            {"teacher_id": teacher.id},
        ).first() is not None

        results.append(
            {
                "id": str(teacher.id),
                "registration_number": teacher.registration_number,
                "first_name": teacher.first_name,
                "last_name": teacher.last_name,
                "gender": teacher.gender,
                "email": teacher.email,
                "phone": teacher.phone,
                "hire_date": teacher.hire_date,
                "is_main_teacher": is_main_teacher,
                "subjects": [row.name for row in subject_rows],
                "photo_path": teacher.photo_path,
                "status": "ACTIVE" if teacher.archived_at is None and teacher.is_active else "INACTIVE",
            }
        )

    return results


def get_teacher_detail(db: Session, teacher_id: str) -> dict | None:
    """Retourne le profil, les classes et les matières d'un enseignant."""

    row = db.execute(
        text(
            """
            SELECT
                t.id,
                t.account_id,
                a.registration_number,
                t.first_name,
                t.last_name,
                t.birth_date,
                t.gender,
                t.email,
                t.phone,
                t.address,
                t.hire_date,
                t.qualification,
                t.photo_path,
                t.archived_at,
                t.created_at,
                t.updated_at,
                a.is_active
            FROM teachers AS t
            JOIN accounts AS a ON a.id = t.account_id
            WHERE t.id = :teacher_id
            """
        ),
        {"teacher_id": teacher_id},
    ).first()

    if row is None:
        return None

    class_rows = db.execute(
        text(
            """
            SELECT
                c.id,
                (cl.name || ' ' || c.group_label) AS name,
                cl.name AS level_name,
                c.group_label,
                sy.name AS school_year_name,
                COALESCE(enrollment_counts.student_count, 0) AS student_count,
                c.capacity,
                (c.main_teacher_id = :teacher_id) AS is_main_teacher
            FROM classes AS c
            JOIN class_levels AS cl ON cl.id = c.class_level_id
            JOIN school_years AS sy ON sy.id = c.school_year_id
            LEFT JOIN (
                SELECT se.class_id, COUNT(*) AS student_count
                FROM student_enrollments AS se
                WHERE se.end_date IS NULL
                GROUP BY se.class_id
            ) AS enrollment_counts ON enrollment_counts.class_id = c.id
            WHERE c.main_teacher_id = :teacher_id
               OR EXISTS (
                    SELECT 1
                    FROM teacher_assignments AS ta
                    JOIN class_subjects AS assigned_subject
                      ON assigned_subject.id = ta.class_subject_id
                    WHERE ta.teacher_id = :teacher_id
                      AND ta.end_date IS NULL
                      AND assigned_subject.class_id = c.id
               )
            ORDER BY sy.name DESC, cl.display_order, c.group_label
            """
        ),
        {"teacher_id": teacher_id},
    ).all()

    subject_rows = db.execute(
        text(
            """
            SELECT DISTINCT s.name
            FROM teacher_assignments AS ta
            JOIN class_subjects AS cs ON cs.id = ta.class_subject_id
            JOIN subjects AS s ON s.id = cs.subject_id
            WHERE ta.teacher_id = :teacher_id
              AND ta.end_date IS NULL
            ORDER BY s.name
            """
        ),
        {"teacher_id": teacher_id},
    ).all()

    taught_subject_rows = db.execute(
        text(
            """
            SELECT
                ta.id,
                cs.id AS class_subject_id,
                c.id AS class_id,
                s.name AS subject_name,
                (cl.name || ' ' || c.group_label) AS class_name,
                cl.name AS level_name,
                sy.name AS school_year_name,
                sy.end_date AS school_year_end_date,
                cs.coefficient,
                ta.start_date,
                ta.end_date
            FROM teacher_assignments AS ta
            JOIN class_subjects AS cs ON cs.id = ta.class_subject_id
            JOIN subjects AS s ON s.id = cs.subject_id
            JOIN classes AS c ON c.id = cs.class_id
            JOIN class_levels AS cl ON cl.id = c.class_level_id
            JOIN school_years AS sy ON sy.id = c.school_year_id
            WHERE ta.teacher_id = :teacher_id
              AND ta.end_date IS NULL
            ORDER BY s.name, sy.name DESC, cl.display_order, c.group_label
            """
        ),
        {"teacher_id": teacher_id},
    ).all()

    return {
        "id": str(row.id),
        "account_id": str(row.account_id),
        "registration_number": row.registration_number,
        "first_name": row.first_name,
        "last_name": row.last_name,
        "birth_date": row.birth_date,
        "gender": row.gender,
        "email": row.email,
        "phone": row.phone,
        "address": row.address,
        "hire_date": row.hire_date,
        "qualification": row.qualification,
        "photo_path": row.photo_path,
        "archived_at": row.archived_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "status": "ACTIVE" if row.archived_at is None and row.is_active else "INACTIVE",
        "subjects": [subject_row.name for subject_row in subject_rows],
        "classes": [
            {
                "id": str(class_row.id),
                "name": class_row.name,
                "level_name": class_row.level_name,
                "group_label": class_row.group_label,
                "school_year_name": class_row.school_year_name,
                "role_label": "Professeur principal" if class_row.is_main_teacher else "Enseignant",
                "student_count": class_row.student_count,
                "capacity": class_row.capacity,
                "is_main_teacher": class_row.is_main_teacher,
            }
            for class_row in class_rows
        ],
        "taught_subjects": [
            {
                "id": str(subject_row.id),
                "class_subject_id": str(subject_row.class_subject_id),
                "class_id": str(subject_row.class_id),
                "subject_name": subject_row.subject_name,
                "class_name": subject_row.class_name,
                "level_name": subject_row.level_name,
                "school_year_name": subject_row.school_year_name,
                "school_year_end_date": subject_row.school_year_end_date,
                "coefficient": float(subject_row.coefficient),
                "start_date": subject_row.start_date,
                "end_date": subject_row.end_date,
            }
            for subject_row in taught_subject_rows
        ],
        "total_students": sum(class_row.student_count for class_row in class_rows),
    }


def list_available_teacher_assignments(db: Session, teacher_id: UUID) -> list[dict]:
    """Liste les matières des classes ouvertes et leur affectation active."""

    rows = db.execute(
        text(
            """
            SELECT
                cs.id AS class_subject_id,
                c.id AS class_id,
                (cl.name || ' ' || c.group_label) AS class_name,
                cl.name AS level_name,
                sy.name AS school_year_name,
                sy.start_date AS school_year_start_date,
                sy.end_date AS school_year_end_date,
                s.name AS subject_name,
                cs.coefficient,
                active_assignment.teacher_id IS NOT NULL AS is_assigned,
                CASE
                    WHEN active_teacher.id IS NULL THEN NULL
                    ELSE
                        (CASE
                            WHEN active_teacher.gender IN ('MALE', 'M') THEN 'M. '
                            WHEN active_teacher.gender IN ('FEMALE', 'F') THEN 'Mme '
                            ELSE ''
                        END) || active_teacher.first_name || ' ' || active_teacher.last_name
                END AS assigned_teacher_name
            FROM class_subjects AS cs
            JOIN classes AS c ON c.id = cs.class_id
            JOIN class_levels AS cl ON cl.id = c.class_level_id
            JOIN school_years AS sy ON sy.id = c.school_year_id
            JOIN subjects AS s ON s.id = cs.subject_id
            LEFT JOIN LATERAL (
                SELECT ta.teacher_id
                FROM teacher_assignments AS ta
                WHERE ta.class_subject_id = cs.id
                  AND ta.end_date IS NULL
                ORDER BY ta.start_date DESC, ta.created_at DESC
                LIMIT 1
            ) AS active_assignment ON true
            LEFT JOIN teachers AS active_teacher
                ON active_teacher.id = active_assignment.teacher_id
            WHERE sy.closed_at IS NULL
              AND s.is_active = true
            ORDER BY sy.name DESC, cl.display_order, c.group_label, s.name
            """
        ),
    ).all()

    return [
        {
            "class_subject_id": str(row.class_subject_id),
            "class_id": str(row.class_id),
            "class_name": row.class_name,
            "level_name": row.level_name,
            "school_year_name": row.school_year_name,
            "school_year_start_date": row.school_year_start_date,
            "school_year_end_date": row.school_year_end_date,
            "subject_name": row.subject_name,
            "coefficient": float(row.coefficient),
            "is_assigned": row.is_assigned,
            "assigned_teacher_name": row.assigned_teacher_name,
        }
        for row in rows
    ]


def create_teacher_assignment(
    db: Session,
    teacher_id: UUID,
    data: TeacherAssignmentCreate,
) -> None:
    """Crée atomiquement une affectation pédagogique."""

    teacher_exists = db.execute(
        text("SELECT 1 FROM teachers WHERE id = :teacher_id"),
        {"teacher_id": teacher_id},
    ).first()
    if teacher_exists is None:
        raise ValueError("Enseignant introuvable.")

    active_assignment = db.execute(
        text(
            """
                        SELECT t.first_name, t.last_name, t.gender
            FROM teacher_assignments AS ta
            JOIN teachers AS t ON t.id = ta.teacher_id
            WHERE ta.class_subject_id = :class_subject_id
              AND ta.end_date IS NULL
            LIMIT 1
            """
        ),
        {"class_subject_id": data.class_subject_id},
    ).first()
    if active_assignment is not None:
        civil_title = ""
        if active_assignment.gender in ("MALE", "M"):
            civil_title = "M. "
        elif active_assignment.gender in ("FEMALE", "F"):
            civil_title = "Mme "
        teacher_name = f"{civil_title}{active_assignment.first_name} {active_assignment.last_name}"
        raise TeacherAssignmentConflictError(
            f"Cette matière est déjà affectée à {teacher_name}."
        )

    db.execute(
        text(
            """
            INSERT INTO teacher_assignments (
                teacher_id,
                class_subject_id,
                start_date
            )
            VALUES (
                :teacher_id,
                :class_subject_id,
                :start_date
            )
            """
        ),
        {
            "teacher_id": teacher_id,
            "class_subject_id": data.class_subject_id,
            "start_date": data.start_date,
        },
    )
    db.commit()


def end_teacher_assignment(
    db: Session,
    teacher_id: UUID,
    assignment_id: UUID,
    data: TeacherAssignmentEnd,
) -> None:
    """Termine une affectation sans supprimer son historique."""

    assignment = db.execute(
        text(
            """
            SELECT ta.start_date, ta.end_date
            FROM teacher_assignments AS ta
            WHERE ta.id = :assignment_id
              AND ta.teacher_id = :teacher_id
            FOR UPDATE
            """
        ),
        {"assignment_id": assignment_id, "teacher_id": teacher_id},
    ).first()

    if assignment is None:
        raise ValueError("Affectation introuvable.")
    if assignment.end_date is not None:
        raise ValueError("Cette affectation est déjà terminée.")

    db.execute(
        text(
            """
            UPDATE teacher_assignments
               SET end_date = :end_date
             WHERE id = :assignment_id
               AND teacher_id = :teacher_id
            """
        ),
        {
            "end_date": data.end_date,
            "assignment_id": assignment_id,
            "teacher_id": teacher_id,
        },
    )
    db.commit()


def update_teacher_profile(db: Session, teacher_id: str, data: TeacherUpdate) -> dict | None:
    """Met à jour les informations personnelles autorisées d'un enseignant."""

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return get_teacher_detail(db=db, teacher_id=teacher_id)

    invalid_fields = set(updates) - TEACHER_UPDATE_COLUMNS
    if invalid_fields:
        raise ValueError("Un champ demandé ne peut pas être modifié.")

    teacher_row = db.execute(
        text("SELECT id FROM teachers WHERE id = :teacher_id"),
        {"teacher_id": teacher_id},
    ).first()
    if teacher_row is None:
        return None

    set_clauses: list[str] = []
    params: dict = {"teacher_id": teacher_id}
    for field_name, field_value in updates.items():
        set_clauses.append(f"{field_name} = :{field_name}")
        params[field_name] = field_value
    set_clauses.append("updated_at = now()")

    db.execute(
        text(
            f"""
            UPDATE teachers
               SET {", ".join(set_clauses)}
             WHERE id = :teacher_id
            """
        ),
        params,
    )
    db.commit()

    return get_teacher_detail(db=db, teacher_id=teacher_id)
