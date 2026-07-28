"""Règles métier de gestion des classes de l'US-004."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

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
