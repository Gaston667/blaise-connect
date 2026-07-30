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
            t.hire_date
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
            "status": "ACTIVE",  # valeur brute : pas encore de colonne status en base
        })

    return results
def get_teacher_detail(db: Session, teacher_id: str) -> dict | None:
    """Vue détaillée d'un enseignant : profil, classes enseignées, matières, effectif total."""
    teacher_row = db.execute(
        text(
            """
            SELECT t.id, a.registration_number, t.first_name, t.last_name,
                   t.email, t.phone, t.address, t.hire_date, t.qualification
            FROM teachers t
            JOIN accounts a ON a.id = t.account_id
            WHERE t.id = :teacher_id
            """
        ),
        {"teacher_id": teacher_id},
    ).first()

    if not teacher_row:
        return None

    classes_rows = db.execute(
        text(
            """
            SELECT
                c.id, cl.name AS level_name, c.group_label, sy.name AS school_year_name,
                COALESCE(enr.student_count, 0) AS student_count
            FROM classes c
            JOIN class_levels cl ON cl.id = c.class_level_id
            JOIN school_years sy ON sy.id = c.school_year_id
            LEFT JOIN (
                SELECT class_id, COUNT(*) AS student_count
                FROM student_enrollments WHERE end_date IS NULL GROUP BY class_id
            ) enr ON enr.class_id = c.id
            WHERE c.main_teacher_id = :teacher_id
            ORDER BY sy.start_date DESC, cl.display_order
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
            """
        ),
        {"teacher_id": teacher_id},
    ).all()

    total_students = sum(row.student_count for row in classes_rows)

    return {
        "id": str(teacher_row.id),
        "registration_number": teacher_row.registration_number,
        "first_name": teacher_row.first_name,
        "last_name": teacher_row.last_name,
        "email": teacher_row.email,
        "phone": teacher_row.phone,
        "address": teacher_row.address,
        "hire_date": teacher_row.hire_date,
        "qualification": teacher_row.qualification,
        "status": "ACTIVE",
        "subjects": [row.name for row in subjects_rows],
        "classes": [
            {
                "id": str(row.id),
                "name": f"{row.level_name} {row.group_label}",
                "school_year_name": row.school_year_name,
                "student_count": row.student_count,
            }
            for row in classes_rows
        ],
        "total_students": total_students,
    }