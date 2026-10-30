"""Tableau de bord de l'enseignant : ce qu'il doit faire aujourd'hui et ce qui l'attend."""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.school_holiday_service import find_holiday_on
from app.services.timetable_service import get_teacher_timetable

# Combien de jours on regarde en avant pour trouver le prochain cours.
NEXT_COURSE_SEARCH_DAYS = 21
INCOMPLETE_EVALUATIONS_SHOWN = 5


def _slot_applies_on(slot: dict, day: date) -> bool:
    """Un créneau publié s'applique à un jour : date précise, ou jour de semaine dans sa période."""

    if slot.get("course_date"):
        return slot["course_date"] == day
    if slot["day_of_week"] != day.isoweekday():
        return False
    start = slot.get("effective_start_date")
    end = slot.get("effective_end_date")
    return (start is None or start <= day) and (end is None or day <= end)


def _courses_on(slots: list[dict], day: date) -> list[dict]:
    courses = [
        {
            "date": day,
            "start_time": slot["start_time"],
            "end_time": slot["end_time"],
            "subject_name": slot["subject_name"],
            "class_name": slot["class_name"],
            "room_name": slot.get("room_name"),
        }
        for slot in slots
        if _slot_applies_on(slot, day)
    ]
    return sorted(courses, key=lambda course: course["start_time"])


def _get_incomplete_evaluations(db: Session, teacher_id: UUID, today: date) -> list[dict]:
    """Évaluations déjà passées de l'année courante dont il manque des notes."""

    rows = db.execute(
        text(
            """
            WITH mine AS (
                SELECT assessment.id, assessment.title, assessment.assessment_date,
                       subject.name AS subject_name,
                       concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                       school_class.id AS class_id
                FROM assessments AS assessment
                JOIN teacher_assignments AS assignment
                  ON assignment.id = assessment.teacher_assignment_id
                JOIN class_subjects AS class_subject
                  ON class_subject.id = assignment.class_subject_id
                JOIN subjects AS subject ON subject.id = class_subject.subject_id
                JOIN classes AS school_class ON school_class.id = class_subject.class_id
                JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
                JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
                WHERE assignment.teacher_id = :teacher_id
                  AND school_year.is_current
                  AND assessment.assessment_date <= :today
            )
            SELECT mine.id, mine.title, mine.assessment_date, mine.subject_name, mine.class_name,
                   (SELECT COUNT(*) FROM student_enrollments AS enrollment
                    WHERE enrollment.class_id = mine.class_id
                      AND enrollment.start_date <= mine.assessment_date
                      AND (enrollment.end_date IS NULL
                           OR enrollment.end_date >= mine.assessment_date))::integer AS expected_count,
                   (SELECT COUNT(*) FROM grades AS grade
                    WHERE grade.assessment_id = mine.id)::integer AS entered_count
            FROM mine
            ORDER BY mine.assessment_date
            """
        ),
        {"teacher_id": teacher_id, "today": today},
    ).mappings().all()
    return [dict(row) for row in rows if row["entered_count"] < row["expected_count"]]


def _count_corrections(db: Session, teacher_id: UUID, account_id: UUID) -> dict:
    """Demandes de correction à valider par l'enseignant (professeur principal) et les siennes en attente."""

    row = db.execute(
        text(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE school_class.main_teacher_id = :teacher_id
                      AND change_request.requested_by_account_id <> :account_id
                )::integer AS to_review,
                COUNT(*) FILTER (
                    WHERE change_request.requested_by_account_id = :account_id
                )::integer AS mine_waiting
            FROM grade_change_requests AS change_request
            JOIN grades AS grade ON grade.id = change_request.grade_id
            JOIN assessments AS assessment ON assessment.id = grade.assessment_id
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            WHERE change_request.status = 'PENDING'
            """
        ),
        {"teacher_id": teacher_id, "account_id": account_id},
    ).mappings().one()
    return {"to_review_count": row["to_review"], "my_waiting_count": row["mine_waiting"]}


def get_teacher_dashboard(
    db: Session, teacher_id: UUID, account_id: UUID, now: datetime | None = None
) -> dict:
    """Résumé de la journée et des tâches de l'enseignant connecté."""

    now = now or datetime.now()
    today = now.date()
    slots = get_teacher_timetable(db=db, teacher_id=str(teacher_id))["slots"]

    holiday_today = find_holiday_on(db, today)
    today_courses = [] if holiday_today else _courses_on(slots, today)

    next_course = None
    for offset in range(NEXT_COURSE_SEARCH_DAYS):
        day = today + timedelta(days=offset)
        if find_holiday_on(db, day):
            continue
        candidates = _courses_on(slots, day)
        if offset == 0:
            candidates = [course for course in candidates if course["end_time"] > now.time()]
        if candidates:
            next_course = candidates[0]
            break

    incomplete = _get_incomplete_evaluations(db, teacher_id, today)
    next_holiday = db.execute(
        text(
            """
            SELECT name, start_date, end_date FROM school_holidays
            WHERE end_date >= :today ORDER BY start_date LIMIT 1
            """
        ),
        {"today": today},
    ).mappings().first()

    return {
        "today": today,
        "holiday_today": holiday_today,
        "next_holiday": dict(next_holiday) if next_holiday else None,
        "today_courses": today_courses,
        "next_course": next_course,
        "incomplete_evaluations_count": len(incomplete),
        "incomplete_evaluations": incomplete[:INCOMPLETE_EVALUATIONS_SHOWN],
        **_count_corrections(db, teacher_id, account_id),
    }
