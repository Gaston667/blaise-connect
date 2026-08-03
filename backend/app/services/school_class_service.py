"""Règles métier de gestion des classes de l'US-004."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from app.core.school_class_level_locked_error import SchoolClassLevelLockedError
from app.core.school_class_not_found_error import SchoolClassNotFoundError
from app.models.class_subject import ClassSubject
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

    requested_level_id = updated_fields.get("class_level_id")
    level_is_changing = (
        requested_level_id is not None
        and requested_level_id != school_class.class_level_id
    )
    if level_is_changing:
        enrollment_exists = db.execute(
            sql_text(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM student_enrollments
                    WHERE class_id = :school_class_id
                )
                """
            ),
            {"school_class_id": school_class_id},
        ).scalar_one()
        if enrollment_exists:
            raise SchoolClassLevelLockedError()

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
            t.gender AS teacher_gender,
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
            "teacher_name": f"{('M. ' if row.teacher_gender in ('MALE', 'M') else 'Mme ' if row.teacher_gender in ('FEMALE', 'F') else '')}{row.teacher_first_name} {row.teacher_last_name}",
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
                c.group_label, c.capacity, c.created_at, c.updated_at,
                cl.name AS level_name,
                sy.name AS school_year_name, sy.start_date, sy.end_date,
                t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
                t.gender AS teacher_gender,
                t.email AS teacher_email, t.phone AS teacher_phone,
                CASE WHEN t.archived_at IS NULL THEN 'ACTIVE' ELSE 'ARCHIVED' END
                    AS teacher_status,
                CASE WHEN sy.closed_at IS NOT NULL THEN 'ARCHIVEE' ELSE 'ACTIVE' END AS status,
                EXISTS (
                    SELECT 1
                    FROM student_enrollments enrollment
                    WHERE enrollment.class_id = c.id
                ) AS has_enrollments,
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
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "level_name": row.level_name,
        "school_year_name": row.school_year_name,
        "school_year_start": row.start_date,
        "school_year_end": row.end_date,
        "teacher_first_name": row.teacher_first_name,
        "teacher_last_name": row.teacher_last_name,
        "teacher_gender": row.teacher_gender,
        "teacher_email": row.teacher_email,
        "teacher_phone": row.teacher_phone,
        "teacher_status": row.teacher_status,
        "status": row.status,
        "has_enrollments": row.has_enrollments,
        "student_count": row.student_count,
        "subject_count": row.subject_count,
    }


def delete_school_class(db: Session, school_class_id: str) -> None:
    """Supprime une classe si elle n'a aucun élève ni matière rattachés."""
    school_class = get_school_class_by_id(db, school_class_id)
    db.delete(school_class)
    db.commit()


def list_school_class_subjects(
    db: Session,
    school_class_id: str,
    q: str | None = None,
    is_active: bool | None = None,
) -> list[dict]:
    """Liste les matières d'une classe avec leur coefficient et l'enseignant actuel."""

    where_clauses = ["cs.class_id = :school_class_id"]
    parameters: dict = {"school_class_id": school_class_id}

    if q:
        where_clauses.append("s.name ILIKE :q")
        parameters["q"] = f"%{q.strip()}%"

    if is_active is not None:
        where_clauses.append("s.is_active = :is_active")
        parameters["is_active"] = is_active

    # Les noms sont dérivés des affectations actives de la matière de classe.
    statement = sql_text(
        f"""
        SELECT
            cs.id,
            cs.subject_id,
            s.name,
            cs.coefficient,
            s.is_active,
            (
                SELECT string_agg(
                    (CASE
                        WHEN teacher.gender IN ('MALE', 'M') THEN 'M. '
                        WHEN teacher.gender IN ('FEMALE', 'F') THEN 'Mme '
                        ELSE ''
                    END) || teacher.first_name || ' ' || teacher.last_name,
                    ', '
                    ORDER BY teacher.last_name, teacher.first_name
                )
                FROM teacher_assignments AS assignment
                JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
                WHERE assignment.class_subject_id = cs.id
                  AND assignment.end_date IS NULL
            ) AS teacher_name
        FROM class_subjects cs
        JOIN subjects s ON s.id = cs.subject_id
        WHERE {" AND ".join(where_clauses)}
        ORDER BY s.name
        """
    )
    rows = db.execute(statement, parameters).mappings().all()
    return [dict(row) for row in rows]


def list_available_subjects_for_class(
    db: Session,
    school_class_id: str,
) -> list[dict]:
    """Retourne les matières actives non encore associées à la classe."""

    rows = db.execute(
        sql_text(
            """
            SELECT s.id, s.name
            FROM subjects s
            WHERE s.is_active = true
              AND s.id NOT IN (
                  SELECT cs.subject_id
                  FROM class_subjects cs
                  WHERE cs.class_id = :class_id
              )
            ORDER BY s.name
            """
        ),
        {"class_id": school_class_id},
    ).all()
    return [{"id": str(row.id), "name": row.name} for row in rows]


def add_class_subject(
    db: Session,
    class_id: str,
    subject_id: UUID,
    coefficient: Decimal,
) -> ClassSubject:
    """Associe une matière à une classe avec son coefficient."""

    cs = ClassSubject(
        class_id=class_id,
        subject_id=subject_id,
        coefficient=coefficient,
    )
    db.add(cs)
    db.commit()
    db.refresh(cs)
    return cs


def update_class_subject_coefficient(
    db: Session,
    class_subject_id: UUID,
    coefficient: Decimal,
) -> ClassSubject:
    """Met à jour le coefficient d'une association classe-matière."""

    cs = db.get(ClassSubject, class_subject_id)
    if cs is None:
        raise ValueError("Association classe-matière introuvable.")
    cs.coefficient = coefficient
    db.commit()
    db.refresh(cs)
    return cs


def remove_class_subject(
    db: Session,
    class_subject_id: UUID,
) -> None:
    """Retire une matière d'une classe."""

    cs = db.get(ClassSubject, class_subject_id)
    if cs is None:
        raise ValueError("Association classe-matière introuvable.")
    db.delete(cs)
    db.commit()
