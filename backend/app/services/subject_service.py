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
            COUNT(DISTINCT c.main_teacher_id) AS teacher_count,
            COUNT(DISTINCT c.id) AS class_count
        FROM subjects s
        LEFT JOIN class_subjects cs ON cs.subject_id = s.id
        LEFT JOIN classes c ON c.id = cs.class_id
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
        sql += " AND c.main_teacher_id = :teacher_id"
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


def create_subject(db: Session, data: SubjectCreate) -> Subject:
    """Crée une matière."""
    subject = Subject(name=data.name, description=data.description)
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
