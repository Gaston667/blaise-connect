"""Service simple pour lister les classes disponibles."""

from typing import Iterable
from sqlalchemy.orm import Session
from sqlalchemy import text


def list_school_classes(db: Session) -> Iterable[dict]:
    """Retourne les classes pour l'UI de filtrage des élèves."""

    sql = text(
        """
        SELECT
            c.id,
            c.school_year_id,
            c.class_level_id,
            c.group_label,
            c.capacity,
            cl.name AS class_level_name,
            c.created_at,
            c.updated_at
        FROM classes c
        LEFT JOIN class_levels cl ON c.class_level_id = cl.id
        ORDER BY cl.name, c.group_label
        """
    )

    rows = db.execute(sql).all()

    return [
        {
            'id': row.id,
            'school_year_id': row.school_year_id,
            'name': f"{row.class_level_name} {row.group_label}" if row.class_level_name else row.group_label,
            'class_level_id': row.class_level_id,
            'group_label': row.group_label,
            'capacity': row.capacity,
            'created_at': row.created_at,
            'updated_at': row.updated_at,
        }
        for row in rows
    ]