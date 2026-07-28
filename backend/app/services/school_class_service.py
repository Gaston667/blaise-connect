"""Règles métier de gestion des classes de l'US-004."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from app.core.school_class_not_found_error import SchoolClassNotFoundError
from app.models.school_class import SchoolClass
from app.schemas.school_class_create import SchoolClassCreate
from app.schemas.school_class_update import SchoolClassUpdate


def list_school_classes(db: Session) -> list[SchoolClass]:
    """Retourne les classes dans un ordre stable."""

    statement = select(SchoolClass).order_by(
        SchoolClass.school_year_id,
        SchoolClass.class_level_id,
        SchoolClass.group_label,
    )
    return list(db.scalars(statement).all())


def get_school_class_by_id(
    db: Session,
    school_class_id: UUID,
) -> SchoolClass:
    """Retourne une classe ou signale qu'elle n'existe pas."""

    school_class = db.get(SchoolClass, school_class_id)
    if school_class is None:
        raise SchoolClassNotFoundError(school_class_id)
    return school_class


def create_school_class(
    db: Session,
    school_class_data: SchoolClassCreate,
) -> SchoolClass:
    """Crée une classe en laissant PostgreSQL vérifier ses relations."""

    school_class = SchoolClass(**school_class_data.model_dump())
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    return school_class


def update_school_class(
    db: Session,
    school_class_id: UUID,
    school_class_data: SchoolClassUpdate,
) -> SchoolClass:
    """Modifie les champs fournis d'une classe non verrouillée par son année."""

    school_class = get_school_class_by_id(db, school_class_id)
    updated_fields = school_class_data.model_dump(exclude_unset=True)

    for field_name, field_value in updated_fields.items():
        setattr(school_class, field_name, field_value)

    db.commit()
    db.refresh(school_class)
    return school_class


def list_school_classes_overview(
    db: Session,
    q: str | None = None,
    school_year_id: str | None = None,
    class_level_id: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Vue enrichie des classes pour l'écran de gestion : noms lisibles, effectif, statut."""

    sql = """
        SELECT
            c.id,
            c.school_year_id,
            c.class_level_id,
            c.main_teacher_id,
            c.group_label,
            c.capacity,
            c.created_at,
            c.updated_at,
            cl.name AS level_name,
            cl.display_order AS level_display_order,
            sy.name AS school_year_name,
            t.first_name AS teacher_first_name,
            t.last_name AS teacher_last_name,
            CASE WHEN sy.closed_at IS NOT NULL THEN 'ARCHIVEE' ELSE 'ACTIVE' END AS status,
            COALESCE(enr.student_count, 0) AS student_count
        FROM classes c
        JOIN class_levels cl ON cl.id = c.class_level_id
        JOIN school_years sy ON sy.id = c.school_year_id
        JOIN teachers t ON t.id = c.main_teacher_id
        LEFT JOIN (
            SELECT class_id, COUNT(*) AS student_count
            FROM student_enrollments
            WHERE end_date IS NULL
            GROUP BY class_id
        ) enr ON enr.class_id = c.id
        WHERE 1 = 1
    """
    params: dict = {"limit": limit, "offset": offset}

    if q:
        sql += " AND (cl.name ILIKE :q OR c.group_label ILIKE :q)"
        params["q"] = f"%{q}%"
    if school_year_id:
        sql += " AND c.school_year_id = :school_year_id"
        params["school_year_id"] = school_year_id
    if class_level_id:
        sql += " AND c.class_level_id = :class_level_id"
        params["class_level_id"] = class_level_id
    if status:
        sql += " AND (CASE WHEN sy.closed_at IS NOT NULL THEN 'ARCHIVEE' ELSE 'ACTIVE' END) = :status"
        params["status"] = status

    sql += " ORDER BY level_display_order, c.group_label LIMIT :limit OFFSET :offset"

    rows = db.execute(sql_text(sql), params).all()
    return [
        {
            "id": row.id,
            "school_year_id": row.school_year_id,
            "class_level_id": row.class_level_id,
            "main_teacher_id": row.main_teacher_id,
            "group_label": row.group_label,
            "capacity": row.capacity,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "level_name": row.level_name,
            "school_year_name": row.school_year_name,
            "teacher_name": f"{row.teacher_first_name} {row.teacher_last_name}",
            "status": row.status,
            "student_count": row.student_count,
        }
        for row in rows
    ]
def get_school_class_detail(db: Session, school_class_id: str) -> dict | None:
    """Vue détaillée d'une classe : infos, effectif, prof, statut."""
    row = db.execute(
        sql_text(
            """
            SELECT
                c.id, c.school_year_id, c.class_level_id, c.main_teacher_id,
                c.group_label, c.capacity, c.observations, c.created_at, c.updated_at,
                cl.name AS level_name,
                sy.name AS school_year_name, sy.start_date, sy.end_date,
                t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
                t.email AS teacher_email, t.phone AS teacher_phone,
                CASE WHEN sy.closed_at IS NOT NULL THEN 'ARCHIVEE' ELSE 'ACTIVE' END AS status,
                COALESCE(enr.student_count, 0) AS student_count,
                COALESCE(subj.subject_count, 0) AS subject_count
            FROM classes c
            JOIN class_levels cl ON cl.id = c.class_level_id
            JOIN school_years sy ON sy.id = c.school_year_id
            JOIN teachers t ON t.id = c.main_teacher_id
            LEFT JOIN (
                SELECT class_id, COUNT(*) AS student_count
                FROM student_enrollments WHERE end_date IS NULL GROUP BY class_id
            ) enr ON enr.class_id = c.id
            LEFT JOIN (
                SELECT class_id, COUNT(*) AS subject_count
                FROM class_subjects GROUP BY class_id
            ) subj ON subj.class_id = c.id
            WHERE c.id = :id
            """
        ),
        {"id": school_class_id},
    ).first()

    if not row:
        return None

    return {
        "id": row.id,
        "school_year_id": row.school_year_id,
        "class_level_id": row.class_level_id,
        "main_teacher_id": row.main_teacher_id,
        "group_label": row.group_label,
        "capacity": row.capacity,
        "observations": row.observations,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "level_name": row.level_name,
        "school_year_name": row.school_year_name,
        "school_year_start": row.start_date,
        "school_year_end": row.end_date,
        "teacher_first_name": row.teacher_first_name,
        "teacher_last_name": row.teacher_last_name,
        "teacher_email": row.teacher_email,
        "teacher_phone": row.teacher_phone,
        "status": row.status,
        "student_count": row.student_count,
        "subject_count": row.subject_count,
    }


def delete_school_class(db: Session, school_class_id: str) -> None:
    """Supprime une classe si elle n'a aucun élève ni matière rattachés."""
    school_class = get_school_class_by_id(db, school_class_id)
    db.delete(school_class)
    db.commit()