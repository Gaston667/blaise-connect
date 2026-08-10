"""Règles métier de configuration, génération et publication des emplois du temps."""

from datetime import date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.schemas.break_schedule_create import BreakScheduleCreate
from app.schemas.school_day_schedule_upsert import SchoolDayScheduleUpsert
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
                   level.education_stage
            FROM classes AS class
            JOIN class_levels AS level ON level.id = class.class_level_id
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
                subject.name AS subject_name,
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

    db.execute(
        text("DELETE FROM timetables WHERE class_id = :class_id AND status = 'DRAFT'"),
        {"class_id": class_id},
    )
    timetable = db.execute(
        text(
            """
            INSERT INTO timetables (
                class_id, version, status, generated_by_account_id
            )
            SELECT :class_id, COALESCE(MAX(version), 0) + 1,
                   'DRAFT', :generated_by_account_id
            FROM timetables
            WHERE class_id = :class_id
            RETURNING id, version, status
            """
        ),
        {
            "class_id": class_id,
            "generated_by_account_id": generated_by_account_id,
        },
    ).mappings().one()

    busy_slots = get_teacher_busy_slots(db, str(class_id))
    used_subjects_by_day: dict[int, set[UUID]] = {}
    created_slots: list[dict] = []
    for candidate in _build_available_periods(configuration):
        day_subjects = used_subjects_by_day.setdefault(candidate["day_of_week"], set())
        available_subjects = [
            subject
            for subject in subjects
            if subject["remaining_minutes"] > 0
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
        effective_duration = min(candidate["duration"], selected["remaining_minutes"])
        effective_end = _minutes_to_time(
            _time_to_minutes(candidate["start_time"]) + effective_duration
        )
        row = db.execute(
            text(
                """
                INSERT INTO timetable_slots (
                    timetable_id, teacher_assignment_id,
                    day_of_week, start_time, end_time
                ) VALUES (
                    :timetable_id, :teacher_assignment_id,
                    :day_of_week, :start_time, :end_time
                )
                RETURNING id, day_of_week, start_time, end_time
                """
            ),
            {
                "timetable_id": timetable["id"],
                "teacher_assignment_id": selected["assignment_id"],
                "day_of_week": candidate["day_of_week"],
                "start_time": candidate["start_time"],
                "end_time": effective_end,
            },
        ).mappings().one()
        created_slots.append({**dict(row), "subject_name": selected["subject_name"]})
        selected["remaining_minutes"] -= effective_duration
        day_subjects.add(selected["class_subject_id"])

    unplaced = [
        {
            "class_subject_id": subject["class_subject_id"],
            "subject_name": subject["subject_name"],
            "remaining_minutes": subject["remaining_minutes"],
        }
        for subject in subjects
        if subject["remaining_minutes"] > 0
    ]
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("La proposition contient un conflit de planning.") from exc

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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("Validation impossible : le planning contient un conflit.") from exc
    return dict(row)


def get_teacher_busy_slots(db: Session, exclude_class_id: str | None) -> list[dict]:
    """Retourne les occupations publiées des enseignants."""

    rows = db.execute(
        text(
            """
            SELECT assignment.teacher_id, slot.day_of_week,
                   slot.start_time, slot.end_time
            FROM timetable_slots AS slot
            JOIN timetables AS timetable ON timetable.id = slot.timetable_id
            JOIN teacher_assignments AS assignment
              ON assignment.id = slot.teacher_assignment_id
            WHERE timetable.status = 'PUBLISHED'
              AND (
                  CAST(:exclude_class_id AS uuid) IS NULL
                  OR timetable.class_id <> CAST(:exclude_class_id AS uuid)
              )
            """
        ),
        {"exclude_class_id": exclude_class_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def get_class_timetable(db: Session, class_id: str, published_only: bool = False) -> list[dict]:
    """Retourne le planning publié, ou le brouillon prioritaire pour l'admin."""

    status_filter = "timetable.status = 'PUBLISHED'" if published_only else "timetable.status IN ('DRAFT', 'PUBLISHED')"
    rows = db.execute(
        text(
            f"""
            SELECT detail.slot_id AS id, detail.timetable_id, detail.version,
                   detail.status, detail.day_of_week, detail.start_time,
                   detail.end_time, detail.class_subject_id,
                   detail.subject_name, detail.teacher_name, detail.room_name,
                   level.education_stage
            FROM v_timetable_slots_detailed AS detail
            JOIN timetables AS timetable ON timetable.id = detail.timetable_id
            JOIN classes AS class ON class.id = detail.class_id
            JOIN class_levels AS level ON level.id = class.class_level_id
            WHERE detail.class_id = :class_id
              AND {status_filter}
              AND timetable.status = (
                  SELECT CASE
                      WHEN :published_only THEN 'PUBLISHED'::timetable_status_enum
                      WHEN EXISTS (
                          SELECT 1 FROM timetables AS draft
                          WHERE draft.class_id = :class_id AND draft.status = 'DRAFT'
                      ) THEN 'DRAFT'::timetable_status_enum
                      ELSE 'PUBLISHED'::timetable_status_enum
                  END
              )
            ORDER BY detail.day_of_week, detail.start_time
            """
        ),
        {"class_id": class_id, "published_only": published_only},
    ).mappings().all()
    return [dict(row) for row in rows]


def _get_or_create_draft(
    db: Session,
    class_id: UUID,
    generated_by_account_id: UUID,
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
    return db.execute(
        text(
            """
            INSERT INTO timetables (class_id, version, generated_by_account_id)
            SELECT :class_id, COALESCE(MAX(version), 0) + 1, :account_id
            FROM timetables WHERE class_id = :class_id
            RETURNING id
            """
        ),
        {"class_id": class_id, "account_id": generated_by_account_id},
    ).scalar_one()


def create_timetable_slot(
    db: Session,
    class_id: UUID,
    class_subject_id: UUID,
    day_of_week: int,
    start_time: time,
    end_time: time,
    room_id: UUID | None,
    generated_by_account_id: UUID,
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

    timetable_id = _get_or_create_draft(db, class_id, generated_by_account_id)
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


def _get_open_enrollment(db: Session, student_id: str, class_id: UUID | None = None):
    """Retourne l'inscription ouverte d'un élève."""

    return db.execute(
        text(
            """
            SELECT enrollment.id, enrollment.class_id
            FROM student_enrollments AS enrollment
            WHERE enrollment.student_id = :student_id
              AND enrollment.end_date IS NULL
              AND (:class_id IS NULL OR enrollment.class_id = :class_id)
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
) -> dict:
    """Crée un cours individuel sans plage horaire codée en dur."""

    enrollment = _get_open_enrollment(db, str(student_id), class_id=class_id)
    if enrollment is None:
        raise ValueError("Cet élève n'a pas d'inscription active dans cette classe.")
    row = db.execute(
        text(
            """
            INSERT INTO special_courses (
                student_enrollment_id, subject_id, title,
                day_of_week, start_time, end_time, note
            ) VALUES (
                :student_enrollment_id, :subject_id, :title,
                :day_of_week, :start_time, :end_time, :note
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


def get_teacher_timetable(db: Session, teacher_id: str) -> list[dict]:
    """Retourne uniquement le planning publié d'un enseignant."""

    rows = db.execute(
        text(
            """
            SELECT detail.slot_id AS id, detail.day_of_week,
                   detail.start_time, detail.end_time,
                   detail.class_subject_id, detail.subject_name,
                   level.name || ' ' || class.group_label AS class_name,
                   detail.room_name
            FROM v_timetable_slots_detailed AS detail
            JOIN classes AS class ON class.id = detail.class_id
            JOIN class_levels AS level ON level.id = class.class_level_id
            WHERE detail.teacher_id = :teacher_id
              AND detail.status = 'PUBLISHED'
            ORDER BY detail.day_of_week, detail.start_time
            """
        ),
        {"teacher_id": teacher_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def get_student_timetable(db: Session, student_id: str) -> list[dict]:
    """Retourne le planning publié de la classe et les cours individuels."""

    enrollment = _get_open_enrollment(db, student_id)
    if enrollment is None:
        return []
    regular_slots = get_class_timetable(db, str(enrollment.class_id), published_only=True)
    for slot in regular_slots:
        slot["is_special"] = False

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
    return regular_slots + special_slots
