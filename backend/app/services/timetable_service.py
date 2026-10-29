"""Règles métier de configuration, génération et publication des emplois du temps."""

import random
import time as clock
from collections import Counter
from datetime import date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.postgres_error_message import extract_postgres_error_message
from app.schemas.break_schedule_create import BreakScheduleCreate
from app.schemas.school_day_schedule_upsert import SchoolDayScheduleUpsert
from app.services.student_specialty_service import SPECIALTY_COUNT_BY_LEVEL
from app.services.timetable_planner import PlannerSubject, plan_timetable
from app.schemas.weekly_subject_requirement_upsert import (
    WeeklySubjectRequirementUpsert,
)

def _time_to_minutes(value: time) -> int:
    """Convertit une heure en nombre de minutes depuis minuit."""

    return value.hour * 60 + value.minute


def _minutes_to_time(value: int) -> time:
    """Convertit un nombre de minutes depuis minuit en heure."""

    return time(hour=value // 60, minute=value % 60)


def _periods_overlap(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    """Indique si deux intervalles semi-ouverts se chevauchent."""

    return start_a < end_b and end_a > start_b


def list_rooms(db: Session) -> list[dict]:
    """Retourne les salles actives."""

    rows = db.execute(
        text(
            """
            SELECT room.id, room.name, room.capacity, room.is_active
            FROM rooms AS room
            WHERE room.is_active = true
            ORDER BY room.name
            """
        )
    ).mappings().all()
    return [dict(row) for row in rows]


def create_room(db: Session, name: str, capacity: int | None) -> dict:
    """Crée une salle active."""

    row = db.execute(
        text(
            """
            INSERT INTO rooms (name, capacity)
            VALUES (:name, :capacity)
            RETURNING id, name, capacity, is_active
            """
        ),
        {"name": name.strip(), "capacity": capacity},
    ).mappings().one()
    db.commit()
    return dict(row)


def list_school_day_schedules(db: Session, school_year_id: UUID) -> list[dict]:
    """Liste les horaires et leurs pauses pour une année scolaire."""

    rows = db.execute(
        text(
            """
            WITH profile_stages AS (
                SELECT DISTINCT
                    profile_level.schedule_profile_id,
                    level.education_stage
                FROM schedule_profile_levels AS profile_level
                JOIN class_levels AS level
                  ON level.id = profile_level.class_level_id
            )
            SELECT
                schedule.id,
                profile.school_year_id,
                profile_stage.education_stage,
                schedule.day_of_week,
                schedule.course_start_time,
                schedule.course_end_time,
                schedule.lesson_duration_minutes,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', break.id,
                            'label', break.label,
                            'start_time', break.start_time,
                            'end_time', break.end_time
                        ) ORDER BY break.start_time
                    ) FILTER (WHERE break.id IS NOT NULL),
                    '[]'::jsonb
                ) AS breaks
            FROM school_day_schedules AS schedule
            JOIN schedule_profiles AS profile
              ON profile.id = schedule.schedule_profile_id
            JOIN profile_stages AS profile_stage
              ON profile_stage.schedule_profile_id = profile.id
            LEFT JOIN break_schedules AS break
              ON break.school_day_schedule_id = schedule.id
            WHERE profile.school_year_id = :school_year_id
              AND profile.is_active = true
            GROUP BY
                schedule.id,
                profile.school_year_id,
                profile_stage.education_stage
            ORDER BY profile_stage.education_stage, schedule.day_of_week
            """
        ),
        {"school_year_id": school_year_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def _get_or_create_schedule_profile_for_stage(
    db: Session,
    school_year_id: UUID,
    education_stage: str,
) -> UUID:
    """Résout le profil horaire relié aux niveaux d'un cycle scolaire."""

    profile_id = db.execute(
        text(
            """
            SELECT profile.id
            FROM schedule_profiles AS profile
            JOIN schedule_profile_levels AS profile_level
              ON profile_level.schedule_profile_id = profile.id
            JOIN class_levels AS level
              ON level.id = profile_level.class_level_id
            WHERE profile.school_year_id = :school_year_id
              AND level.education_stage = :education_stage
            ORDER BY profile.is_active DESC, profile.name, profile.id
            LIMIT 1
            """
        ),
        {
            "school_year_id": school_year_id,
            "education_stage": education_stage,
        },
    ).scalar_one_or_none()

    if profile_id is None:
        profile_id = db.execute(
            text(
                """
                INSERT INTO schedule_profiles (school_year_id, name, is_active)
                VALUES (:school_year_id, :profile_name, true)
                RETURNING id
                """
            ),
            {
                "school_year_id": school_year_id,
                "profile_name": f"Cycle {education_stage}",
            },
        ).scalar_one()

        db.execute(
            text(
                """
                INSERT INTO schedule_profile_levels (
                    schedule_profile_id,
                    class_level_id
                )
                SELECT :profile_id, level.id
                FROM class_levels AS level
                WHERE level.education_stage = :education_stage
                  AND level.is_active = true
                ON CONFLICT (schedule_profile_id, class_level_id) DO NOTHING
                """
            ),
            {
                "profile_id": profile_id,
                "education_stage": education_stage,
            },
        )
    else:
        db.execute(
            text(
                """
                UPDATE schedule_profiles
                SET is_active = true
                WHERE id = :profile_id
                """
            ),
            {"profile_id": profile_id},
        )

    return profile_id


def upsert_school_day_schedule(
    db: Session,
    school_year_id: UUID,
    payload: SchoolDayScheduleUpsert,
) -> dict:
    """Crée ou remplace l'horaire d'un cycle pour un jour."""

    education_stage = payload.education_stage.value
    profile_id = _get_or_create_schedule_profile_for_stage(
        db=db,
        school_year_id=school_year_id,
        education_stage=education_stage,
    )

    row = db.execute(
        text(
            """
            INSERT INTO school_day_schedules (
                schedule_profile_id, day_of_week,
                course_start_time, course_end_time, lesson_duration_minutes
            ) VALUES (
                :schedule_profile_id, :day_of_week,
                :course_start_time, :course_end_time, :lesson_duration_minutes
            )
            ON CONFLICT (schedule_profile_id, day_of_week)
            DO UPDATE SET
                course_start_time = EXCLUDED.course_start_time,
                course_end_time = EXCLUDED.course_end_time,
                lesson_duration_minutes = EXCLUDED.lesson_duration_minutes
            RETURNING id, day_of_week,
                      course_start_time, course_end_time, lesson_duration_minutes
            """
        ),
        {
            "schedule_profile_id": profile_id,
            "day_of_week": payload.day_of_week,
            "course_start_time": payload.course_start_time,
            "course_end_time": payload.course_end_time,
            "lesson_duration_minutes": payload.lesson_duration_minutes,
        },
    ).mappings().one()
    db.commit()
    return {
        **dict(row),
        "school_year_id": school_year_id,
        "education_stage": education_stage,
    }


def create_break(db: Session, payload: BreakScheduleCreate) -> dict:
    """Ajoute une pause à une journée configurée."""

    row = db.execute(
        text(
            """
            INSERT INTO break_schedules (
                school_day_schedule_id, label, start_time, end_time
            ) VALUES (
                :school_day_schedule_id, :label, :start_time, :end_time
            )
            RETURNING id, school_day_schedule_id, label, start_time, end_time
            """
        ),
        {**payload.model_dump(), "label": payload.label.strip()},
    ).mappings().one()
    db.commit()
    return dict(row)


def delete_break(db: Session, break_id: UUID) -> bool:
    """Supprime une pause modifiable."""

    result = db.execute(
        text("DELETE FROM break_schedules WHERE id = :break_id"),
        {"break_id": break_id},
    )
    db.commit()
    return result.rowcount > 0


def get_class_timetable_configuration(db: Session, class_id: UUID) -> dict:
    """Retourne la configuration héritée par une classe et ses besoins."""

    context = db.execute(
        text(
            """
            SELECT class.school_year_id, class.class_level_id,
                   level.education_stage,
                   school_year.start_date AS school_year_start_date,
                   school_year.end_date AS school_year_end_date
            FROM classes AS class
            JOIN class_levels AS level ON level.id = class.class_level_id
            JOIN school_years AS school_year ON school_year.id = class.school_year_id
            WHERE class.id = :class_id
            """
        ),
        {"class_id": class_id},
    ).mappings().first()
    if context is None:
        raise ValueError("Classe introuvable.")

    requirements = db.execute(
        text(
            """
            SELECT class_subject.id AS class_subject_id,
                   class_subject.subject_id,
                   subject.name AS subject_name,
                   subject.is_specialty,
                   requirement.weekly_minutes
            FROM class_subjects AS class_subject
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            LEFT JOIN level_subject_requirements AS requirement
              ON requirement.school_year_id = :school_year_id
             AND requirement.class_level_id = :class_level_id
             AND requirement.subject_id = class_subject.subject_id
            WHERE class_subject.class_id = :class_id
            ORDER BY subject.name
            """
        ),
        {"class_id": class_id, **context},
    ).mappings().all()

    schedules = list_school_day_schedules(db, context["school_year_id"])
    stage_schedules = [
        schedule
        for schedule in schedules
        if schedule["education_stage"] == context["education_stage"]
    ]
    return {
        "school_year_id": context["school_year_id"],
        "class_level_id": context["class_level_id"],
        "education_stage": context["education_stage"],
        "school_year_start_date": context["school_year_start_date"],
        "school_year_end_date": context["school_year_end_date"],
        "days": stage_schedules,
        "requirements": [dict(row) for row in requirements],
    }


def _save_requirements(
    db: Session,
    class_id: UUID,
    requirements: list[WeeklySubjectRequirementUpsert],
) -> None:
    """Enregistre les volumes du niveau après contrôle des matières de classe."""

    context = db.execute(
        text(
            """
            SELECT class.school_year_id, class.class_level_id
            FROM classes AS class
            WHERE class.id = :class_id
            """
        ),
        {"class_id": class_id},
    ).mappings().first()
    if context is None:
        raise ValueError("Classe introuvable.")

    for requirement in requirements:
        subject_id = db.execute(
            text(
                """
                SELECT class_subject.subject_id
                FROM class_subjects AS class_subject
                WHERE class_subject.id = :class_subject_id
                  AND class_subject.class_id = :class_id
                """
            ),
            {
                "class_subject_id": requirement.class_subject_id,
                "class_id": class_id,
            },
        ).scalar_one_or_none()
        if subject_id is None:
            raise ValueError("Une matière ne correspond pas à la classe choisie.")

        db.execute(
            text(
                """
                INSERT INTO level_subject_requirements (
                    school_year_id, class_level_id, subject_id, weekly_minutes
                ) VALUES (
                    :school_year_id, :class_level_id, :subject_id, :weekly_minutes
                )
                ON CONFLICT (school_year_id, class_level_id, subject_id)
                DO UPDATE SET weekly_minutes = EXCLUDED.weekly_minutes
                """
            ),
            {**context, "subject_id": subject_id, "weekly_minutes": requirement.weekly_minutes},
        )


def _get_generation_subjects(db: Session, class_id: UUID) -> list[dict]:
    """Charge les matières, besoins et enseignants actifs de la classe."""

    rows = db.execute(
        text(
            """
            SELECT
                class_subject.id AS class_subject_id,
                subject.id AS subject_id,
                subject.name AS subject_name,
                subject.is_specialty,
                subject.session_periods,
                assignment.id AS assignment_id,
                assignment.teacher_id,
                requirement.weekly_minutes
            FROM classes AS class
            JOIN class_levels AS level ON level.id = class.class_level_id
            JOIN class_subjects AS class_subject ON class_subject.class_id = class.id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN teacher_assignments AS assignment
              ON assignment.class_subject_id = class_subject.id
             AND assignment.end_date IS NULL
            JOIN level_subject_requirements AS requirement
              ON requirement.school_year_id = class.school_year_id
             AND requirement.class_level_id = class.class_level_id
             AND requirement.subject_id = class_subject.subject_id
            WHERE class.id = :class_id
            ORDER BY subject.name
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    return [
        {**dict(row), "remaining_minutes": row["weekly_minutes"]}
        for row in rows
    ]


def _get_specialty_conflicting_pairs(db: Session, class_id: UUID) -> set[frozenset]:
    """Paires de spécialités choisies ensemble par au moins un élève de la classe.

    Deux spécialités d'une même paire ne doivent jamais avoir lieu en même temps.
    """

    rows = db.execute(
        text(
            """
            SELECT DISTINCT first.subject_id AS first_subject_id,
                            second.subject_id AS second_subject_id
            FROM student_specialties AS first
            JOIN student_specialties AS second
              ON second.student_enrollment_id = first.student_enrollment_id
             AND second.subject_id <> first.subject_id
            JOIN student_enrollments AS enrollment
              ON enrollment.id = first.student_enrollment_id
            WHERE enrollment.class_id = :class_id
              AND enrollment.end_date IS NULL
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    return {frozenset((row["first_subject_id"], row["second_subject_id"])) for row in rows}


def get_incomplete_requirements(db: Session, timetable_id: UUID | str) -> list[dict]:
    """Matières dont le volume hebdomadaire configuré n'est pas entièrement placé dans le brouillon."""

    rows = db.execute(
        text(
            """
            SELECT subject.name AS subject_name,
                   requirement.weekly_minutes AS requested_minutes,
                   COALESCE(
                       SUM(EXTRACT(EPOCH FROM (slot.end_time - slot.start_time)) / 60), 0
                   )::int AS placed_minutes
            FROM timetables AS timetable
            JOIN classes AS class ON class.id = timetable.class_id
            JOIN class_subjects AS class_subject ON class_subject.class_id = class.id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN level_subject_requirements AS requirement
              ON requirement.school_year_id = class.school_year_id
             AND requirement.class_level_id = class.class_level_id
             AND requirement.subject_id = class_subject.subject_id
            LEFT JOIN teacher_assignments AS assignment
              ON assignment.class_subject_id = class_subject.id
            LEFT JOIN timetable_slots AS slot
              ON slot.teacher_assignment_id = assignment.id
             AND slot.timetable_id = timetable.id
            WHERE timetable.id = :timetable_id
            GROUP BY subject.name, requirement.weekly_minutes
            HAVING COALESCE(
                       SUM(EXTRACT(EPOCH FROM (slot.end_time - slot.start_time)) / 60), 0
                   ) < requirement.weekly_minutes
            ORDER BY subject.name
            """
        ),
        {"timetable_id": timetable_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def get_student_specialty_overlaps(db: Session, class_id: UUID | str, status: str = 'DRAFT') -> list[dict]:
    """Élèves dont deux spécialités choisies se chevauchent dans le brouillon."""

    rows = db.execute(
        text(
            """
            SELECT DISTINCT student.first_name, student.last_name,
                   first_subject.name AS first_subject_name,
                   second_subject.name AS second_subject_name,
                   first_slot.day_of_week, first_slot.start_time, first_slot.end_time
            FROM timetables AS timetable
            JOIN timetable_slots AS first_slot ON first_slot.timetable_id = timetable.id
            JOIN timetable_slots AS second_slot
              ON second_slot.timetable_id = timetable.id
             AND second_slot.id <> first_slot.id
             AND second_slot.day_of_week = first_slot.day_of_week
             AND second_slot.start_time < first_slot.end_time
             AND second_slot.end_time > first_slot.start_time
            JOIN teacher_assignments AS first_assignment
              ON first_assignment.id = first_slot.teacher_assignment_id
            JOIN class_subjects AS first_class_subject
              ON first_class_subject.id = first_assignment.class_subject_id
            JOIN teacher_assignments AS second_assignment
              ON second_assignment.id = second_slot.teacher_assignment_id
            JOIN class_subjects AS second_class_subject
              ON second_class_subject.id = second_assignment.class_subject_id
            JOIN subjects AS first_subject ON first_subject.id = first_class_subject.subject_id
            JOIN subjects AS second_subject ON second_subject.id = second_class_subject.subject_id
            JOIN student_specialties AS first_choice
              ON first_choice.subject_id = first_subject.id
            JOIN student_specialties AS second_choice
              ON second_choice.subject_id = second_subject.id
             AND second_choice.student_enrollment_id = first_choice.student_enrollment_id
            JOIN student_enrollments AS enrollment
              ON enrollment.id = first_choice.student_enrollment_id
             AND enrollment.class_id = timetable.class_id
             AND enrollment.end_date IS NULL
            JOIN students AS student ON student.id = enrollment.student_id
            WHERE timetable.class_id = :class_id
              AND timetable.status = :status
              AND first_subject.id <> second_subject.id
              AND first_subject.id::text < second_subject.id::text
            ORDER BY student.last_name, student.first_name, first_slot.day_of_week, first_slot.start_time
            """
        ),
        {"class_id": class_id, "status": status},
    ).mappings().all()
    return [dict(row) for row in rows]


def get_timetable_alerts(db: Session) -> list[dict]:
    """Incohérences apparues après la publication (spécialités changées, enseignant remplacé)."""

    alerts: list[dict] = []
    day_names = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
    classes = db.execute(
        text(
            """
            SELECT DISTINCT school_class.id, level.name || ' ' || school_class.group_label AS class_name
            FROM timetables AS timetable
            JOIN classes AS school_class ON school_class.id = timetable.class_id
            JOIN class_levels AS level ON level.id = school_class.class_level_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            WHERE timetable.status = 'PUBLISHED' AND school_year.is_current = true
            ORDER BY class_name
            """
        )
    ).mappings().all()
    for school_class in classes:
        by_student: dict = {}
        for item in get_student_specialty_overlaps(db, school_class["id"], "PUBLISHED"):
            by_student.setdefault((item["first_name"], item["last_name"]), []).append(item)
        for (first_name, last_name), items in by_student.items():
            example = items[0]
            alerts.append(
                {
                    "type": "SPECIALTY_OVERLAP",
                    "class_id": school_class["id"],
                    "class_name": school_class["class_name"],
                    "message": (
                        f"{first_name} {last_name} a deux spécialités en même temps "
                        f"(« {example['first_subject_name']} » et « {example['second_subject_name']} », "
                        f"{day_names[example['day_of_week'] - 1]} {example['start_time']:%H:%M}-{example['end_time']:%H:%M})"
                        f"{' et ' + str(len(items) - 1) + ' autre(s)' if len(items) > 1 else ''}. "
                        "Régénérez l'emploi du temps de la classe."
                    ),
                }
            )
    ended = db.execute(
        text(
            """
            SELECT DISTINCT school_class.id AS class_id,
                   level.name || ' ' || school_class.group_label AS class_name,
                   subject.name AS subject_name,
                   teacher.first_name || ' ' || teacher.last_name AS teacher_name,
                   assignment.end_date
            FROM timetables AS timetable
            JOIN timetable_slots AS slot ON slot.timetable_id = timetable.id
            JOIN teacher_assignments AS assignment ON assignment.id = slot.teacher_assignment_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN classes AS school_class ON school_class.id = timetable.class_id
            JOIN class_levels AS level ON level.id = school_class.class_level_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            WHERE timetable.status = 'PUBLISHED'
              AND school_year.is_current = true
              AND assignment.end_date IS NOT NULL
              AND assignment.end_date <= CURRENT_DATE
              AND NOT EXISTS (
                  SELECT 1 FROM teacher_assignments AS current_assignment
                  WHERE current_assignment.class_subject_id = assignment.class_subject_id
                    AND current_assignment.end_date IS NULL
                    AND current_assignment.teacher_id = assignment.teacher_id
              )
            ORDER BY class_name, subject_name
            """
        )
    ).mappings().all()
    for row in ended:
        alerts.append(
            {
                "type": "TEACHER_REPLACED",
                "class_id": row["class_id"],
                "class_name": row["class_name"],
                "message": (
                    f"{row['subject_name']} : l'affectation de {row['teacher_name']} est terminée "
                    f"(le {row['end_date']:%d/%m/%Y}) mais l'emploi du temps publié de {row['class_name']} "
                    "l'utilise encore. Régénérez-le avec le nouvel enseignant."
                ),
            }
        )
    return alerts


def _build_available_periods(configuration: dict) -> list[dict]:
    """Découpe les journées configurées en créneaux hors pauses."""

    periods: list[dict] = []
    for day in configuration["days"]:
        cursor = _time_to_minutes(day["course_start_time"])
        day_end = _time_to_minutes(day["course_end_time"])
        duration = day["lesson_duration_minutes"]
        breaks = day["breaks"]
        while cursor < day_end:
            next_end = min(cursor + duration, day_end)
            # Le générateur automatique ne crée pas de dernier créneau amputé
            # (par exemple 16:15-17:00 pour un cours normal de 60 minutes).
            # Cela évite de produire ensuite des cours de 15 minutes.
            if next_end - cursor < duration:
                break
            overlapping_break = None
            for school_break in breaks:
                if _periods_overlap(
                    _minutes_to_time(cursor),
                    _minutes_to_time(next_end),
                    time.fromisoformat(str(school_break["start_time"])),
                    time.fromisoformat(str(school_break["end_time"])),
                ):
                    overlapping_break = school_break
                    break
            if overlapping_break is not None:
                cursor = _time_to_minutes(
                    time.fromisoformat(str(overlapping_break["end_time"]))
                )
                continue
            periods.append(
                {
                    "day_of_week": day["day_of_week"],
                    "start_time": _minutes_to_time(cursor),
                    "end_time": _minutes_to_time(next_end),
                    "duration": next_end - cursor,
                }
            )
            cursor = next_end
    return periods


# Plafond d'heures de cours par jour et par cycle (minutes) et plafond d'enseignement d'un professeur.
STAGE_MAX_DAY_MINUTES = {
    "PRESCHOOL": 300,
    "PRIMARY": 360,
    "MIDDLE_SCHOOL": 420,
    "HIGH_SCHOOL": 480,
}
TEACHER_MAX_DAY_MINUTES = 420
BATCH_ROUNDS = 20
BATCH_TIME_BUDGET_SECONDS = 40


def _plan_class(
    db: Session,
    class_id: UUID,
    requested_minutes_by_id: dict,
    target_start_date: date,
    target_end_date: date,
    extra_teacher_busy: list[dict] | None = None,
    extra_room_busy: list[dict] | None = None,
    exclude_class_ids: list | None = None,
    cache: dict | None = None,
) -> dict:
    """Calcule le placement d'une classe sans rien écrire en base."""

    cache = cache if cache is not None else {}
    configuration = _memo(cache, ("config", class_id), lambda: get_class_timetable_configuration(db, class_id))
    if not configuration["days"]:
        raise ValueError("Configurez d'abord les horaires du cycle pour cette année.")
    subjects = _memo(cache, ("subjects", class_id), lambda: _get_generation_subjects(db, class_id))
    if not subjects:
        raise ValueError("Aucune matière avec enseignant et volume horaire n'est disponible.")
    if target_start_date > target_end_date:
        raise ValueError("La date de fin de génération doit être postérieure à la date de début.")
    if (
        target_start_date < configuration["school_year_start_date"]
        or target_end_date > configuration["school_year_end_date"]
    ):
        raise ValueError("La plage de génération doit rester comprise dans l'année scolaire.")

    school_year_id = configuration["school_year_id"]
    busy_slots = _memo(cache, ("busy-teachers", class_id), lambda: get_teacher_busy_slots(
        db, str(class_id), school_year_id,
        include_drafts=True,
        target_start_date=target_start_date,
        target_end_date=target_end_date,
        exclude_class_ids=exclude_class_ids,
    )) + list(extra_teacher_busy or [])
    busy_rooms = _memo(cache, ("busy-rooms", class_id), lambda: get_room_busy_slots(
        db, str(class_id), school_year_id, target_start_date, target_end_date,
        exclude_class_ids=exclude_class_ids,
    )) + list(extra_room_busy or [])
    available_rooms = _memo(cache, "rooms", lambda: list_rooms(db))
    specialty_subjects = [subject for subject in subjects if subject["is_specialty"]]
    all_periods = _build_available_periods(configuration)

    # Un cours publié pour toute la classe occupe son créneau. Un cours particulier
    # individuel, lui, se place autour de l'emploi du temps : il ne retire jamais
    # un créneau à la classe (voir suggest_special_course_slots).
    reserved_periods = _memo(cache, ("reserved", class_id), lambda: db.execute(
        text(
            """
            SELECT DISTINCT special_course.day_of_week, special_course.start_time, special_course.end_time
            FROM special_courses AS special_course
            WHERE special_course.status = 'PUBLISHED'
              AND special_course.class_id = :class_id
            """
        ),
        {"class_id": class_id},
    ).mappings().all())
    all_periods = [
        period for period in all_periods
        if not any(
            period["day_of_week"] == reserved["day_of_week"]
            and period["start_time"] < reserved["end_time"]
            and period["end_time"] > reserved["start_time"]
            for reserved in reserved_periods
        )
    ]

    level_code = _memo(cache, ("level", class_id), lambda: db.execute(
        text(
            """
            SELECT level.code::text FROM classes AS school_class
            JOIN class_levels AS level ON level.id = school_class.class_level_id
            WHERE school_class.id = :class_id
            """
        ),
        {"class_id": class_id},
    ).scalar_one())
    is_young_stage = configuration["education_stage"] in ("PRESCHOOL", "PRIMARY")
    conflicting_pairs = _memo(cache, ("pairs", class_id), lambda: (
        _get_specialty_conflicting_pairs(db, class_id) if specialty_subjects else set()
    ))
    locked_rows = _memo(cache, ("locked", class_id), lambda: db.execute(
        text(
            """
            SELECT assignment.class_subject_id AS key, slot.day_of_week,
                   slot.start_time, slot.end_time, slot.room_id
            FROM timetable_slots AS slot
            JOIN timetables AS timetable ON timetable.id = slot.timetable_id
            JOIN teacher_assignments AS assignment ON assignment.id = slot.teacher_assignment_id
            WHERE timetable.class_id = :class_id
              AND timetable.status = 'DRAFT'
              AND slot.is_locked
            """
        ),
        {"class_id": class_id},
    ).mappings().all())
    plan = plan_timetable(
        all_periods,
        [
            PlannerSubject(
                key=subject["class_subject_id"],
                name=subject["subject_name"],
                teacher_id=subject["teacher_id"],
                subject_id=subject["subject_id"],
                minutes=subject["weekly_minutes"],
                is_specialty=subject["is_specialty"],
                single_period_sessions=is_young_stage or subject["session_periods"] == 1,
            )
            for subject in subjects
        ],
        busy_slots,
        busy_rooms,
        [room["id"] for room in available_rooms],
        conflicting_pairs,
        seed=str(class_id),
        specialty_groups_target=SPECIALTY_COUNT_BY_LEVEL.get(level_code, 0),
        max_day_minutes=STAGE_MAX_DAY_MINUTES.get(configuration["education_stage"]),
        teacher_max_day_minutes=TEACHER_MAX_DAY_MINUTES,
        fixed_placements=[dict(row) for row in locked_rows],
    )

    unplaced = [
        {
            "class_subject_id": subject["class_subject_id"],
            "subject_name": subject["subject_name"],
            "remaining_minutes": plan.remaining_minutes[subject["class_subject_id"]],
            "requested_minutes": subject["weekly_minutes"],
            "placed_minutes": subject["weekly_minutes"] - plan.remaining_minutes[subject["class_subject_id"]],
            "reason": plan.reasons.get(subject["class_subject_id"]),
        }
        for subject in subjects
        if plan.remaining_minutes[subject["class_subject_id"]] > 0
    ]

    # Une matière demandée sans enseignant actif n'est jamais générée : on la
    # signale au lieu de la laisser disparaître silencieusement.
    generated_ids = {subject["class_subject_id"] for subject in subjects}
    missing_ids = [key for key in requested_minutes_by_id if key not in generated_ids]
    if missing_ids:
        missing_rows = db.execute(
            text(
                """
                SELECT class_subject.id AS class_subject_id, subject.name AS subject_name
                FROM class_subjects AS class_subject
                JOIN subjects AS subject ON subject.id = class_subject.subject_id
                WHERE class_subject.class_id = :class_id
                  AND class_subject.id = ANY(:class_subject_ids)
                ORDER BY subject.name
                """
            ),
            {"class_id": class_id, "class_subject_ids": missing_ids},
        ).mappings().all()
        for row in missing_rows:
            requested = requested_minutes_by_id[row["class_subject_id"]]
            unplaced.append(
                {
                    "class_subject_id": row["class_subject_id"],
                    "subject_name": row["subject_name"],
                    "remaining_minutes": requested,
                    "requested_minutes": requested,
                    "placed_minutes": 0,
                    "reason": "Aucun enseignant affecté à cette matière.",
                }
            )

    return {
        "class_id": class_id,
        "school_year_id": school_year_id,
        "subjects": subjects,
        "plan": plan,
        "unplaced": unplaced,
        "unplaced_minutes": sum(item["remaining_minutes"] for item in unplaced),
        "locked_count": len(locked_rows),
        "start": target_start_date,
        "end": target_end_date,
    }


def _persist_plan(db: Session, planned: dict, generated_by_account_id: UUID) -> dict:
    """Remplace le brouillon de la classe par le placement calculé."""

    class_id = planned["class_id"]
    locked_dated = db.execute(
        text(
            """
            SELECT dated_slot.teacher_assignment_id, dated_slot.room_id,
                   dated_slot.course_date, dated_slot.start_time, dated_slot.end_time
            FROM timetable_date_slots AS dated_slot
            JOIN timetables AS timetable ON timetable.id = dated_slot.timetable_id
            WHERE timetable.class_id = :class_id AND timetable.status = 'DRAFT'
              AND dated_slot.is_locked
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    db.execute(
        text("DELETE FROM timetables WHERE class_id = :class_id AND status = 'DRAFT'"),
        {"class_id": class_id},
    )
    generation_run = db.execute(
        text(
            """
            INSERT INTO timetable_generation_runs (
                school_year_id, requested_by_account_id, status,
                target_start_date, target_end_date,
                started_at, completed_at
            ) VALUES (
                :school_year_id, :requested_by_account_id, 'COMPLETED',
                :target_start_date, :target_end_date,
                now(), now()
            )
            RETURNING id
            """
        ),
        {
            "school_year_id": planned["school_year_id"],
            "requested_by_account_id": generated_by_account_id,
            "target_start_date": planned["start"],
            "target_end_date": planned["end"],
        },
    ).mappings().one()
    timetable = db.execute(
        text(
            """
            INSERT INTO timetables (
                class_id, version, effective_start_date, effective_end_date,
                creation_mode, created_by_account_id, generation_run_id
            )
            SELECT :class_id, COALESCE(MAX(version), 0) + 1,
                   :effective_start_date, :effective_end_date,
                   'AUTOMATIC', :created_by_account_id, :generation_run_id
            FROM timetables
            WHERE class_id = :class_id
            RETURNING id, version, status
            """
        ),
        {
            "class_id": class_id,
            "effective_start_date": planned["start"],
            "effective_end_date": planned["end"],
            "created_by_account_id": generated_by_account_id,
            "generation_run_id": generation_run["id"],
        },
    ).mappings().one()

    subject_by_key = {subject["class_subject_id"]: subject for subject in planned["subjects"]}
    created_slots: list[dict] = []
    for placement in sorted(planned["plan"].placements, key=lambda item: (item["day_of_week"], item["start_time"])):
        subject = subject_by_key[placement["key"]]
        row = db.execute(
            text(
                """
                INSERT INTO timetable_slots (
                    timetable_id, teacher_assignment_id, room_id,
                    day_of_week, start_time, end_time, is_locked
                ) VALUES (
                    :timetable_id, :teacher_assignment_id, :room_id,
                    :day_of_week, :start_time, :end_time, :is_locked
                )
                RETURNING id, day_of_week, start_time, end_time
                """
            ),
            {
                "timetable_id": timetable["id"],
                "teacher_assignment_id": subject["assignment_id"],
                "room_id": placement["room_id"],
                "day_of_week": placement["day_of_week"],
                "start_time": placement["start_time"],
                "end_time": placement["end_time"],
                "is_locked": bool(placement.get("locked")),
            },
        ).mappings().one()
        created_slots.append({**dict(row), "subject_name": subject["subject_name"]})
    for dated in locked_dated:
        db.execute(
            text(
                """
                INSERT INTO timetable_date_slots (
                    timetable_id, teacher_assignment_id, room_id,
                    course_date, start_time, end_time, is_locked
                ) VALUES (
                    :timetable_id, :teacher_assignment_id, :room_id,
                    :course_date, :start_time, :end_time, true
                )
                """
            ),
            {"timetable_id": timetable["id"], **dict(dated)},
        )

    return {
        "timetable_id": timetable["id"],
        "version": timetable["version"],
        "status": timetable["status"],
        "slots": created_slots,
        "unplaced_requirements": planned["unplaced"],
        "adjustments": planned["plan"].notes,
        "locked_count": planned.get("locked_count", 0),
    }


def generate_timetable(
    db: Session,
    class_id: UUID,
    requirements: list[WeeklySubjectRequirementUpsert],
    target_start_date: date,
    target_end_date: date,
    generated_by_account_id: UUID,
) -> dict:
    """Produit et enregistre une proposition déterministe à valider."""

    if not requirements:
        raise ValueError("Renseignez au moins un volume horaire hebdomadaire.")

    _acquire_timetable_lock(db)
    _save_requirements(db, class_id, requirements)
    planned = _plan_class(
        db, class_id,
        {requirement.class_subject_id: requirement.weekly_minutes for requirement in requirements},
        target_start_date, target_end_date,
        exclude_class_ids=None,
    )
    result = _persist_plan(db, planned, generated_by_account_id)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(extract_postgres_error_message(exc)) from exc
    return result


def _busy_from_plan(planned: dict) -> tuple[list[dict], list[dict]]:
    """Occupations (enseignants, salles) créées par un placement, pour les classes suivantes."""

    teacher_by_key = {subject["class_subject_id"]: subject["teacher_id"] for subject in planned["subjects"]}
    teachers, rooms = [], []
    for placement in planned["plan"].placements:
        window = {
            "day_of_week": placement["day_of_week"],
            "start_time": placement["start_time"],
            "end_time": placement["end_time"],
        }
        teachers.append({"teacher_id": teacher_by_key[placement["key"]], **window})
        if placement["room_id"] is not None:
            rooms.append({"room_id": placement["room_id"], **window})
    return teachers, rooms


def _teacher_load_warnings(db: Session, configs: dict, requested_by_class: dict) -> list[str]:
    """Signale les enseignants à qui l'on demande plus d'heures qu'ils n'en peuvent donner."""

    requested: Counter = Counter()
    for class_id, minutes_by_subject in requested_by_class.items():
        for subject in _get_generation_subjects(db, class_id):
            if subject["class_subject_id"] in minutes_by_subject:
                requested[subject["teacher_id"]] += minutes_by_subject[subject["class_subject_id"]]
    if not requested:
        return []
    weekly_capacity = max(
        sum(
            _time_to_minutes(period["end_time"]) - _time_to_minutes(period["start_time"])
            for period in _build_available_periods(configuration)
        )
        for configuration in configs.values()
    )
    days_count = max(len(configuration["days"]) for configuration in configs.values())
    capacity = min(weekly_capacity, TEACHER_MAX_DAY_MINUTES * days_count)
    names = {
        row["id"]: f"{row['first_name']} {row['last_name']}"
        for row in db.execute(
            text("SELECT id, first_name, last_name FROM teachers WHERE id = ANY(:ids)"),
            {"ids": list(requested)},
        ).mappings().all()
    }
    return [
        f"{names.get(teacher_id, 'Enseignant')} : {minutes / 60:g} h à placer dans la semaine "
        f"pour environ {capacity / 60:g} h réellement disponibles."
        for teacher_id, minutes in sorted(requested.items(), key=lambda item: -item[1])
        if minutes > capacity * 0.9
    ]


def generate_all_timetables(
    db: Session,
    generated_by_account_id: UUID,
    target_start_date: date | None = None,
    target_end_date: date | None = None,
) -> dict:
    """Génère les brouillons de toutes les classes de l'année courante, ensemble.

    Les classes sont planifiées en mémoire dans plusieurs ordres différents ;
    le meilleur ordre (moins d'heures non placées, puis meilleure qualité) est
    enregistré. Les volumes horaires utilisés sont ceux déjà configurés.
    """

    _acquire_timetable_lock(db)
    year = db.execute(
        text(
            """
            SELECT id, name, start_date, end_date
            FROM school_years
            WHERE is_current = true AND closed_at IS NULL
            """
        )
    ).mappings().first()
    if year is None:
        raise ValueError("Aucune année scolaire courante n'est ouverte.")
    start = target_start_date or year["start_date"]
    end = target_end_date or year["end_date"]

    classes = db.execute(
        text(
            """
            SELECT school_class.id, level.name || ' ' || school_class.group_label AS class_name
            FROM classes AS school_class
            JOIN class_levels AS level ON level.id = school_class.class_level_id
            WHERE school_class.school_year_id = :school_year_id
            ORDER BY level.display_order, school_class.group_label
            """
        ),
        {"school_year_id": year["id"]},
    ).mappings().all()

    candidates: dict = {}
    configs: dict = {}
    names: dict = {}
    skipped: list[dict] = []
    for row in classes:
        names[row["id"]] = row["class_name"]
        configuration = get_class_timetable_configuration(db, row["id"])
        requested = {
            item["class_subject_id"]: item["weekly_minutes"]
            for item in configuration["requirements"]
            if item["weekly_minutes"]
        }
        if not configuration["days"]:
            skipped.append({"class_id": row["id"], "class_name": row["class_name"],
                            "reason": "Les horaires du cycle ne sont pas configurés."})
        elif not requested:
            skipped.append({"class_id": row["id"], "class_name": row["class_name"],
                            "reason": "Aucun volume horaire hebdomadaire n'est configuré."})
        else:
            candidates[row["id"]] = requested
            configs[row["id"]] = configuration
    if not candidates:
        raise ValueError("Aucune classe n'est prête à être planifiée (horaires ou volumes manquants).")

    warnings = _teacher_load_warnings(db, configs, candidates)
    batch_ids = [str(class_id) for class_id in candidates]

    def difficulty(class_id):
        return (-sum(1 for s in _get_generation_subjects(db, class_id) if s["is_specialty"]),
                -sum(candidates[class_id].values()))

    base_order = sorted(candidates, key=difficulty)
    best = None
    cache: dict = {}
    started = clock.monotonic()
    for round_index in range(BATCH_ROUNDS):
        if round_index >= 1 and clock.monotonic() - started > BATCH_TIME_BUDGET_SECONDS:
            break
        order = base_order[:]
        if round_index:
            random.Random(f"batch|{round_index}").shuffle(order)
        extra_teachers: list[dict] = []
        extra_rooms: list[dict] = []
        plans: dict = {}
        total = [0, 0, 0, 0, 0]
        failed: list[tuple] = []
        for class_id in order:
            try:
                planned = _plan_class(
                    db, class_id, candidates[class_id], start, end,
                    extra_teachers, extra_rooms, batch_ids, cache,
                )
            except ValueError as error:
                failed.append((class_id, str(error)))
                continue
            teachers, rooms = _busy_from_plan(planned)
            extra_teachers += teachers
            extra_rooms += rooms
            plans[class_id] = planned
            score = list(planned["plan"].score)
            score[0] = planned["unplaced_minutes"]
            total = [a + b for a, b in zip(total, score)]
        key = (len(failed), *total)
        if best is None or key < best["key"]:
            best = {"key": key, "plans": plans, "order": order, "failed": failed}
        if round_index >= 2 and key[:3] == (0, 0, 0):
            break

    results = []
    for class_id in best["order"]:
        planned = best["plans"].get(class_id)
        if planned is None:
            continue
        saved = _persist_plan(db, planned, generated_by_account_id)
        results.append(
            {
                "class_id": class_id,
                "class_name": names[class_id],
                "slots_count": len(saved["slots"]),
                "unplaced_requirements": saved["unplaced_requirements"],
                "adjustments": saved["adjustments"],
                "locked_count": saved["locked_count"],
                "complete": not saved["unplaced_requirements"],
            }
        )
    for class_id, reason in best["failed"]:
        skipped.append({"class_id": class_id, "class_name": names[class_id], "reason": reason})
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(extract_postgres_error_message(exc)) from exc

    results.sort(key=lambda item: classes_index(classes, item["class_id"]))
    return {
        "school_year_name": year["name"],
        "start_date": start,
        "end_date": end,
        "classes": results,
        "skipped": skipped,
        "warnings": warnings,
        "complete_count": sum(1 for item in results if item["complete"]),
    }


def classes_index(classes, class_id) -> int:
    """Position d'une classe dans la liste ordonnée par niveau."""

    return next((index for index, row in enumerate(classes) if row["id"] == class_id), len(classes))


def _publication_problem(db: Session, class_id: UUID, draft) -> tuple[str | None, list]:
    """Contrôles métier avant publication : retourne (message d'erreur, versions à archiver)."""

    overlaps = get_student_specialty_overlaps(db, class_id)
    if overlaps:
        day_names = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
        details = "; ".join(
            f"{item['first_name']} {item['last_name']} : « {item['first_subject_name']} » et "
            f"« {item['second_subject_name']} » le {day_names[item['day_of_week'] - 1]} "
            f"{item['start_time']:%H:%M}-{item['end_time']:%H:%M}"
            for item in overlaps[:3]
        )
        extra = f" (et {len(overlaps) - 3} autre(s))" if len(overlaps) > 3 else ""
        return (
            "Publication impossible : un élève a deux spécialités en même temps. "
            f"{details}{extra}. Régénérez le brouillon ou déplacez un cours."
        ), []

    clashing = get_special_courses_in_conflict(db, draft["id"], class_id)
    if clashing:
        day_names = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
        details = "; ".join(
            f"« {item['title']} » ({item['first_name']} {item['last_name']}, "
            f"{day_names[item['day_of_week'] - 1]} {item['start_time']:%H:%M}-{item['end_time']:%H:%M})"
            for item in clashing[:3]
        )
        extra = f" (et {len(clashing) - 3} autre(s))" if len(clashing) > 3 else ""
        return (
            "Publication impossible : des cours particuliers tombent pendant les cours de l'élève. "
            f"{details}{extra}. Replacez-les sur un créneau libre (onglet Cours particuliers)."
        ), []

    incomplete = get_incomplete_requirements(db, draft["id"])
    if incomplete:
        details = "; ".join(
            f"{item['subject_name']} {item['placed_minutes'] / 60:g} h sur {item['requested_minutes'] / 60:g} h"
            for item in incomplete[:5]
        )
        extra = f" (et {len(incomplete) - 5} autre(s))" if len(incomplete) > 5 else ""
        return (
            "Publication impossible : volume horaire incomplet. "
            f"{details}{extra}. Ajoutez les créneaux manquants ou régénérez le brouillon."
        ), []

    # Seuls les emplois du temps publiés sur la même période sont remplacés : un
    # emploi du temps valable sur une autre période reste en vigueur. Les dates
    # d'une version étant immuables, un recouvrement partiel est refusé.
    published = db.execute(
        text(
            """
            SELECT id, effective_start_date, effective_end_date
            FROM timetables
            WHERE class_id = :class_id AND status = 'PUBLISHED'
            FOR UPDATE
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    to_archive = []
    for old in published:
        overlaps_new = (
            old["effective_start_date"] <= draft["effective_end_date"]
            and old["effective_end_date"] >= draft["effective_start_date"]
        )
        if not overlaps_new:
            continue
        if (
            old["effective_start_date"] >= draft["effective_start_date"]
            and old["effective_end_date"] <= draft["effective_end_date"]
        ):
            to_archive.append(old["id"])
            continue
        return (
            "Publication impossible : ce brouillon ne couvre qu'une partie de l'emploi du temps "
            f"publié (du {old['effective_start_date']:%d/%m/%Y} au {old['effective_end_date']:%d/%m/%Y}). "
            "Régénérez-le sur la même période, ou sur une période qui ne chevauche pas celle-ci."
        ), []
    return None, to_archive


def _get_draft(db: Session, class_id: UUID):
    return db.execute(
        text(
            """
            SELECT timetable.id, timetable.effective_start_date, timetable.effective_end_date
            FROM timetables AS timetable
            WHERE timetable.class_id = :class_id
              AND timetable.status = 'DRAFT'
            FOR UPDATE
            """
        ),
        {"class_id": class_id},
    ).mappings().first()


def _publish_draft(db: Session, draft_id: UUID, account_id: UUID) -> dict:
    return dict(
        db.execute(
            text(
                """
                UPDATE timetables
                SET status = 'PUBLISHED',
                    published_by_account_id = :account_id,
                    published_at = now()
                WHERE id = :timetable_id
                RETURNING id, class_id, version, status, published_at
                """
            ),
            {"account_id": account_id, "timetable_id": draft_id},
        ).mappings().one()
    )


def validate_timetable(
    db: Session,
    class_id: UUID,
    validated_by_account_id: UUID,
) -> dict:
    """Publie atomiquement le brouillon d'une classe."""

    _acquire_timetable_lock(db)
    draft = _get_draft(db, class_id)
    if draft is None:
        raise ValueError("Aucune proposition n'est disponible pour cette classe.")
    problem, to_archive = _publication_problem(db, class_id, draft)
    if problem:
        raise ValueError(problem)
    try:
        if to_archive:
            db.execute(
                text("UPDATE timetables SET status = 'ARCHIVED' WHERE id = ANY(:ids)"),
                {"ids": to_archive},
            )
        row = _publish_draft(db, draft["id"], validated_by_account_id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(extract_postgres_error_message(exc)) from exc
    return row


def publish_all_timetables(db: Session, validated_by_account_id: UUID) -> dict:
    """Publie d'un coup les brouillons de l'année courante, en tout ou rien.

    Les classes sont publiées ensemble : sinon chaque nouveau brouillon entrerait
    en conflit avec les anciens emplois du temps encore publiés des autres classes.
    Seules les classes dont le brouillon est complet sont publiées ; si une
    publication échoue, rien n'est modifié.
    """

    _acquire_timetable_lock(db)
    drafts = db.execute(
        text(
            """
            SELECT timetable.class_id,
                   level.name || ' ' || school_class.group_label AS class_name
            FROM timetables AS timetable
            JOIN classes AS school_class ON school_class.id = timetable.class_id
            JOIN class_levels AS level ON level.id = school_class.class_level_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            WHERE timetable.status = 'DRAFT' AND school_year.is_current = true
            ORDER BY level.display_order, school_class.group_label
            """
        )
    ).mappings().all()
    if not drafts:
        raise ValueError("Aucun brouillon à publier.")

    ready, not_ready = [], []
    for item in drafts:
        draft = _get_draft(db, item["class_id"])
        problem, to_archive = _publication_problem(db, item["class_id"], draft)
        if problem:
            not_ready.append({"class_id": item["class_id"], "class_name": item["class_name"], "reason": problem})
        else:
            ready.append((item, draft, to_archive))
    if not ready:
        raise ValueError(
            "Aucun brouillon n'est publiable : "
            + " ; ".join(f"{entry['class_name']} ({entry['reason']})" for entry in not_ready[:3])
        )

    try:
        archive_ids = [identifier for _, _, ids in ready for identifier in ids]
        if archive_ids:
            db.execute(
                text("UPDATE timetables SET status = 'ARCHIVED' WHERE id = ANY(:ids)"),
                {"ids": archive_ids},
            )
        db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        published = [
            {"class_id": item["class_id"], "class_name": item["class_name"],
             **_publish_draft(db, draft["id"], validated_by_account_id)}
            for item, draft, _ in ready
        ]
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(extract_postgres_error_message(exc)) from exc
    return {
        "published": [{"class_id": row["class_id"], "class_name": row["class_name"]} for row in published],
        "not_published": not_ready,
    }


def _acquire_timetable_lock(db: Session) -> None:
    """Empêche deux générations ou publications simultanées (verrou levé en fin de transaction)."""

    acquired = db.execute(
        text("SELECT pg_try_advisory_xact_lock(hashtext('blaiseconnect:timetable-generation'))")
    ).scalar_one()
    if not acquired:
        raise ValueError("Une génération ou une publication est déjà en cours. Réessayez dans un instant.")


def _memo(cache: dict, key, producer):
    """Évite de relire en base, à chaque essai, des données qui ne changent pas."""

    if key not in cache:
        cache[key] = producer()
    return cache[key]


def _class_id_list(single, several) -> list[str]:
    """Identifiants de classes à ignorer (texte), pour une comparaison `<> ALL(...)`."""

    return [str(item) for item in ([single] if single else []) + list(several or [])]


def get_teacher_busy_slots(
    db: Session,
    exclude_class_id: str | None,
    school_year_id: UUID | str | None = None,
    include_drafts: bool = False,
    target_start_date: date | None = None,
    target_end_date: date | None = None,
    exclude_class_ids: list | None = None,
) -> list[dict]:
    """Retourne les occupations des enseignants, et leurs indisponibilités déclarées.

    Seuls comptent les emplois du temps de la même année scolaire dont la période
    de validité recoupe la plage visée. Avec `include_drafts`, les brouillons des
    autres classes réservent aussi leurs enseignants.
    """

    rows = db.execute(
        text(
            """
            SELECT assignment.teacher_id, slot.day_of_week,
                   slot.start_time, slot.end_time
            FROM timetable_slots AS slot
            JOIN timetables AS timetable ON timetable.id = slot.timetable_id
            JOIN classes AS slot_class ON slot_class.id = timetable.class_id
            JOIN teacher_assignments AS assignment
              ON assignment.id = slot.teacher_assignment_id
            WHERE (
                  timetable.status = 'PUBLISHED'
                  OR (CAST(:include_drafts AS boolean) AND timetable.status = 'DRAFT')
              )
              AND timetable.class_id <> ALL(CAST(:exclude_ids AS uuid[]))
              AND (
                  CAST(:school_year_id AS uuid) IS NULL
                  OR slot_class.school_year_id = CAST(:school_year_id AS uuid)
              )
              AND (
                  CAST(:target_start_date AS date) IS NULL
                  OR timetable.effective_end_date >= CAST(:target_start_date AS date)
              )
              AND (
                  CAST(:target_end_date AS date) IS NULL
                  OR timetable.effective_start_date <= CAST(:target_end_date AS date)
              )

            UNION ALL

            SELECT unavailable.teacher_id, unavailable.day_of_week,
                   unavailable.start_time, unavailable.end_time
            FROM teacher_unavailabilities AS unavailable
            WHERE CAST(:school_year_id AS uuid) IS NULL
               OR unavailable.school_year_id = CAST(:school_year_id AS uuid)
            """
        ),
        {
            "exclude_ids": _class_id_list(exclude_class_id, exclude_class_ids),
            "school_year_id": school_year_id,
            "include_drafts": include_drafts,
            "target_start_date": target_start_date,
            "target_end_date": target_end_date,
        },
    ).mappings().all()
    return [dict(row) for row in rows]


# ---- 5 : occupations des salles par les autres classes
def get_room_busy_slots(
    db: Session,
    exclude_class_id: str,
    school_year_id: UUID | str,
    target_start_date: date,
    target_end_date: date,
    exclude_class_ids: list | None = None,
) -> list[dict]:
    """Salles déjà occupées (emplois du temps publiés ou brouillons) par les autres classes."""

    rows = db.execute(
        text(
            """
            SELECT slot.room_id, slot.day_of_week, slot.start_time, slot.end_time
            FROM timetable_slots AS slot
            JOIN timetables AS timetable ON timetable.id = slot.timetable_id
            JOIN classes AS slot_class ON slot_class.id = timetable.class_id
            WHERE slot.room_id IS NOT NULL
              AND timetable.status IN ('PUBLISHED', 'DRAFT')
              AND timetable.class_id <> ALL(CAST(:exclude_ids AS uuid[]))
              AND slot_class.school_year_id = CAST(:school_year_id AS uuid)
              AND timetable.effective_end_date >= :target_start_date
              AND timetable.effective_start_date <= :target_end_date
            """
        ),
        {
            "exclude_ids": _class_id_list(exclude_class_id, exclude_class_ids),
            "school_year_id": school_year_id,
            "target_start_date": target_start_date,
            "target_end_date": target_end_date,
        },
    ).mappings().all()
    return [dict(row) for row in rows]


def get_class_timetable(db: Session, class_id: str, published_only: bool = False) -> list[dict]:
    """Retourne le brouillon prioritaire ou le planning publié, avec ses cours datés."""

    status_filter = "timetable.status = 'PUBLISHED'" if published_only else "timetable.status IN ('DRAFT', 'PUBLISHED')"
    selected_status = """
        timetable.status = (
            SELECT CASE
                WHEN :published_only THEN 'PUBLISHED'::timetable_status_enum
                WHEN EXISTS (
                    SELECT 1 FROM timetables AS draft
                    WHERE draft.class_id = :class_id AND draft.status = 'DRAFT'
                ) THEN 'DRAFT'::timetable_status_enum
                ELSE 'PUBLISHED'::timetable_status_enum
            END
        )
    """
    rows = db.execute(
        text(
            f"""
            SELECT detail.slot_id AS id, detail.timetable_id, detail.version,
                   detail.status, detail.day_of_week, detail.start_time,
                   detail.end_time, detail.class_subject_id, detail.subject_id,
                   subject.is_specialty, detail.subject_name, detail.teacher_name,
                   detail.room_name, level.education_stage,
                   timetable.effective_start_date, timetable.effective_end_date,
                   NULL::date AS course_date, 'RECURRING'::text AS slot_kind,
                   raw_slot.is_locked
            FROM v_timetable_slots_detailed AS detail
            JOIN timetable_slots AS raw_slot ON raw_slot.id = detail.slot_id
            JOIN timetables AS timetable ON timetable.id = detail.timetable_id
            JOIN classes AS class ON class.id = detail.class_id
            JOIN class_levels AS level ON level.id = class.class_level_id
            JOIN subjects AS subject ON subject.id = detail.subject_id
            WHERE detail.class_id = :class_id
              AND {status_filter}
              AND {selected_status}

            UNION ALL

            SELECT dated_slot.id, timetable.id, timetable.version, timetable.status,
                   EXTRACT(ISODOW FROM dated_slot.course_date)::smallint,
                   dated_slot.start_time, dated_slot.end_time,
                   class_subject.id, subject.id, subject.is_specialty,
                   subject.name, teacher.first_name || ' ' || teacher.last_name,
                   room.name, level.education_stage,
                   timetable.effective_start_date, timetable.effective_end_date,
                   dated_slot.course_date, 'DATED'::text,
                   dated_slot.is_locked
            FROM timetable_date_slots AS dated_slot
            JOIN timetables AS timetable ON timetable.id = dated_slot.timetable_id
            JOIN teacher_assignments AS assignment ON assignment.id = dated_slot.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN classes AS class ON class.id = timetable.class_id
            JOIN class_levels AS level ON level.id = class.class_level_id
            LEFT JOIN rooms AS room ON room.id = dated_slot.room_id
            WHERE timetable.class_id = :class_id
              AND {status_filter}
              AND {selected_status}
            ORDER BY course_date NULLS FIRST, day_of_week, start_time
            """
        ),
        {"class_id": class_id, "published_only": published_only},
    ).mappings().all()
    return [dict(row) for row in rows]


def get_draft_conflicts(db: Session, class_id: str) -> list[dict]:
    """Détecte, sans publier, les créneaux du brouillon en conflit (même
    enseignant ou même salle) avec un emploi du temps déjà publié d'une
    autre classe. Permet d'avertir l'admin avant qu'il ne clique sur
    « Publier », par exemple quand le brouillon est devenu obsolète après
    la publication d'une autre classe qui partage des enseignants.
    """

    rows = db.execute(
        text(
            """
            SELECT
                draft_slot.day_of_week, draft_slot.start_time, draft_slot.end_time,
                draft_subject.name AS subject_name,
                draft_teacher.first_name AS teacher_first_name,
                draft_teacher.last_name AS teacher_last_name,
                published_class_level.name || ' ' || published_class.group_label AS conflicting_class_name,
                published_subject.name AS conflicting_subject_name,
                CASE
                    WHEN draft_assignment.teacher_id = published_assignment.teacher_id
                        THEN 'enseignant déjà pris'
                    ELSE 'salle déjà occupée'
                END AS reason
            FROM timetable_slots AS draft_slot
            JOIN teacher_assignments AS draft_assignment
              ON draft_assignment.id = draft_slot.teacher_assignment_id
            JOIN class_subjects AS draft_class_subject
              ON draft_class_subject.id = draft_assignment.class_subject_id
            JOIN subjects AS draft_subject ON draft_subject.id = draft_class_subject.subject_id
            JOIN teachers AS draft_teacher ON draft_teacher.id = draft_assignment.teacher_id
            JOIN timetable_slots AS published
              ON published.day_of_week = draft_slot.day_of_week
             AND published.start_time < draft_slot.end_time
             AND published.end_time > draft_slot.start_time
            JOIN timetables AS published_timetable
              ON published_timetable.id = published.timetable_id
             AND published_timetable.status = 'PUBLISHED'
             AND published_timetable.class_id <> :class_id
            JOIN teacher_assignments AS published_assignment
              ON published_assignment.id = published.teacher_assignment_id
            JOIN class_subjects AS published_class_subject
              ON published_class_subject.id = published_assignment.class_subject_id
            JOIN subjects AS published_subject ON published_subject.id = published_class_subject.subject_id
            JOIN classes AS published_class ON published_class.id = published_timetable.class_id
            JOIN class_levels AS published_class_level ON published_class_level.id = published_class.class_level_id
            WHERE draft_slot.timetable_id IN (
                SELECT id FROM timetables WHERE class_id = :class_id AND status = 'DRAFT'
            )
              AND (
                  draft_assignment.teacher_id = published_assignment.teacher_id
                  OR (
                      draft_slot.room_id IS NOT NULL
                      AND draft_slot.room_id = published.room_id
                  )
              )
            ORDER BY draft_slot.day_of_week, draft_slot.start_time
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def _get_or_create_draft(
    db: Session,
    class_id: UUID,
    created_by_account_id: UUID,
) -> UUID:
    """Retourne le brouillon courant ou en crée un."""

    draft_id = db.execute(
        text(
            """
            SELECT id FROM timetables
            WHERE class_id = :class_id AND status = 'DRAFT'
            """
        ),
        {"class_id": class_id},
    ).scalar_one_or_none()
    if draft_id is not None:
        return draft_id

    published_id = db.execute(
        text(
            "SELECT id FROM timetables WHERE class_id = :class_id AND status = 'PUBLISHED'"
        ),
        {"class_id": class_id},
    ).scalar_one_or_none()

    new_draft_id = db.execute(
        text(
            """
            INSERT INTO timetables (
                class_id,
                version,
                effective_start_date,
                effective_end_date,
                creation_mode,
                created_by_account_id
            )
            SELECT
                school_class.id,
                (
                    SELECT COALESCE(MAX(existing.version), 0) + 1
                    FROM timetables AS existing
                    WHERE existing.class_id = school_class.id
                ),
                school_year.start_date,
                school_year.end_date,
                'MANUAL',
                :account_id
            FROM classes AS school_class
            JOIN school_years AS school_year
              ON school_year.id = school_class.school_year_id
            WHERE school_class.id = :class_id
            RETURNING id
            """
        ),
        {"class_id": class_id, "account_id": created_by_account_id},
    ).scalar_one()

    # Le brouillon part d'une copie du planning publié courant, pour que la
    # modification manuelle ne fasse que l'ajuster sans faire disparaître le
    # reste des créneaux déjà en place.
    if published_id is not None:
        db.execute(
            text(
                """
                INSERT INTO timetable_slots (
                    timetable_id, teacher_assignment_id, room_id,
                    day_of_week, start_time, end_time
                )
                SELECT :new_draft_id, teacher_assignment_id, room_id,
                       day_of_week, start_time, end_time
                FROM timetable_slots
                WHERE timetable_id = :published_id
                """
            ),
            {"new_draft_id": new_draft_id, "published_id": published_id},
        )
        db.execute(
            text(
                """
                INSERT INTO timetable_date_slots (
                    timetable_id, teacher_assignment_id, room_id,
                    course_date, start_time, end_time
                )
                SELECT :new_draft_id, teacher_assignment_id, room_id,
                       course_date, start_time, end_time
                FROM timetable_date_slots
                WHERE timetable_id = :published_id
                """
            ),
            {"new_draft_id": new_draft_id, "published_id": published_id},
        )

    return new_draft_id


def create_timetable_slot(
    db: Session,
    class_id: UUID,
    class_subject_id: UUID,
    day_of_week: int,
    start_time: time,
    end_time: time,
    room_id: UUID | None,
    created_by_account_id: UUID,
) -> dict:
    """Ajoute manuellement un créneau au brouillon de la classe."""

    assignment_id = db.execute(
        text(
            """
            SELECT assignment.id
            FROM teacher_assignments AS assignment
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            WHERE class_subject.id = :class_subject_id
              AND class_subject.class_id = :class_id
              AND assignment.end_date IS NULL
            """
        ),
        {"class_subject_id": class_subject_id, "class_id": class_id},
    ).scalar_one_or_none()
    if assignment_id is None:
        raise ValueError("Aucun enseignant actif n'est affecté à cette matière de classe.")

    try:
        timetable_id = _get_or_create_draft(
            db=db,
            class_id=class_id,
            created_by_account_id=created_by_account_id,
        )
        # Un ajout manuel sur un créneau déjà occupé (copié depuis le
        # planning publié) remplace ce créneau, sans toucher au reste.
        db.execute(
            text(
                """
                DELETE FROM timetable_slots
                WHERE timetable_id = :timetable_id
                  AND day_of_week = :day_of_week
                  AND start_time < :end_time
                  AND end_time > :start_time
                """
            ),
            {
                "timetable_id": timetable_id,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
            },
        )
        row = db.execute(
            text(
                """
                INSERT INTO timetable_slots (
                    timetable_id, teacher_assignment_id, room_id,
                    day_of_week, start_time, end_time, is_locked
                ) VALUES (
                    :timetable_id, :teacher_assignment_id, :room_id,
                    :day_of_week, :start_time, :end_time, true
                )
                RETURNING id
                """
            ),
            {
                "timetable_id": timetable_id,
                "teacher_assignment_id": assignment_id,
                "room_id": room_id,
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
            },
        ).mappings().one()
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ValueError(extract_postgres_error_message(error)) from error
    return dict(row)


def create_timetable_date_slot(
    db: Session,
    class_id: UUID,
    class_subject_id: UUID,
    course_date: date,
    start_time: time,
    end_time: time,
    room_id: UUID | None,
    created_by_account_id: UUID,
) -> dict:
    """Ajoute un cours unique, daté, dans le brouillon de la classe."""

    if end_time <= start_time:
        raise ValueError("L'heure de fin doit être postérieure à l'heure de début.")

    assignment_id = db.execute(
        text(
            """
            SELECT assignment.id
            FROM teacher_assignments AS assignment
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            WHERE class_subject.id = :class_subject_id
              AND class_subject.class_id = :class_id
              AND assignment.start_date <= :course_date
              AND (assignment.end_date IS NULL OR assignment.end_date >= :course_date)
            """
        ),
        {
            "class_subject_id": class_subject_id,
            "class_id": class_id,
            "course_date": course_date,
        },
    ).scalar_one_or_none()
    if assignment_id is None:
        raise ValueError("Aucun enseignant n'est affecté à cette matière à cette date.")

    try:
        timetable_id = _get_or_create_draft(
            db=db,
            class_id=class_id,
            created_by_account_id=created_by_account_id,
        )
        row = db.execute(
            text(
                """
                INSERT INTO timetable_date_slots (
                    timetable_id, teacher_assignment_id, room_id,
                    course_date, start_time, end_time, is_locked
                ) VALUES (
                    :timetable_id, :teacher_assignment_id, :room_id,
                    :course_date, :start_time, :end_time, true
                )
                RETURNING id, course_date, start_time, end_time
                """
            ),
            {
                "timetable_id": timetable_id,
                "teacher_assignment_id": assignment_id,
                "room_id": room_id,
                "course_date": course_date,
                "start_time": start_time,
                "end_time": end_time,
            },
        ).mappings().one()
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ValueError(extract_postgres_error_message(error)) from error
    return dict(row)


def clear_class_timetable(db: Session, class_id: str) -> None:
    """Retire uniquement le brouillon ; le planning publié reste visible."""

    db.execute(
        text("DELETE FROM timetables WHERE class_id = :class_id AND status = 'DRAFT'"),
        {"class_id": class_id},
    )
    db.commit()


def delete_timetable_slot(db: Session, slot_id: str) -> bool:
    """Supprime un créneau appartenant à un brouillon."""

    result = db.execute(
        text(
            """
            DELETE FROM timetable_slots AS slot
            USING timetables AS timetable
            WHERE slot.id = :slot_id
              AND timetable.id = slot.timetable_id
              AND timetable.status = 'DRAFT'
            """
        ),
        {"slot_id": slot_id},
    )
    db.commit()
    return result.rowcount > 0


def delete_timetable_date_slot(db: Session, slot_id: str) -> bool:
    """Supprime un cours daté appartenant à un brouillon."""

    result = db.execute(
        text(
            """
            DELETE FROM timetable_date_slots AS slot
            USING timetables AS timetable
            WHERE slot.id = :slot_id
              AND timetable.id = slot.timetable_id
              AND timetable.status = 'DRAFT'
            """
        ),
        {"slot_id": slot_id},
    )
    db.commit()
    return result.rowcount > 0


def _get_open_enrollment(db: Session, student_id: str, class_id: UUID | None = None):
    """Retourne l'inscription ouverte d'un élève."""

    return db.execute(
        text(
            """
            SELECT enrollment.id, enrollment.class_id
            FROM student_enrollments AS enrollment
            WHERE enrollment.student_id = :student_id
              AND enrollment.end_date IS NULL
              AND (CAST(:class_id AS uuid) IS NULL OR enrollment.class_id = CAST(:class_id AS uuid))
            """
        ),
        {"student_id": student_id, "class_id": class_id},
    ).first()


def get_special_courses_in_conflict(db: Session, timetable_id: UUID | str, class_id: UUID | str) -> list[dict]:
    """Cours particuliers publiés qui tombent pendant un cours que l'élève suit dans le brouillon."""

    rows = db.execute(
        text(
            """
            SELECT DISTINCT special.title, special.day_of_week, special.start_time, special.end_time,
                   student.first_name, student.last_name
            FROM timetable_slots AS slot
            JOIN timetables AS timetable ON timetable.id = slot.timetable_id
            JOIN teacher_assignments AS assignment ON assignment.id = slot.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN special_courses AS special
              ON special.day_of_week = slot.day_of_week
             AND special.start_time < slot.end_time
             AND special.end_time > slot.start_time
             AND special.status = 'PUBLISHED'
             AND daterange(special.valid_from, special.valid_until, '[]')
                 && daterange(timetable.effective_start_date, timetable.effective_end_date, '[]')
            JOIN student_enrollments AS enrollment
              ON enrollment.id = special.student_enrollment_id
             AND enrollment.class_id = timetable.class_id
            JOIN students AS student ON student.id = enrollment.student_id
            WHERE timetable.id = :timetable_id
              AND timetable.class_id = :class_id
              AND (
                  NOT subject.is_specialty
                  OR EXISTS (
                      SELECT 1 FROM student_specialties AS choice
                      WHERE choice.student_enrollment_id = enrollment.id
                        AND choice.subject_id = subject.id
                  )
              )
            ORDER BY student.last_name, student.first_name, special.day_of_week, special.start_time
            """
        ),
        {"timetable_id": timetable_id, "class_id": class_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def _default_teacher_for_subject(db: Session, class_id: UUID, subject_id: UUID):
    return db.execute(
        text(
            """
            SELECT assignment.teacher_id
            FROM teacher_assignments AS assignment
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            WHERE class_subject.class_id = :class_id
              AND class_subject.subject_id = :subject_id
              AND assignment.end_date IS NULL
            LIMIT 1
            """
        ),
        {"class_id": class_id, "subject_id": subject_id},
    ).scalar_one_or_none()


def create_special_course(
    db: Session,
    class_id: UUID,
    student_id: UUID,
    subject_id: UUID,
    title: str,
    day_of_week: int,
    start_time: time,
    end_time: time,
    note: str | None,
    created_by_account_id: UUID,
    teacher_id: UUID | None = None,
    room_id: UUID | None = None,
) -> dict:
    """Crée un cours individuel et le publie s'il tombe à un moment réellement libre.

    Les contrôles de la base refusent le cours s'il tombe pendant un cours que
    l'élève suit, si l'enseignant ou la salle sont pris, si l'enseignant est
    indisponible, ou hors des horaires et pauses de l'école.
    """

    enrollment = _get_open_enrollment(db, str(student_id), class_id=class_id)
    if enrollment is None:
        raise ValueError("Cet élève n'a pas d'inscription active dans cette classe.")
    if teacher_id is None:
        teacher_id = _default_teacher_for_subject(db, class_id, subject_id)

    school_year = db.execute(
        text(
            """
            SELECT sy.start_date, sy.end_date
            FROM classes AS c
            JOIN school_years AS sy ON sy.id = c.school_year_id
            WHERE c.id = :class_id
            """
        ),
        {"class_id": class_id},
    ).mappings().one()

    try:
        row = db.execute(
            text(
                """
                INSERT INTO special_courses (
                    student_enrollment_id, subject_id, teacher_id, room_id, title,
                    day_of_week, start_time, end_time, note,
                    valid_from, valid_until, created_by_account_id
                ) VALUES (
                    :student_enrollment_id, :subject_id, :teacher_id, :room_id, :title,
                    :day_of_week, :start_time, :end_time, :note,
                    :valid_from, :valid_until, :created_by_account_id
                )
                RETURNING id
                """
            ),
            {
                "student_enrollment_id": enrollment.id,
                "subject_id": subject_id,
                "teacher_id": teacher_id,
                "room_id": room_id,
                "title": title.strip(),
                "day_of_week": day_of_week,
                "start_time": start_time,
                "end_time": end_time,
                "note": note.strip() if note else None,
                "valid_from": school_year["start_date"],
                "valid_until": school_year["end_date"],
                "created_by_account_id": created_by_account_id,
            },
        ).mappings().one()
        db.execute(
            text(
                """
                UPDATE special_courses
                SET status = 'PUBLISHED',
                    published_by_account_id = :account_id,
                    published_at = now()
                WHERE id = :id
                """
            ),
            {"id": row["id"], "account_id": created_by_account_id},
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(extract_postgres_error_message(exc)) from exc
    return dict(row)


def suggest_special_course_slots(
    db: Session,
    class_id: UUID,
    student_id: UUID,
    subject_id: UUID,
    minutes: int = 60,
    teacher_id: UUID | None = None,
    limit: int = 12,
) -> list[dict]:
    """Propose des créneaux où l'élève, l'enseignant et une salle sont tous libres.

    Un cours particulier ne se place jamais pendant un cours que l'élève suit
    (tronc commun et spécialités choisies) : on propose les heures sans cours, en
    fin de journée, le samedi si l'école y enseigne, etc.
    """

    enrollment = _get_open_enrollment(db, str(student_id), class_id=class_id)
    if enrollment is None:
        raise ValueError("Cet élève n'a pas d'inscription active dans cette classe.")
    if teacher_id is None:
        teacher_id = _default_teacher_for_subject(db, class_id, subject_id)
    if teacher_id is None:
        raise ValueError("Aucun enseignant n'est affecté à cette matière dans la classe.")
    if not 15 <= minutes <= 240:
        raise ValueError("La durée d'un cours particulier doit être comprise entre 15 minutes et 4 heures.")

    configuration = get_class_timetable_configuration(db, class_id)
    if not configuration["days"]:
        raise ValueError("Configurez d'abord les horaires du cycle pour cette année.")
    year_id = configuration["school_year_id"]

    student_lessons = db.execute(
        text(
            """
            SELECT slot.day_of_week, slot.start_time, slot.end_time
            FROM timetables AS timetable
            JOIN timetable_slots AS slot ON slot.timetable_id = timetable.id
            JOIN teacher_assignments AS assignment ON assignment.id = slot.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            WHERE timetable.class_id = :class_id
              AND timetable.status = 'PUBLISHED'
              AND (
                  NOT subject.is_specialty
                  OR EXISTS (
                      SELECT 1 FROM student_specialties AS choice
                      WHERE choice.student_enrollment_id = :enrollment_id
                        AND choice.subject_id = subject.id
                  )
              )

            UNION ALL

            SELECT special.day_of_week, special.start_time, special.end_time
            FROM special_courses AS special
            WHERE special.status = 'PUBLISHED'
              AND (special.student_enrollment_id = :enrollment_id OR special.class_id = :class_id)
            """
        ),
        {"class_id": class_id, "enrollment_id": enrollment.id},
    ).mappings().all()

    teacher_busy = get_teacher_busy_slots(db, None, year_id) + [
        dict(row) for row in db.execute(
            text(
                """
                SELECT teacher_id, day_of_week, start_time, end_time
                FROM special_courses
                WHERE status = 'PUBLISHED' AND teacher_id = :teacher_id
                """
            ),
            {"teacher_id": teacher_id},
        ).mappings().all()
    ]
    teacher_busy = [item for item in teacher_busy if item["teacher_id"] == teacher_id]
    rooms = list_rooms(db)
    room_busy = db.execute(
        text(
            """
            SELECT slot.room_id, slot.day_of_week, slot.start_time, slot.end_time
            FROM timetable_slots AS slot
            JOIN timetables AS timetable ON timetable.id = slot.timetable_id
            WHERE slot.room_id IS NOT NULL AND timetable.status = 'PUBLISHED'
            UNION ALL
            SELECT room_id, day_of_week, start_time, end_time
            FROM special_courses
            WHERE status = 'PUBLISHED' AND room_id IS NOT NULL
            """
        )
    ).mappings().all()
    teacher_name = db.execute(
        text("SELECT first_name || ' ' || last_name FROM teachers WHERE id = :id"), {"id": teacher_id}
    ).scalar_one_or_none()

    day_names = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    suggestions: list[dict] = []
    for day in configuration["days"]:
        day_start = _time_to_minutes(day["course_start_time"])
        day_end = _time_to_minutes(day["course_end_time"])
        breaks = [
            (_time_to_minutes(time.fromisoformat(str(item["start_time"]))),
             _time_to_minutes(time.fromisoformat(str(item["end_time"]))))
            for item in day["breaks"]
        ]
        lessons_today = sum(1 for lesson in student_lessons if lesson["day_of_week"] == day["day_of_week"])
        cursor = day_start
        while cursor + minutes <= day_end:
            start, end = _minutes_to_time(cursor), _minutes_to_time(cursor + minutes)
            window = (cursor, cursor + minutes)
            free = (
                not any(window[0] < b_end and window[1] > b_start for b_start, b_end in breaks)
                and not any(
                    lesson["day_of_week"] == day["day_of_week"]
                    and _periods_overlap(lesson["start_time"], lesson["end_time"], start, end)
                    for lesson in student_lessons
                )
                and not any(
                    item["day_of_week"] == day["day_of_week"]
                    and _periods_overlap(item["start_time"], item["end_time"], start, end)
                    for item in teacher_busy
                )
            )
            if free:
                room = next(
                    (
                        candidate for candidate in rooms
                        if not any(
                            busy["room_id"] == candidate["id"]
                            and busy["day_of_week"] == day["day_of_week"]
                            and _periods_overlap(busy["start_time"], busy["end_time"], start, end)
                            for busy in room_busy
                        )
                    ),
                    None,
                )
                if room is not None or not rooms:
                    suggestions.append(
                        {
                            "day_of_week": day["day_of_week"],
                            "day_label": day_names[day["day_of_week"] - 1],
                            "start_time": start,
                            "end_time": end,
                            "teacher_id": teacher_id,
                            "teacher_name": teacher_name,
                            "room_id": room["id"] if room else None,
                            "room_name": room["name"] if room else None,
                            "_rank": (lessons_today, day["day_of_week"], cursor),
                        }
                    )
            cursor += 30
    suggestions.sort(key=lambda item: item["_rank"])
    for item in suggestions:
        item.pop("_rank")
    return suggestions[:limit]


def list_class_special_courses(db: Session, class_id: str) -> list[dict]:
    """Liste les cours individuels des élèves actifs d'une classe."""

    rows = db.execute(
        text(
            """
            SELECT special.id, special.title, special.day_of_week,
                   special.start_time, special.end_time, special.note,
                   special.valid_from AS effective_start_date,
                   special.valid_until AS effective_end_date,
                   subject.name AS subject_name,
                   student.first_name AS student_first_name,
                   student.last_name AS student_last_name
            FROM special_courses AS special
            JOIN student_enrollments AS enrollment
              ON enrollment.id = special.student_enrollment_id
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN subjects AS subject ON subject.id = special.subject_id
            WHERE enrollment.class_id = :class_id
              AND enrollment.end_date IS NULL
            ORDER BY special.day_of_week, special.start_time
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def delete_special_course(db: Session, special_course_id: str) -> bool:
    """Supprime un cours particulier."""

    result = db.execute(
        text("DELETE FROM special_courses WHERE id = :id"),
        {"id": special_course_id},
    )
    db.commit()
    return result.rowcount > 0


def _get_breaks_for_class(db: Session, class_id: UUID | str) -> list[dict]:
    """Retourne les pauses (récréation, déjeuner…) applicables à une classe."""

    context = db.execute(
        text(
            """
            SELECT class.school_year_id, level.education_stage
            FROM classes AS class
            JOIN class_levels AS level ON level.id = class.class_level_id
            WHERE class.id = :class_id
            """
        ),
        {"class_id": class_id},
    ).mappings().first()
    if context is None:
        return []

    schedules = list_school_day_schedules(db, context["school_year_id"])
    breaks_by_key: dict[tuple, dict] = {}
    for schedule in schedules:
        if schedule["education_stage"] != context["education_stage"]:
            continue
        for school_break in schedule["breaks"]:
            key = (str(school_break["start_time"]), str(school_break["end_time"]), school_break["label"])
            breaks_by_key[key] = school_break
    return sorted(breaks_by_key.values(), key=lambda item: str(item["start_time"]))


def get_teacher_timetable(db: Session, teacher_id: str) -> dict:
    """Retourne uniquement le planning publié d'un enseignant."""

    rows = db.execute(
        text(
            """
            SELECT detail.slot_id AS id, detail.day_of_week,
                   detail.start_time, detail.end_time,
                   detail.class_subject_id, detail.subject_name,
                   detail.class_id,
                   level.name || ' ' || class.group_label AS class_name,
                   detail.room_name,
                   timetable.effective_start_date, timetable.effective_end_date
            FROM v_timetable_slots_detailed AS detail
            JOIN timetables AS timetable ON timetable.id = detail.timetable_id
            JOIN classes AS class ON class.id = detail.class_id
            JOIN class_levels AS level ON level.id = class.class_level_id
            WHERE detail.teacher_id = :teacher_id
              AND detail.status = 'PUBLISHED'
            ORDER BY detail.day_of_week, detail.start_time
            """
        ),
        {"teacher_id": teacher_id},
    ).mappings().all()
    slots = [dict(row) for row in rows]

    dated_rows = db.execute(
        text(
            """
            SELECT dated_slot.id,
                   EXTRACT(ISODOW FROM dated_slot.course_date)::smallint AS day_of_week,
                   dated_slot.start_time, dated_slot.end_time,
                   class_subject.id AS class_subject_id, subject.name AS subject_name,
                   class.id AS class_id,
                   level.name || ' ' || class.group_label AS class_name,
                   NULL::text AS room_name,
                   timetable.effective_start_date, timetable.effective_end_date,
                   dated_slot.course_date
            FROM timetable_date_slots AS dated_slot
            JOIN timetables AS timetable ON timetable.id = dated_slot.timetable_id
            JOIN teacher_assignments AS assignment ON assignment.id = dated_slot.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN classes AS class ON class.id = timetable.class_id
            JOIN class_levels AS level ON level.id = class.class_level_id
            WHERE assignment.teacher_id = :teacher_id
              AND timetable.status = 'PUBLISHED'
            """
        ),
        {"teacher_id": teacher_id},
    ).mappings().all()
    slots.extend(dict(row) for row in dated_rows)

    breaks: list[dict] = []
    first_class_id = next((slot["class_id"] for slot in slots if slot["class_id"]), None)
    if first_class_id is not None:
        breaks = _get_breaks_for_class(db, first_class_id)
    for slot in slots:
        slot.pop("class_id", None)

    return {"slots": slots, "breaks": breaks}


def get_student_timetable(db: Session, student_id: str) -> dict:
    """Retourne le planning publié de la classe et les cours individuels."""

    enrollment = _get_open_enrollment(db, student_id)
    if enrollment is None:
        return {"slots": [], "breaks": []}
    regular_slots = get_class_timetable(db, str(enrollment.class_id), published_only=True)
    for slot in regular_slots:
        slot["is_special"] = False

    chosen_specialty_subject_ids = {
        str(row[0])
        for row in db.execute(
            text(
                "SELECT subject_id FROM student_specialties WHERE student_enrollment_id = :enrollment_id"
            ),
            {"enrollment_id": enrollment.id},
        ).all()
    }
    regular_slots = [
        slot for slot in regular_slots
        if not slot.get("is_specialty")
        or str(slot.get("subject_id")) in chosen_specialty_subject_ids
    ]

    special_rows = db.execute(
        text(
            """
            SELECT special.id, special.title, special.day_of_week,
                   special.start_time, special.end_time, special.note,
                   special.valid_from AS effective_start_date,
                   special.valid_until AS effective_end_date,
                   subject.name AS subject_name,
                   NULLIF(concat_ws(' ', teacher.first_name, teacher.last_name), '') AS teacher_name,
                   room.name AS room_name
            FROM special_courses AS special
            JOIN subjects AS subject ON subject.id = special.subject_id
            LEFT JOIN teachers AS teacher ON teacher.id = special.teacher_id
            LEFT JOIN rooms AS room ON room.id = special.room_id
            WHERE special.status = 'PUBLISHED'
              AND (
                  special.student_enrollment_id = :enrollment_id
                  OR special.class_id = :class_id
              )
            ORDER BY special.day_of_week, special.start_time
            """
        ),
        {"enrollment_id": enrollment.id, "class_id": enrollment.class_id},
    ).mappings().all()
    special_slots = []
    for row in special_rows:
        entry = dict(row)
        entry.update(
            {
                "class_subject_id": None,
                "is_special": True,
            }
        )
        special_slots.append(entry)

    breaks = _get_breaks_for_class(db, enrollment.class_id)
    return {"slots": regular_slots + special_slots, "breaks": breaks}
