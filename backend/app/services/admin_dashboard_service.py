"""Agrégations du tableau de bord administrateur."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


_CYCLE_LABELS = {
    "PRESCHOOL": "Primaire",
    "PRIMARY": "Primaire",
    "MIDDLE_SCHOOL": "Collège",
    "HIGH_SCHOOL": "Lycée",
}


def _get_current_school_year_id(db: Session) -> UUID | None:
    return db.execute(
        text("SELECT id FROM school_years WHERE is_current = true LIMIT 1")
    ).scalar_one_or_none()


def _count_absences_pending_justification(db: Session, school_year_id: UUID) -> int:
    return db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM attendance_records AS record
            JOIN attendance_events AS event ON event.id = record.attendance_event_id
            JOIN teacher_assignments AS assignment ON assignment.id = event.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            WHERE school_class.school_year_id = :school_year_id
              AND record.justification_status = 'PENDING'
              AND record.deleted_at IS NULL
            """
        ),
        {"school_year_id": school_year_id},
    ).scalar_one()


def _count_correction_requests_pending(db: Session, school_year_id: UUID) -> int:
    return db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM grade_change_requests AS request
            JOIN grades AS grade ON grade.id = request.grade_id
            JOIN assessments AS assessment ON assessment.id = grade.assessment_id
            JOIN teacher_assignments AS assignment ON assignment.id = assessment.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            WHERE school_class.school_year_id = :school_year_id
              AND request.status = 'PENDING'
            """
        ),
        {"school_year_id": school_year_id},
    ).scalar_one()


def _count_report_cards_pending(db: Session, school_year_id: UUID) -> int:
    return db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM report_cards AS report_card
            JOIN student_enrollments AS enrollment ON enrollment.id = report_card.student_enrollment_id
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            WHERE school_class.school_year_id = :school_year_id
              AND report_card.validated_at IS NULL
            """
        ),
        {"school_year_id": school_year_id},
    ).scalar_one()


def _get_evaluation_progress(db: Session, school_year_id: UUID) -> dict:
    """Volume de notes attendues (une par élève inscrit et par évaluation) vs saisies."""

    row = db.execute(
        text(
            """
            WITH expected AS (
                SELECT assessment.id AS assessment_id, COUNT(enrollment.id) AS enrolled_count
                FROM assessments AS assessment
                JOIN teacher_assignments AS assignment
                  ON assignment.id = assessment.teacher_assignment_id
                JOIN class_subjects AS class_subject
                  ON class_subject.id = assignment.class_subject_id
                JOIN classes AS school_class
                  ON school_class.id = class_subject.class_id
                JOIN student_enrollments AS enrollment
                  ON enrollment.class_id = school_class.id
                 AND assessment.assessment_date >= enrollment.start_date
                 AND assessment.assessment_date <= COALESCE(enrollment.end_date, assessment.assessment_date)
                WHERE school_class.school_year_id = :school_year_id
                GROUP BY assessment.id
            )
            SELECT
                COALESCE(SUM(expected.enrolled_count), 0)::integer AS total_expected,
                COALESCE((
                    SELECT COUNT(*)
                    FROM grades AS grade
                    JOIN assessments AS assessment ON assessment.id = grade.assessment_id
                    WHERE assessment.id IN (SELECT assessment_id FROM expected)
                ), 0)::integer AS total_entered
            FROM expected
            """
        ),
        {"school_year_id": school_year_id},
    ).mappings().one()

    total_expected = row["total_expected"]
    total_entered = row["total_entered"]
    percent = round((total_entered / total_expected) * 100) if total_expected > 0 else 0
    return {"entered": total_entered, "total": total_expected, "percent": percent}


def _count_evaluations_incomplete(db: Session, school_year_id: UUID) -> int:
    """Nombre d'évaluations dont il manque au moins une note."""

    return db.execute(
        text(
            """
            WITH expected AS (
                SELECT assessment.id AS assessment_id, COUNT(enrollment.id) AS enrolled_count
                FROM assessments AS assessment
                JOIN teacher_assignments AS assignment
                  ON assignment.id = assessment.teacher_assignment_id
                JOIN class_subjects AS class_subject
                  ON class_subject.id = assignment.class_subject_id
                JOIN classes AS school_class
                  ON school_class.id = class_subject.class_id
                JOIN student_enrollments AS enrollment
                  ON enrollment.class_id = school_class.id
                 AND assessment.assessment_date >= enrollment.start_date
                 AND assessment.assessment_date <= COALESCE(enrollment.end_date, assessment.assessment_date)
                WHERE school_class.school_year_id = :school_year_id
                GROUP BY assessment.id
            ),
            entered AS (
                SELECT assessment_id, COUNT(*) AS grade_count
                FROM grades
                WHERE assessment_id IN (SELECT assessment_id FROM expected)
                GROUP BY assessment_id
            )
            SELECT COUNT(*)
            FROM expected
            LEFT JOIN entered ON entered.assessment_id = expected.assessment_id
            WHERE COALESCE(entered.grade_count, 0) < expected.enrolled_count
            """
        ),
        {"school_year_id": school_year_id},
    ).scalar_one()


def _get_cycle_performance(db: Session, school_year_id: UUID) -> list[dict]:
    """Moyenne générale par cycle, avec l'historique des périodes de notation."""

    rows = db.execute(
        text(
            """
            SELECT
                class_level.education_stage,
                reporting_period.name AS period_name,
                reporting_period.start_date,
                SUM(
                    CASE
                        WHEN grade.result_type = 'SCORED' THEN (grade.score / assessment.maximum_score) * 20
                        WHEN grade.result_type = 'ABSENT' AND grade.justification_status IN ('UNJUSTIFIED', 'REJECTED') THEN 0
                        ELSE NULL
                    END * assessment.coefficient
                ) / NULLIF(SUM(
                    CASE WHEN grade.result_type = 'SCORED'
                        OR (grade.result_type = 'ABSENT' AND grade.justification_status IN ('UNJUSTIFIED', 'REJECTED'))
                    THEN assessment.coefficient END
                ), 0) AS average
            FROM grades AS grade
            JOIN assessments AS assessment ON assessment.id = grade.assessment_id
            JOIN teacher_assignments AS assignment ON assignment.id = assessment.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            JOIN reporting_periods AS reporting_period
              ON reporting_period.school_year_id = school_class.school_year_id
             AND assessment.assessment_date BETWEEN reporting_period.start_date AND reporting_period.end_date
            WHERE school_class.school_year_id = :school_year_id
            GROUP BY class_level.education_stage, reporting_period.id, reporting_period.name, reporting_period.start_date
            ORDER BY reporting_period.start_date
            """
        ),
        {"school_year_id": school_year_id},
    ).mappings().all()

    cycles: dict[str, list[dict]] = {}
    for row in rows:
        cycle_label = _CYCLE_LABELS.get(row["education_stage"])
        if cycle_label is None or row["average"] is None:
            continue
        cycles.setdefault(cycle_label, []).append(
            {"period_name": row["period_name"], "average": float(row["average"])}
        )

    result = []
    for cycle_label in ("Primaire", "Collège", "Lycée"):
        periods = cycles.get(cycle_label, [])
        if not periods:
            continue
        result.append(
            {
                "label": cycle_label,
                "average": periods[-1]["average"],
                "periods": periods[-5:],
            }
        )
    return result


def _get_attendance_watchlist(db: Session, school_year_id: UUID, limit: int = 5) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT
                concat_ws(' ', student.first_name, student.last_name) AS student_name,
                concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                COUNT(record.id)::integer AS absence_count
            FROM attendance_records AS record
            JOIN attendance_events AS event ON event.id = record.attendance_event_id
            JOIN student_enrollments AS enrollment ON enrollment.id = record.student_enrollment_id
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            WHERE school_class.school_year_id = :school_year_id
              AND record.incident_type = 'ABSENT'
              AND record.deleted_at IS NULL
              AND enrollment.end_date IS NULL
            GROUP BY student.id, student.first_name, student.last_name, class_level.name, school_class.group_label
            ORDER BY absence_count DESC
            LIMIT :limit
            """
        ),
        {"school_year_id": school_year_id, "limit": limit},
    ).mappings().all()
    return [dict(row) for row in rows]


def _get_recent_activity(db: Session, school_year_id: UUID, limit: int = 5) -> list[dict]:
    rows = db.execute(
        text(
            """
            (
                SELECT
                    'justification' AS kind,
                    record.updated_at AS happened_at,
                    concat_ws(' ', student.first_name, student.last_name) AS actor_name,
                    concat_ws(' ', class_level.name, school_class.group_label) AS context_class,
                    event.attendance_date AS context_date,
                    NULL::text AS context_subject
                FROM attendance_records AS record
                JOIN attendance_events AS event ON event.id = record.attendance_event_id
                JOIN student_enrollments AS enrollment ON enrollment.id = record.student_enrollment_id
                JOIN students AS student ON student.id = enrollment.student_id
                JOIN classes AS school_class ON school_class.id = enrollment.class_id
                JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
                WHERE school_class.school_year_id = :school_year_id
                  AND record.justification_status = 'PENDING'
                  AND record.deleted_at IS NULL
                ORDER BY record.updated_at DESC
                LIMIT :limit
            )
            UNION ALL
            (
                SELECT
                    'correction_request' AS kind,
                    request.created_at AS happened_at,
                    concat_ws(' ', teacher.first_name, teacher.last_name) AS actor_name,
                    concat_ws(' ', class_level.name, school_class.group_label) AS context_class,
                    assessment.assessment_date AS context_date,
                    subject.name AS context_subject
                FROM grade_change_requests AS request
                JOIN accounts AS account ON account.id = request.requested_by_account_id
                JOIN teachers AS teacher ON teacher.account_id = account.id
                JOIN grades AS grade ON grade.id = request.grade_id
                JOIN assessments AS assessment ON assessment.id = grade.assessment_id
                JOIN teacher_assignments AS assignment ON assignment.id = assessment.teacher_assignment_id
                JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
                JOIN classes AS school_class ON school_class.id = class_subject.class_id
                JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
                JOIN subjects AS subject ON subject.id = class_subject.subject_id
                WHERE school_class.school_year_id = :school_year_id
                ORDER BY request.created_at DESC
                LIMIT :limit
            )
            UNION ALL
            (
                SELECT
                    'report_card_validated' AS kind,
                    report_card.validated_at AS happened_at,
                    concat_ws(' ', validator.first_name, validator.last_name) AS actor_name,
                    concat_ws(' ', class_level.name, school_class.group_label) AS context_class,
                    NULL::date AS context_date,
                    reporting_period.name AS context_subject
                FROM report_cards AS report_card
                JOIN accounts AS account ON account.id = report_card.validated_by_account_id
                LEFT JOIN teachers AS teacher_validator ON teacher_validator.account_id = account.id
                LEFT JOIN administrators AS admin_validator ON admin_validator.account_id = account.id
                CROSS JOIN LATERAL (
                    SELECT COALESCE(teacher_validator.first_name, admin_validator.first_name) AS first_name,
                           COALESCE(teacher_validator.last_name, admin_validator.last_name) AS last_name
                ) AS validator
                JOIN student_enrollments AS enrollment ON enrollment.id = report_card.student_enrollment_id
                JOIN classes AS school_class ON school_class.id = enrollment.class_id
                JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
                JOIN reporting_periods AS reporting_period ON reporting_period.id = report_card.reporting_period_id
                WHERE school_class.school_year_id = :school_year_id
                  AND report_card.validated_at IS NOT NULL
                ORDER BY report_card.validated_at DESC
                LIMIT :limit
            )
            ORDER BY happened_at DESC
            LIMIT :limit
            """
        ),
        {"school_year_id": school_year_id, "limit": limit},
    ).mappings().all()
    return [dict(row) for row in rows]


def get_admin_dashboard(db: Session) -> dict:
    """Rassemble toutes les données du tableau de bord administrateur."""

    school_year_id = _get_current_school_year_id(db)
    if school_year_id is None:
        return {
            "stats": {
                "absences_pending": 0,
                "evaluations_incomplete": 0,
                "correction_requests_pending": 0,
                "report_cards_pending": 0,
            },
            "cycle_performance": [],
            "attendance_watchlist": [],
            "grade_entry_progress": {"entered": 0, "total": 0, "percent": 0},
            "recent_activity": [],
        }

    return {
        "stats": {
            "absences_pending": _count_absences_pending_justification(db, school_year_id),
            "evaluations_incomplete": _count_evaluations_incomplete(db, school_year_id),
            "correction_requests_pending": _count_correction_requests_pending(db, school_year_id),
            "report_cards_pending": _count_report_cards_pending(db, school_year_id),
        },
        "cycle_performance": _get_cycle_performance(db, school_year_id),
        "attendance_watchlist": _get_attendance_watchlist(db, school_year_id),
        "grade_entry_progress": _get_evaluation_progress(db, school_year_id),
        "recent_activity": _get_recent_activity(db, school_year_id),
    }
