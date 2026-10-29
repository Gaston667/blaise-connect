"""Règles métier des spécialités choisies par les élèves."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


SPECIALTY_COUNT_BY_LEVEL = {
    "PREMIERE": 3,
    "TERMINALE": 2,
}


def _get_current_enrollment_context(
    db: Session,
    student_id: UUID,
):
    """Retourne l'inscription annuelle active et son niveau."""

    row = db.execute(
        text(
            """
            SELECT
                enrollment.id AS enrollment_id,
                enrollment.class_id,
                school_class.school_year_id,
                class_level.code AS level_code,
                class_level.name AS level_name,
                school_year.name AS school_year_name
            FROM student_enrollments AS enrollment
            JOIN classes AS school_class
              ON school_class.id = enrollment.class_id
            JOIN class_levels AS class_level
              ON class_level.id = school_class.class_level_id
            JOIN school_years AS school_year
              ON school_year.id = school_class.school_year_id
            WHERE enrollment.student_id = :student_id
              AND enrollment.end_date IS NULL
            """
        ),
        {"student_id": student_id},
    ).first()

    if row is None:
        raise ValueError(
            "Cet élève ne possède aucune inscription scolaire en cours."
        )

    if row.level_code not in SPECIALTY_COUNT_BY_LEVEL:
        raise ValueError(
            "Les spécialités ne sont disponibles que pour les élèves "
            "de Première et de Terminale."
        )

    return row


def get_previous_premiere_specialties(db: Session, student_id: UUID) -> list[dict]:
    """Spécialités suivies par l'élève lors de sa dernière inscription en Première.

    Règle de l'école : en Terminale, un élève garde 2 des 3 spécialités qu'il avait
    en Première. Retourne une liste vide si l'élève n'a jamais suivi de Première
    avec spécialités (par exemple un élève qui arrive directement en Terminale).
    """

    rows = db.execute(
        text(
            """
            SELECT subject.id AS subject_id, subject.name
            FROM student_specialties AS specialty
            JOIN subjects AS subject ON subject.id = specialty.subject_id
            WHERE specialty.student_enrollment_id = (
                SELECT enrollment.id
                FROM student_enrollments AS enrollment
                JOIN classes AS school_class ON school_class.id = enrollment.class_id
                JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
                WHERE enrollment.student_id = :student_id
                  AND class_level.code = 'PREMIERE'
                  AND EXISTS (
                      SELECT 1 FROM student_specialties AS has_specialty
                      WHERE has_specialty.student_enrollment_id = enrollment.id
                  )
                ORDER BY enrollment.start_date DESC
                LIMIT 1
            )
            ORDER BY subject.name
            """
        ),
        {"student_id": student_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def _class_specialty_items(db: Session, class_id: UUID) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT subject.id AS subject_id, subject.name, subject.description
            FROM class_subjects AS class_subject
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            WHERE class_subject.class_id = :class_id
              AND subject.is_specialty = true
              AND subject.is_active = true
            ORDER BY subject.name
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def _restrict_to_premiere_choices(db: Session, student_id: UUID, items: list[dict]) -> tuple[list[dict], list[dict]]:
    """Garde les spécialités de Première proposées en Terminale ; retourne aussi celles qui ne le sont pas."""

    previous = get_previous_premiere_specialties(db, student_id)
    if not previous:
        return items, []
    previous_ids = {str(item["subject_id"]) for item in previous}
    kept = [item for item in items if str(item["subject_id"]) in previous_ids]
    offered_ids = {str(item["subject_id"]) for item in kept}
    missing = [item for item in previous if str(item["subject_id"]) not in offered_ids]
    return kept, missing


def list_specialty_options_for_class(db: Session, student_id: UUID, class_id: UUID) -> dict:
    """Spécialités à proposer pour inscrire l'élève dans cette classe.

    En Terminale, seules les spécialités suivies en Première sont proposées.
    """

    school_class = db.execute(
        text(
            """
            SELECT class_level.code AS level_code, class_level.name AS level_name
            FROM classes AS school_class
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            WHERE school_class.id = :class_id
            """
        ),
        {"class_id": class_id},
    ).first()
    if school_class is None:
        raise ValueError("La classe sélectionnée est introuvable.")
    required_count = SPECIALTY_COUNT_BY_LEVEL.get(school_class.level_code, 0)
    items = _class_specialty_items(db, class_id) if required_count else []
    restricted = False
    previous_not_offered: list[dict] = []
    previous: list[dict] = []
    if school_class.level_code == "TERMINALE":
        previous = get_previous_premiere_specialties(db, student_id)
        restricted = bool(previous)
        items, previous_not_offered = _restrict_to_premiere_choices(db, student_id, items)
    return {
        "level_code": school_class.level_code,
        "level_name": school_class.level_name,
        "required_count": required_count,
        "restricted_to_premiere": restricted,
        "premiere_specialties": previous,
        "premiere_not_offered": previous_not_offered,
        "items": items,
    }


def _validate_terminale_choices(db: Session, student_id: UUID, subject_ids: list[UUID]) -> None:
    """En Terminale, les spécialités choisies doivent faire partie de celles de Première."""

    previous = get_previous_premiere_specialties(db, student_id)
    if not previous:
        return
    allowed = {str(item["subject_id"]) for item in previous}
    if any(str(subject_id) not in allowed for subject_id in subject_ids):
        names = ", ".join(f"« {item['name']} »" for item in previous)
        raise ValueError(
            f"En Terminale, l'élève ne peut garder que des spécialités suivies en Première : {names}."
        )


def list_available_student_specialties(
    db: Session,
    student_id: UUID,
) -> dict:
    """Retourne les spécialités proposées dans la classe actuelle."""

    context = _get_current_enrollment_context(
        db=db,
        student_id=student_id,
    )

    rows = db.execute(
        text(
            """
            SELECT
                subject.id,
                subject.name,
                subject.description
            FROM class_subjects AS class_subject
            JOIN subjects AS subject
              ON subject.id = class_subject.subject_id
            WHERE class_subject.class_id = :class_id
              AND subject.is_specialty = true
              AND subject.is_active = true
            ORDER BY subject.name
            """
        ),
        {"class_id": context.class_id},
    ).mappings().all()

    items = [dict(row) for row in rows]
    restricted = False
    if context.level_code == "TERMINALE":
        previous = get_previous_premiere_specialties(db, student_id)
        restricted = bool(previous)
        if previous:
            allowed = {str(item["subject_id"]) for item in previous}
            items = [item for item in items if str(item["id"]) in allowed]

    return {
        "student_enrollment_id": context.enrollment_id,
        "level_code": context.level_code,
        "level_name": context.level_name,
        "school_year_name": context.school_year_name,
        "required_count": SPECIALTY_COUNT_BY_LEVEL[
            context.level_code
        ],
        "restricted_to_premiere": restricted,
        "items": items,
    }


def list_student_specialties(
    db: Session,
    student_id: UUID,
) -> dict:
    """Retourne les spécialités de l'inscription actuelle."""

    context = _get_current_enrollment_context(
        db=db,
        student_id=student_id,
    )

    rows = db.execute(
        text(
            """
            SELECT
                specialty.id,
                specialty.subject_id,
                subject.name,
                subject.description,
                specialty.created_at
            FROM student_specialties AS specialty
            JOIN subjects AS subject
              ON subject.id = specialty.subject_id
            WHERE specialty.student_enrollment_id = :enrollment_id
            ORDER BY subject.name
            """
        ),
        {
            "enrollment_id": context.enrollment_id,
        },
    ).mappings().all()

    return {
        "student_enrollment_id": context.enrollment_id,
        "level_code": context.level_code,
        "level_name": context.level_name,
        "school_year_name": context.school_year_name,
        "required_count": SPECIALTY_COUNT_BY_LEVEL[
            context.level_code
        ],
        "items": [dict(row) for row in rows],
    }


def _validate_specialties_belong_to_class(
    db: Session,
    class_id: UUID,
    subject_ids: list[UUID],
) -> None:
    """Vérifie que toutes les spécialités sont proposées dans la classe."""

    rows = db.execute(
        text(
            """
            SELECT subject.id
            FROM class_subjects AS class_subject
            JOIN subjects AS subject
              ON subject.id = class_subject.subject_id
            WHERE class_subject.class_id = :class_id
              AND subject.id = ANY(:subject_ids)
              AND subject.is_specialty = true
              AND subject.is_active = true
            """
        ),
        {
            "class_id": class_id,
            "subject_ids": subject_ids,
        },
    ).scalars().all()

    available_ids = set(rows)
    requested_ids = set(subject_ids)

    if available_ids != requested_ids:
        raise ValueError(
            "Une ou plusieurs spécialités sélectionnées "
            "ne sont pas proposées dans cette classe."
        )


def _validate_specialty_compatibility(
    db: Session,
    subject_ids: list[UUID],
) -> None:
    """Vérifie les incompatibilités entre les matières sélectionnées."""

    if len(subject_ids) < 2:
        return

    incompatibility = db.execute(
        text(
            """
            SELECT
                subject_1.name AS subject_1_name,
                subject_2.name AS subject_2_name,
                incompatibility.reason
            FROM specialty_incompatibilities AS incompatibility
            JOIN subjects AS subject_1
              ON subject_1.id = incompatibility.subject_id_1
            JOIN subjects AS subject_2
              ON subject_2.id = incompatibility.subject_id_2
            WHERE incompatibility.subject_id_1 = ANY(:subject_ids)
              AND incompatibility.subject_id_2 = ANY(:subject_ids)
            LIMIT 1
            """
        ),
        {
            "subject_ids": subject_ids,
        },
    ).first()

    if incompatibility is not None:
        raise ValueError(
            f"Les spécialités « {incompatibility.subject_1_name} » "
            f"et « {incompatibility.subject_2_name} » "
            "ne peuvent pas être choisies ensemble. "
            f"{incompatibility.reason}"
        )


def validate_specialty_selection_for_class(
    db: Session,
    class_id: UUID,
    level_code: str,
    subject_ids: list[UUID],
    student_id: UUID | None = None,
) -> None:
    """Valide les spécialités avant de créer une inscription annuelle."""

    required_count = SPECIALTY_COUNT_BY_LEVEL.get(level_code, 0)
    if required_count == 0:
        if subject_ids:
            raise ValueError(
                "Les spécialités sont réservées aux classes de Première et Terminale."
            )
        return

    if len(set(subject_ids)) != required_count:
        level_name = "Première" if level_code == "PREMIERE" else "Terminale"
        raise ValueError(
            f"Un élève de {level_name} doit sélectionner exactement "
            f"{required_count} spécialités."
        )

    _validate_specialties_belong_to_class(db, class_id, subject_ids)
    _validate_specialty_compatibility(db, subject_ids)
    if level_code == "TERMINALE" and student_id is not None:
        _validate_terminale_choices(db, student_id, subject_ids)


def update_student_specialties(
    db: Session,
    student_id: UUID,
    subject_ids: list[UUID],
) -> dict:
    """Remplace entièrement les spécialités de l'inscription actuelle."""

    context = _get_current_enrollment_context(
        db=db,
        student_id=student_id,
    )

    required_count = SPECIALTY_COUNT_BY_LEVEL[
        context.level_code
    ]

    if len(subject_ids) != required_count:
        if context.level_code == "PREMIERE":
            raise ValueError(
                "Un élève de Première doit sélectionner exactement "
                "3 spécialités."
            )

        raise ValueError(
            "Un élève de Terminale doit sélectionner exactement "
            "2 spécialités."
        )

    _validate_specialties_belong_to_class(
        db=db,
        class_id=context.class_id,
        subject_ids=subject_ids,
    )

    _validate_specialty_compatibility(
        db=db,
        subject_ids=subject_ids,
    )

    if context.level_code == "TERMINALE":
        _validate_terminale_choices(db, student_id, subject_ids)

    try:
        # On remplace toute la sélection.
        # Si une insertion échoue ensuite, rollback restaure
        # automatiquement l'ancienne sélection.
        db.execute(
            text(
                """
                DELETE FROM student_specialties
                WHERE student_enrollment_id = :enrollment_id
                """
            ),
            {
                "enrollment_id": context.enrollment_id,
            },
        )

        for subject_id in subject_ids:
            db.execute(
                text(
                    """
                    INSERT INTO student_specialties (
                        student_enrollment_id,
                        subject_id
                    )
                    VALUES (
                        :enrollment_id,
                        :subject_id
                    )
                    """
                ),
                {
                    "enrollment_id": context.enrollment_id,
                    "subject_id": subject_id,
                },
            )

        db.commit()

    except Exception:
        db.rollback()
        raise

    return list_student_specialties(
        db=db,
        student_id=student_id,
    )
