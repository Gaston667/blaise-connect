"""Contrôle, au démarrage, que les migrations nécessaires sont appliquées."""

from sqlalchemy import text
from sqlalchemy.engine import Engine

# (table, colonne, fichier de migration qui l'ajoute)
REQUIRED_COLUMNS = [
    ("administrators", "job_title", "009_administrator_optional_job_title.sql"),
    ("subjects", "session_periods", "010_subject_session_length.sql"),
    ("timetable_slots", "is_locked", "012_locked_timetable_slots.sql"),
    ("timetable_date_slots", "is_locked", "012_locked_timetable_slots.sql"),
    ("school_holidays", "end_date", "013_school_holidays.sql"),
]


def verify_required_migrations(engine: Engine) -> None:
    """Refuse de démarrer avec un message clair si une migration manque."""

    missing: list[str] = []
    with engine.connect() as connection:
        for table, column, migration in REQUIRED_COLUMNS:
            found = connection.execute(
                text(
                    """
                    SELECT 1 FROM pg_attribute
                    WHERE attrelid = to_regclass(:table)
                      AND attname = :column AND NOT attisdropped
                    """
                ),
                {"table": table, "column": column},
            ).first()
            if found is None:
                missing.append(migration)
    if missing:
        names = ", ".join(sorted(set(missing)))
        raise RuntimeError(
            "Base de données non à jour : appliquez d'abord les migrations suivantes "
            f"(dossier database/migration) : {names}."
        )
