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
