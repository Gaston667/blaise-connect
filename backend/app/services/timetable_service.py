"""Logique métier de l'emploi du temps (salles et créneaux)."""

from datetime import time
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

# Les cours réguliers générés pour toute la classe ne dépassent jamais cette
# heure ; seul un cours particulier (hors de cette table, géré côté frontend
# pour l'instant) peut aller au-delà, jusqu'à la fermeture de l'établissement.
REGULAR_COURSE_MAX_END_TIME = time(17, 30)
ESTABLISHMENT_CLOSING_TIME = time(19, 0)
ESTABLISHMENT_OPENING_TIME = time(8, 0)

# Pause déjeuner commune à tous les cycles.
LUNCH_BREAK_START = time(12, 0)
LUNCH_BREAK_END = time(13, 30)

# Récréation : horaire différent pour le primaire/la maternelle et le
# collège/lycée.
PRIMARY_BREAK_START = time(9, 30)
PRIMARY_BREAK_END = time(9, 50)
SECONDARY_BREAK_START = time(9, 50)
SECONDARY_BREAK_END = time(10, 10)


def _overlaps(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    return start_a < end_b and end_a > start_b


def list_rooms(db: Session) -> list[dict]:
    """Retourne les salles actives."""
    rows = db.execute(
        text("SELECT id, name, capacity, is_active FROM rooms WHERE is_active = true ORDER BY name")
    ).mappings().all()
    return [dict(row) for row in rows]


def create_room(db: Session, name: str, capacity: int | None) -> dict:
    """Crée une salle."""
    row = db.execute(
        text(
            """
            INSERT INTO rooms (name, capacity)
            VALUES (:name, :capacity)
            RETURNING id, name, capacity, is_active
            """
        ),
        {"name": name, "capacity": capacity},
    ).mappings().first()
    db.commit()
    return dict(row)


def get_class_timetable(db: Session, class_id: str) -> list[dict]:
    """Retourne les créneaux de la classe, matière et enseignant résolus par jointure."""
    rows = db.execute(
        text(
            """
            SELECT
                slot.id,
                slot.day_of_week,
                slot.start_time,
                slot.end_time,
                class_subject.id AS class_subject_id,
                subject.name AS subject_name,
                teacher.first_name || ' ' || teacher.last_name AS teacher_name,
                room.name AS room_name,
                class_level.education_stage
            FROM timetable_slots AS slot
            JOIN teacher_assignments AS assignment ON assignment.id = slot.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            LEFT JOIN rooms AS room ON room.id = slot.room_id
            WHERE class_subject.class_id = :class_id
            ORDER BY slot.day_of_week, slot.start_time
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def create_timetable_slot(
    db: Session,
    class_subject_id: UUID,
    day_of_week: int,
    start_time: time,
    end_time: time,
    room_id: UUID | None,
) -> dict:
    """Crée un créneau régulier pour la matière de classe donnée."""

    if start_time < ESTABLISHMENT_OPENING_TIME or end_time > ESTABLISHMENT_CLOSING_TIME:
        raise ValueError("Le créneau doit rester entre 8h00 et 19h00.")
    if end_time > REGULAR_COURSE_MAX_END_TIME:
        raise ValueError("Un cours régulier ne peut pas dépasser 17h30. Utilisez un cours particulier au-delà.")
    if _overlaps(start_time, end_time, LUNCH_BREAK_START, LUNCH_BREAK_END):
        raise ValueError("Le créneau chevauche la pause déjeuner (12h00-13h30).")

    context = db.execute(
        text(
            """
            SELECT assignment.id AS assignment_id, class_level.education_stage
            FROM teacher_assignments AS assignment
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            WHERE assignment.class_subject_id = :class_subject_id AND assignment.end_date IS NULL
            LIMIT 1
            """
        ),
        {"class_subject_id": class_subject_id},
    ).first()
    if context is None:
        raise ValueError("Aucun enseignant n'est actuellement affecté à cette matière pour cette classe.")

    is_primary = context.education_stage in ("PRESCHOOL", "PRIMARY")
    break_start, break_end = (PRIMARY_BREAK_START, PRIMARY_BREAK_END) if is_primary else (SECONDARY_BREAK_START, SECONDARY_BREAK_END)
    if _overlaps(start_time, end_time, break_start, break_end):
        raise ValueError(
            f"Le créneau chevauche la récréation ({break_start.strftime('%Hh%M')}-{break_end.strftime('%Hh%M')})."
        )

    try:
        row = db.execute(
            text(
                """
                INSERT INTO timetable_slots (teacher_assignment_id, room_id, day_of_week, start_time, end_time)
                VALUES (:teacher_assignment_id, :room_id, :day_of_week, :start_time, :end_time)
                RETURNING id
                """
            ),
            {
                "teacher_assignment_id": context.assignment_id,
                "room_id": room_id,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
            },
        ).mappings().first()
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "Ce créneau est en conflit avec un cours existant (enseignant, classe ou salle déjà occupé)."
        ) from exc

    return {"id": row["id"]}


def clear_class_timetable(db: Session, class_id: str) -> None:
    """Supprime tous les créneaux existants d'une classe, avant régénération."""
    db.execute(
        text(
            """
            DELETE FROM timetable_slots
            USING teacher_assignments AS assignment, class_subjects AS class_subject
            WHERE timetable_slots.teacher_assignment_id = assignment.id
              AND assignment.class_subject_id = class_subject.id
              AND class_subject.class_id = :class_id
            """
        ),
        {"class_id": class_id},
    )
    db.commit()


def delete_timetable_slot(db: Session, slot_id: str) -> bool:
    """Supprime un créneau. Retourne False s'il n'existait pas."""
    result = db.execute(
        text("DELETE FROM timetable_slots WHERE id = :slot_id"),
        {"slot_id": slot_id},
    )
    db.commit()
    return result.rowcount > 0


def get_student_timetable(db: Session, student_id: str) -> list[dict]:
    """Retourne l'emploi du temps de la classe active de l'élève."""
    enrollment = db.execute(
        text(
            """
            SELECT class_id FROM student_enrollments
            WHERE student_id = :student_id AND end_date IS NULL
            LIMIT 1
            """
        ),
        {"student_id": student_id},
    ).first()
    if enrollment is None:
        return []
    return get_class_timetable(db, enrollment.class_id)
