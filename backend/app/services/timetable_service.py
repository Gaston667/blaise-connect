"""Règles métier de configuration, génération et publication des emplois du temps."""

from datetime import date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.postgres_error_message import extract_postgres_error_message
from app.schemas.break_schedule_create import BreakScheduleCreate
from app.schemas.school_day_schedule_upsert import SchoolDayScheduleUpsert
from app.schemas.weekly_subject_requirement_upsert import (
    WeeklySubjectRequirementUpsert,
)

# Ces matieres sont les seules a pouvoir occuper un creneau d'une heure ;
# toutes les autres matieres regulieres (college et lycee) se placent en
# blocs de 2 heures.
SINGLE_HOUR_SUBJECT_NAMES = {
    "Enseignement moral et civique (EMC)",
    "EMC",
    "Anglais",
    "Espagnol",
}


def _time_to_minutes(value: time) -> int:
    """Convertit une heure en nombre de minutes depuis minuit."""

    return value.hour * 60 + value.minute


def _minutes_to_time(value: int) -> time:
    """Convertit un nombre de minutes depuis minuit en heure."""

    return time(hour=value // 60, minute=value % 60)


def _periods_overlap(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    """Indique si deux intervalles semi-ouverts se chevauchent."""

    return start_a < end_b and end_a > start_b


def _remaining_minutes_sort_key(item: dict) -> tuple[int, str]:
    """Trie les matières par volume restant puis par nom."""

    return (-item["remaining_minutes"], item["subject_name"])


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


def get_student_specialty_overlaps(db: Session, class_id: UUID | str) -> list[dict]:
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
              AND timetable.status = 'DRAFT'
              AND first_subject.id <> second_subject.id
              AND first_subject.id::text < second_subject.id::text
            ORDER BY student.last_name, student.first_name, first_slot.day_of_week, first_slot.start_time
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    return [dict(row) for row in rows]


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


def _build_double_periods(periods: list[dict]) -> list[dict]:
    """Fusionne deux créneaux consécutifs (même jour, sans pause entre eux)
    en un bloc de 2 heures, utilisé pour les cours de spécialité qui ne se
    placent jamais sur une heure isolée.
    """

    double_periods: list[dict] = []
    for first, second in zip(periods, periods[1:]):
        if first["day_of_week"] != second["day_of_week"]:
            continue
        if first["end_time"] != second["start_time"]:
            continue
        total_duration = first["duration"] + second["duration"]
        if total_duration != 120:
            continue
        double_periods.append(
            {
                "day_of_week": first["day_of_week"],
                "start_time": first["start_time"],
                "end_time": second["end_time"],
                "duration": total_duration,
                "covered_period_starts": [first["start_time"], second["start_time"]],
            }
        )
    return double_periods


def _teacher_is_busy(
    busy_slots: list[dict],
    teacher_id: UUID,
    candidate: dict,
) -> bool:
    """Vérifie si un enseignant est pris sur un planning déjà validé."""

    for busy_slot in busy_slots:
        if busy_slot["teacher_id"] != teacher_id:
            continue
        if busy_slot["day_of_week"] != candidate["day_of_week"]:
            continue
        if _periods_overlap(
            busy_slot["start_time"],
            busy_slot["end_time"],
            candidate["start_time"],
            candidate["end_time"],
        ):
            return True
    return False


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

    _save_requirements(db, class_id, requirements)
    configuration = get_class_timetable_configuration(db, class_id)
    if not configuration["days"]:
        raise ValueError("Configurez d'abord les horaires du cycle pour cette année.")

    subjects = _get_generation_subjects(db, class_id)
    if not subjects:
        raise ValueError("Aucune matière avec enseignant et volume horaire n'est disponible.")

    school_year_id = configuration["school_year_id"]
    if target_start_date > target_end_date:
        raise ValueError("La date de fin de génération doit être postérieure à la date de début.")
    if (
        target_start_date < configuration["school_year_start_date"]
        or target_end_date > configuration["school_year_end_date"]
    ):
        raise ValueError("La plage de génération doit rester comprise dans l'année scolaire.")

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
            "school_year_id": school_year_id,
            "requested_by_account_id": generated_by_account_id,
            "target_start_date": target_start_date,
            "target_end_date": target_end_date,
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
            "effective_start_date": target_start_date,
            "effective_end_date": target_end_date,
            "created_by_account_id": generated_by_account_id,
            "generation_run_id": generation_run["id"],
        },
    ).mappings().one()

    busy_slots = get_teacher_busy_slots(
        db, str(class_id), school_year_id,
        include_drafts=True,
        target_start_date=target_start_date,
        target_end_date=target_end_date,
    )
    busy_rooms = get_room_busy_slots(
        db, str(class_id), school_year_id, target_start_date, target_end_date
    )
    available_rooms = list_rooms(db)
    specialty_subjects = [subject for subject in subjects if subject["is_specialty"]]
    regular_subjects = [subject for subject in subjects if not subject["is_specialty"]]
    all_periods = _build_available_periods(configuration)

    # Les cours particuliers publiés (classe entière ou élève de la classe)
    # occupent déjà un créneau : on ne les propose pas au générateur, pour
    # éviter un conflit détecté seulement à la publication.
    reserved_periods = db.execute(
        text(
            """
            SELECT DISTINCT special_course.day_of_week, special_course.start_time, special_course.end_time
            FROM special_courses AS special_course
            LEFT JOIN student_enrollments AS enrollment
              ON enrollment.id = special_course.student_enrollment_id
            WHERE special_course.status = 'PUBLISHED'
              AND (
                  special_course.class_id = :class_id
                  OR enrollment.class_id = :class_id
              )
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    all_periods = [
        period for period in all_periods
        if not any(
            period["day_of_week"] == reserved["day_of_week"]
            and period["start_time"] < reserved["end_time"]
            and period["end_time"] > reserved["start_time"]
            for reserved in reserved_periods
        )
    ]

    used_subjects_by_day: dict[int, set[UUID]] = {}
    created_slots: list[dict] = []

    def _insert_slot(candidate, selected, effective_duration, room_id=None):
        effective_end = _minutes_to_time(
            _time_to_minutes(candidate["start_time"]) + effective_duration
        )
        row = db.execute(
            text(
                """
                INSERT INTO timetable_slots (
                    timetable_id, teacher_assignment_id, room_id,
                    day_of_week, start_time, end_time
                ) VALUES (
                    :timetable_id, :teacher_assignment_id, :room_id,
                    :day_of_week, :start_time, :end_time
                )
                RETURNING id, day_of_week, start_time, end_time
                """
            ),
            {
                "timetable_id": timetable["id"],
                "teacher_assignment_id": selected["assignment_id"],
                "room_id": room_id,
                "day_of_week": candidate["day_of_week"],
                "start_time": candidate["start_time"],
                "end_time": effective_end,
            },
        ).mappings().one()
        created_slots.append({**dict(row), "subject_name": selected["subject_name"]})
        selected["remaining_minutes"] -= effective_duration
        used_subjects_by_day.setdefault(candidate["day_of_week"], set()).add(
            selected["class_subject_id"]
        )

    # Les spécialités se placent en blocs de 2 heures (jamais une heure
    # isolée), chacune dans sa propre salle, jamais deux fois le même jour
    # pour une même spécialité. Deux spécialités choisies par un même élève ne
    # doivent jamais se chevaucher : elles vont donc dans des « barrettes »
    # (blocs horaires) différentes, alors que deux spécialités qu'aucun élève
    # ne combine peuvent partager la même barrette.
    used_period_keys: set[tuple[int, time]] = set()
    if specialty_subjects:
        conflicting_pairs = _get_specialty_conflicting_pairs(db, class_id)
        conflict_count = {
            subject["subject_id"]: sum(1 for pair in conflicting_pairs if subject["subject_id"] in pair)
            for subject in specialty_subjects
        }
        double_periods = _build_double_periods(all_periods)
        placed_blocks: list[dict] = []

        def _overlapping_blocks(candidate):
            return [
                block for block in placed_blocks
                if block["day_of_week"] == candidate["day_of_week"]
                and _periods_overlap(
                    block["start_time"], block["end_time"],
                    candidate["start_time"], candidate["end_time"],
                )
            ]

        def _specialty_fits(subject, candidate):
            if any(
                block["subject_id"] == subject["subject_id"]
                and block["day_of_week"] == candidate["day_of_week"]
                for block in placed_blocks
            ):
                return False
            if _teacher_is_busy(busy_slots, subject["teacher_id"], candidate):
                return False
            for block in _overlapping_blocks(candidate):
                if block["teacher_id"] == subject["teacher_id"]:
                    return False
                if frozenset((block["subject_id"], subject["subject_id"])) in conflicting_pairs:
                    return False
            return True

        # Les spécialités les plus contraintes sont placées en premier.
        for subject in sorted(
            specialty_subjects,
            key=lambda item: (-conflict_count[item["subject_id"]], item["subject_name"]),
        ):
            while subject["remaining_minutes"] >= 120:
                reusable_starts = {
                    (block["day_of_week"], block["start_time"]) for block in placed_blocks
                }
                ordered_candidates = sorted(
                    double_periods,
                    key=lambda item: 0 if (item["day_of_week"], item["start_time"]) in reusable_starts else 1,
                )
                candidate = next(
                    (item for item in ordered_candidates if _specialty_fits(subject, item)),
                    None,
                )
                if candidate is None:
                    break
                taken_rooms = {block["room_id"] for block in _overlapping_blocks(candidate)}
                taken_rooms |= {
                    busy_room["room_id"] for busy_room in busy_rooms
                    if busy_room["day_of_week"] == candidate["day_of_week"]
                    and _periods_overlap(
                        busy_room["start_time"], busy_room["end_time"],
                        candidate["start_time"], candidate["end_time"],
                    )
                }
                room_id = next(
                    (room["id"] for room in available_rooms if room["id"] not in taken_rooms),
                    None,
                )
                _insert_slot(candidate, subject, 120, room_id)
                placed_blocks.append(
                    {
                        "day_of_week": candidate["day_of_week"],
                        "start_time": candidate["start_time"],
                        "end_time": candidate["end_time"],
                        "subject_id": subject["subject_id"],
                        "teacher_id": subject["teacher_id"],
                        "room_id": room_id,
                    }
                )
                for period_start in candidate["covered_period_starts"]:
                    used_period_keys.add((candidate["day_of_week"], period_start))

    # Seules l'EMC, l'anglais et l'espagnol peuvent occuper une heure isolée ;
    # toutes les autres matières (collège comme lycée) se placent en blocs
    # de 2 heures.
    single_hour_subjects = [
        subject for subject in regular_subjects
        if subject["subject_name"] in SINGLE_HOUR_SUBJECT_NAMES
    ]
    double_hour_subjects = [
        subject for subject in regular_subjects
        if subject["subject_name"] not in SINGLE_HOUR_SUBJECT_NAMES
    ]

    if double_hour_subjects:
        for candidate in _build_double_periods(all_periods):
            period_starts = candidate["covered_period_starts"]
            keys = [(candidate["day_of_week"], start) for start in period_starts]
            if any(key in used_period_keys for key in keys):
                continue
            day_subjects = used_subjects_by_day.setdefault(candidate["day_of_week"], set())
            available_subjects = [
                subject
                for subject in double_hour_subjects
                if subject["remaining_minutes"] >= 120
                and not _teacher_is_busy(busy_slots, subject["teacher_id"], candidate)
            ]
            if not available_subjects:
                continue
            unused_subjects = [
                subject
                for subject in available_subjects
                if subject["class_subject_id"] not in day_subjects
            ]
            candidates = unused_subjects or available_subjects
            candidates.sort(key=_remaining_minutes_sort_key)
            selected = candidates[0]
            _insert_slot(candidate, selected, 120)
            for key in keys:
                used_period_keys.add(key)

    # Une matière à double-heure dont le volume restant n'atteint plus 2h
    # (ex. 3h demandées = un bloc de 2h + un reliquat d'1h) peut compléter
    # ce reliquat sur une heure isolée, plutôt que de rester incomplète.
    completion_subjects = [
        subject for subject in double_hour_subjects
        if 0 < subject["remaining_minutes"] < 120
    ]
    single_hour_subjects = single_hour_subjects + completion_subjects

    for candidate in all_periods:
        if (candidate["day_of_week"], candidate["start_time"]) in used_period_keys:
            continue
        day_subjects = used_subjects_by_day.setdefault(candidate["day_of_week"], set())
        available_subjects = [
            subject
            for subject in single_hour_subjects
            if subject["remaining_minutes"] >= candidate["duration"]
            and not _teacher_is_busy(busy_slots, subject["teacher_id"], candidate)
        ]
        if not available_subjects:
            continue
        unused_subjects = [
            subject
            for subject in available_subjects
            if subject["class_subject_id"] not in day_subjects
        ]
        candidates = unused_subjects or available_subjects
        candidates.sort(key=_remaining_minutes_sort_key)
        selected = candidates[0]
        _insert_slot(candidate, selected, candidate["duration"])

    unplaced = [
        {
            "class_subject_id": subject["class_subject_id"],
            "subject_name": subject["subject_name"],
            "remaining_minutes": subject["remaining_minutes"],
            "requested_minutes": subject["weekly_minutes"],
            "placed_minutes": subject["weekly_minutes"] - subject["remaining_minutes"],
        }
        for subject in subjects
        if subject["remaining_minutes"] > 0
    ]
    for item in unplaced:
        item["reason"] = "Plus assez de créneaux libres, ou enseignant déjà occupé."

    # Une matière demandée sans enseignant actif n'est jamais générée : on la
    # signale au lieu de la laisser disparaître silencieusement.
    generated_ids = {subject["class_subject_id"] for subject in subjects}
    requested_minutes_by_id = {
        requirement.class_subject_id: requirement.weekly_minutes for requirement in requirements
    }
    missing_ids = [
        class_subject_id for class_subject_id in requested_minutes_by_id
        if class_subject_id not in generated_ids
    ]
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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(extract_postgres_error_message(exc)) from exc

    return {
        "timetable_id": timetable["id"],
        "version": timetable["version"],
        "status": timetable["status"],
        "slots": created_slots,
        "unplaced_requirements": unplaced,
    }


def validate_timetable(
    db: Session,
    class_id: UUID,
    validated_by_account_id: UUID,
) -> dict:
    """Publie atomiquement le brouillon d'une classe."""

    draft = db.execute(
        text(
            """
            SELECT timetable.id
            FROM timetables AS timetable
            WHERE timetable.class_id = :class_id
              AND timetable.status = 'DRAFT'
            FOR UPDATE
            """
        ),
        {"class_id": class_id},
    ).mappings().first()
    if draft is None:
        raise ValueError("Aucune proposition n'est disponible pour cette classe.")

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
        raise ValueError(
            "Publication impossible : un élève a deux spécialités en même temps. "
            f"{details}{extra}. Régénérez le brouillon ou déplacez un cours."
        )

    incomplete = get_incomplete_requirements(db, draft["id"])
    if incomplete:
        details = "; ".join(
            f"{item['subject_name']} {item['placed_minutes'] / 60:g} h sur {item['requested_minutes'] / 60:g} h"
            for item in incomplete[:5]
        )
        extra = f" (et {len(incomplete) - 5} autre(s))" if len(incomplete) > 5 else ""
        raise ValueError(
            "Publication impossible : volume horaire incomplet. "
            f"{details}{extra}. Ajoutez les créneaux manquants ou régénérez le brouillon."
        )

    db.execute(
        text(
            """
            UPDATE timetables
            SET status = 'ARCHIVED'
            WHERE class_id = :class_id AND status = 'PUBLISHED'
            """
        ),
        {"class_id": class_id},
    )
    try:
        row = db.execute(
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
            {"account_id": validated_by_account_id, "timetable_id": draft["id"]},
        ).mappings().one()
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(extract_postgres_error_message(exc)) from exc
    return dict(row)


def get_teacher_busy_slots(
    db: Session,
    exclude_class_id: str | None,
    school_year_id: UUID | str | None = None,
    include_drafts: bool = False,
    target_start_date: date | None = None,
    target_end_date: date | None = None,
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
              AND (
                  CAST(:exclude_class_id AS uuid) IS NULL
                  OR timetable.class_id <> CAST(:exclude_class_id AS uuid)
              )
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
            "exclude_class_id": exclude_class_id,
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
              AND timetable.class_id <> CAST(:exclude_class_id AS uuid)
              AND slot_class.school_year_id = CAST(:school_year_id AS uuid)
              AND timetable.effective_end_date >= :target_start_date
              AND timetable.effective_start_date <= :target_end_date
            """
        ),
        {
            "exclude_class_id": exclude_class_id,
            "school_year_id": school_year_id,
            "target_start_date": target_start_date,
            "target_end_date": target_end_date,
        },
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
                    day_of_week, start_time, end_time
                ) VALUES (
                    :timetable_id, :teacher_assignment_id, :room_id,
                    :day_of_week, :start_time, :end_time
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
                    course_date, start_time, end_time
                ) VALUES (
                    :timetable_id, :teacher_assignment_id, :room_id,
                    :course_date, :start_time, :end_time
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
) -> dict:
    """Crée un cours individuel sans plage horaire codée en dur."""

    enrollment = _get_open_enrollment(db, str(student_id), class_id=class_id)
    if enrollment is None:
        raise ValueError("Cet élève n'a pas d'inscription active dans cette classe.")

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

    row = db.execute(
        text(
            """
            INSERT INTO special_courses (
                student_enrollment_id, subject_id, title,
                day_of_week, start_time, end_time, note,
                valid_from, valid_until, created_by_account_id
            ) VALUES (
                :student_enrollment_id, :subject_id, :title,
                :day_of_week, :start_time, :end_time, :note,
                :valid_from, :valid_until, :created_by_account_id
            )
            RETURNING id
            """
        ),
        {
            "student_enrollment_id": enrollment.id,
            "subject_id": subject_id,
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
    db.commit()
    return dict(row)


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
                   subject.name AS subject_name
            FROM special_courses AS special
            JOIN subjects AS subject ON subject.id = special.subject_id
            WHERE special.student_enrollment_id = :enrollment_id
            ORDER BY special.day_of_week, special.start_time
            """
        ),
        {"enrollment_id": enrollment.id},
    ).mappings().all()
    special_slots = []
    for row in special_rows:
        entry = dict(row)
        entry.update(
            {
                "class_subject_id": None,
                "teacher_name": None,
                "room_name": None,
                "is_special": True,
            }
        )
        special_slots.append(entry)

    breaks = _get_breaks_for_class(db, enrollment.class_id)
    return {"slots": regular_slots + special_slots, "breaks": breaks}
