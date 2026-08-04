"""Règles métier de gestion des matières."""
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.subject import Subject
from app.schemas.subject_create import SubjectCreate
from app.schemas.subject_update import SubjectUpdate


def list_subjects_overview(
    db: Session,
    q: str | None = None,
    class_id: str | None = None,
    teacher_id: str | None = None,
    is_active: str | None = None,
) -> list[dict]:
    """Vue enrichie des matières : coefficient moyen, nb enseignants/classes concernés."""
    sql = """
        SELECT
            s.id, s.name, s.description, s.is_active, s.created_at, s.updated_at,
            AVG(cs.coefficient) AS coefficient,
            COUNT(DISTINCT ta.teacher_id) AS teacher_count,
            COUNT(DISTINCT c.id) AS class_count
        FROM subjects s
        LEFT JOIN class_subjects cs ON cs.subject_id = s.id
        LEFT JOIN classes c ON c.id = cs.class_id
        LEFT JOIN teacher_assignments ta
            ON ta.class_subject_id = cs.id
           AND ta.end_date IS NULL
        WHERE 1 = 1
    """
    params: dict = {}

    if q:
        sql += " AND s.name ILIKE :q"
        params["q"] = f"%{q}%"
    if is_active is not None and is_active != "":
        sql += " AND s.is_active = :is_active"
        params["is_active"] = is_active.lower() == "true"
    if class_id:
        sql += " AND c.id = :class_id"
        params["class_id"] = class_id
    if teacher_id:
        sql += " AND ta.teacher_id = :teacher_id"
        params["teacher_id"] = teacher_id

    sql += " GROUP BY s.id, s.name, s.description, s.is_active, s.created_at, s.updated_at"
    sql += " ORDER BY s.name"

    rows = db.execute(text(sql), params).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "description": row.description,
            "is_active": row.is_active,
            "coefficient": float(row.coefficient) if row.coefficient is not None else None,
            "teacher_count": row.teacher_count,
            "class_count": row.class_count,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]


def get_subject_detail(db: Session, subject_id: str) -> dict | None:
    """Charge une matière et ses associations de classes.

    Les performances restent nulles jusqu'à l'implémentation validée des
    évaluations, notes et règles de calcul du Sprint 4.
    """

    subject = db.execute(
        text(
            """
            SELECT id, name, description, is_active, created_at, updated_at
            FROM subjects
            WHERE id = :subject_id
            """
        ),
        {"subject_id": subject_id},
    ).first()
    if subject is None:
        return None

    class_rows = db.execute(
        text(
            """
            SELECT
                c.id AS class_id,
                cl.name || ' ' || c.group_label AS class_name,
                cl.name AS level_name,
                sy.name AS school_year_name,
                cs.coefficient,
                active_teacher.id AS teacher_id,
                CASE
                    WHEN active_teacher.id IS NULL THEN NULL
                    ELSE active_teacher.first_name || ' ' || active_teacher.last_name
                END AS teacher_name
            FROM class_subjects AS cs
            JOIN classes AS c ON c.id = cs.class_id
            JOIN class_levels AS cl ON cl.id = c.class_level_id
            JOIN school_years AS sy ON sy.id = c.school_year_id
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
            WHERE cs.subject_id = :subject_id
            ORDER BY sy.start_date DESC, cl.display_order, c.group_label
            """
        ),
        {"subject_id": subject_id},
    ).all()

    classes = [
        {
            "class_id": row.class_id,
            "class_name": row.class_name,
            "level_name": row.level_name,
            "school_year_name": row.school_year_name,
            "coefficient": float(row.coefficient),
            "teacher_id": row.teacher_id,
            "teacher_name": row.teacher_name,
            "best_average": None,
            "best_student_id": None,
            "best_student_name": None,
        }
        for row in class_rows
    ]
    teacher_ids = {row.teacher_id for row in class_rows if row.teacher_id is not None}

    return {
        "id": subject.id,
        "name": subject.name,
        "description": subject.description,
        "is_active": subject.is_active,
        "created_at": subject.created_at,
        "updated_at": subject.updated_at,
        "class_count": len(classes),
        "teacher_count": len(teacher_ids),
        "best_establishment_average": None,
        "best_establishment_student_id": None,
        "best_establishment_student_name": None,
        "classes": classes,
    }


def create_subject(db: Session, data: SubjectCreate) -> Subject:
    """Crée une matière."""
    subject = Subject(
        name=data.name,
        description=data.description,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def update_subject(db: Session, subject_id: str, data: SubjectUpdate) -> Subject | None:
    """Met à jour une matière existante."""
    subject = db.get(Subject, subject_id)
    if not subject:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    db.commit()
    db.refresh(subject)
    return subject
