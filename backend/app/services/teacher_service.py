"""Vue enrichie des enseignants pour l'écran de gestion."""
from sqlalchemy import text
from sqlalchemy.orm import Session


def list_teachers_overview(db: Session, q: str | None = None) -> list[dict]:
    """Liste les enseignants avec matricule, matières dérivées de leurs classes, statut."""
    sql = """
        SELECT
            t.id,
            a.registration_number,
            t.first_name,
            t.last_name,
            t.email,
            t.phone,
            t.hire_date,
            t.photo_path,
            t.archived_at,
            a.is_active
        FROM teachers t
        JOIN accounts a ON a.id = t.account_id
        WHERE 1 = 1
    """
    params: dict = {}
    if q:
        sql += " AND (t.first_name ILIKE :q OR t.last_name ILIKE :q OR a.registration_number ILIKE :q)"
        params["q"] = f"%{q}%"
    sql += " ORDER BY t.last_name, t.first_name"

    teachers = db.execute(text(sql), params).all()

    results = []
    for t in teachers:
        subjects_rows = db.execute(
            text(
                """
                SELECT DISTINCT s.name
                FROM classes c
                JOIN class_subjects cs ON cs.class_id = c.id
                JOIN subjects s ON s.id = cs.subject_id
                WHERE c.main_teacher_id = :teacher_id
                """
            ),
            {"teacher_id": t.id},
        ).all()
        is_main_teacher = len(subjects_rows) > 0 or db.execute(
            text("SELECT 1 FROM classes WHERE main_teacher_id = :teacher_id LIMIT 1"),
            {"teacher_id": t.id},
        ).first() is not None

        results.append({
            "id": str(t.id),
            "registration_number": t.registration_number,
            "first_name": t.first_name,
            "last_name": t.last_name,
            "email": t.email,
            "phone": t.phone,
            "hire_date": t.hire_date,
            "is_main_teacher": is_main_teacher,
            "subjects": [row.name for row in subjects_rows],
            "photo_path": t.photo_path,
            "status": "ACTIVE" if t.archived_at is None and t.is_active else "INACTIVE",
        })

    return results


def get_teacher_detail(db: Session, teacher_id: str) -> dict | None:
    """Retourne la vue détaillée d'un enseignant pour la page dossier."""

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
            FROM teachers t
            JOIN accounts a ON a.id = t.account_id
            WHERE t.id = :teacher_id
            """
        ),
        {"teacher_id": teacher_id},
    ).first()

    if row is None:
        return None

    classes_rows = db.execute(
        text(
            """
            SELECT
                c.id,
                (cl.name || ' ' || c.group_label) AS name,
                cl.name AS level_name,
                c.group_label,
                sy.name AS school_year_name,
                COALESCE(enr.student_count, 0) AS student_count,
                c.capacity
            FROM classes c
            JOIN class_levels cl ON cl.id = c.class_level_id
            JOIN school_years sy ON sy.id = c.school_year_id
            LEFT JOIN (
                SELECT class_id, COUNT(*) AS student_count
                FROM student_enrollments
                WHERE end_date IS NULL
                GROUP BY class_id
            ) enr ON enr.class_id = c.id
            WHERE c.main_teacher_id = :teacher_id
            ORDER BY sy.name DESC, cl.display_order, c.group_label
            """
        ),
        {"teacher_id": teacher_id},
    ).all()

    subjects_rows = db.execute(
        text(
            """
            SELECT DISTINCT s.name
            FROM classes c
            JOIN class_subjects cs ON cs.class_id = c.id
            JOIN subjects s ON s.id = cs.subject_id
            WHERE c.main_teacher_id = :teacher_id
            ORDER BY s.name
            """
        ),
        {"teacher_id": teacher_id},
    ).all()

    taught_subject_rows = db.execute(
        text(
            """
            SELECT
                cs.id,
                s.name AS subject_name,
                (cl.name || ' ' || c.group_label) AS class_name,
                cl.name AS level_name,
                sy.name AS school_year_name,
                cs.coefficient
            FROM classes c
            JOIN class_levels cl ON cl.id = c.class_level_id
            JOIN school_years sy ON sy.id = c.school_year_id
            JOIN class_subjects cs ON cs.class_id = c.id
            JOIN subjects s ON s.id = cs.subject_id
            WHERE c.main_teacher_id = :teacher_id
            ORDER BY s.name, sy.name DESC, cl.display_order, c.group_label
            """
        ),
        {"teacher_id": teacher_id},
    ).all()

    total_students = sum(class_row.student_count for class_row in classes_rows)

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
        "subjects": [subject_row.name for subject_row in subjects_rows],
        "classes": [
            {
                "id": str(class_row.id),
                "name": class_row.name,
                "level_name": class_row.level_name,
                "group_label": class_row.group_label,
                "school_year_name": class_row.school_year_name,
                "role_label": "Professeur principal",
                "student_count": class_row.student_count,
                "capacity": class_row.capacity,
            }
            for class_row in classes_rows
        ],
        "taught_subjects": [
            {
                "id": str(subject_row.id),
                "subject_name": subject_row.subject_name,
                "class_name": subject_row.class_name,
                "level_name": subject_row.level_name,
                "school_year_name": subject_row.school_year_name,
                "coefficient": float(subject_row.coefficient),
            }
            for subject_row in taught_subject_rows
        ],
        "total_students": total_students,
    }
