"""Consultation des bulletins déjà générés."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def list_report_cards(
    db: Session,
    school_year_id: UUID | None = None,
    school_class_id: UUID | None = None,
    reporting_period_id: UUID | None = None,
) -> list[dict]:
    """Retourne les bulletins existants avec leur contexte scolaire."""

    conditions = []
    parameters: dict[str, UUID] = {}

    if school_year_id is not None:
        conditions.append("school_year.id = :school_year_id")
        parameters["school_year_id"] = school_year_id
    else:
        conditions.append(
            "school_year.is_current = TRUE AND school_year.closed_at IS NULL"
        )
    if school_class_id is not None:
        conditions.append("school_class.id = :school_class_id")
        parameters["school_class_id"] = school_class_id
    if reporting_period_id is not None:
        conditions.append("reporting_period.id = :reporting_period_id")
        parameters["reporting_period_id"] = reporting_period_id

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    rows = db.execute(
        text(
            f"""
            SELECT
                report_card.id,
                report_card.version,
                report_card.general_average,
                report_card.generated_at,
                report_card.validated_at,
                student.id AS student_id,
                concat_ws(' ', student.first_name, student.last_name) AS student_name,
                account.registration_number,
                school_class.id AS class_id,
                concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                school_year.id AS school_year_id,
                school_year.name AS school_year_name,
                reporting_period.id AS reporting_period_id,
                reporting_period.name AS reporting_period_name,
                CASE
                    WHEN report_card.validated_at IS NOT NULL THEN 'VALIDATED'
                    ELSE 'DRAFT'
                END AS status
            FROM report_cards AS report_card
            JOIN student_enrollments AS enrollment
              ON enrollment.id = report_card.student_enrollment_id
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN accounts AS account ON account.id = student.account_id
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            JOIN reporting_periods AS reporting_period
              ON reporting_period.id = report_card.reporting_period_id
            WHERE {where_clause}
            ORDER BY student.last_name, student.first_name, report_card.version DESC
            """
        ),
        parameters,
    ).mappings().all()
    return [dict(row) for row in rows]


def get_report_card_detail(db: Session, report_card_id: UUID) -> dict:
    """Retourne le contenu figé d'un bulletin et ses indicateurs utiles."""

    report_card = db.execute(
        text(
            """
            SELECT
                report_card.id,
                report_card.version,
                report_card.general_average,
                report_card.overall_comment,
                report_card.generated_at,
                report_card.validated_at,
                report_card.pdf_document_id,
                student.id AS student_id,
                concat_ws(' ', student.first_name, student.last_name) AS student_name,
                account.registration_number,
                student.photo_path,
                student.birth_date,
                concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                school_year.name AS school_year_name,
                reporting_period.name AS reporting_period_name,
                reporting_period.start_date AS period_start_date,
                reporting_period.end_date AS period_end_date,
                CASE
                    WHEN report_card.validated_at IS NOT NULL THEN 'VALIDATED'
                    ELSE 'DRAFT'
                END AS status
            FROM report_cards AS report_card
            JOIN student_enrollments AS enrollment
              ON enrollment.id = report_card.student_enrollment_id
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN accounts AS account ON account.id = student.account_id
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            JOIN reporting_periods AS reporting_period
              ON reporting_period.id = report_card.reporting_period_id
            WHERE report_card.id = :report_card_id
            """
        ),
        {"report_card_id": report_card_id},
    ).mappings().one_or_none()

    if report_card is None:
        raise LookupError("Bulletin introuvable.")

    subjects = db.execute(
        text(
            """
            WITH latest_context_cards AS (
                SELECT DISTINCT ON (context_card.student_enrollment_id)
                    context_card.id
                FROM report_cards AS context_card
                JOIN student_enrollments AS context_enrollment
                  ON context_enrollment.id = context_card.student_enrollment_id
                JOIN report_cards AS selected_card
                  ON selected_card.id = :report_card_id
                JOIN student_enrollments AS selected_enrollment
                  ON selected_enrollment.id = selected_card.student_enrollment_id
                WHERE context_card.reporting_period_id = selected_card.reporting_period_id
                  AND context_enrollment.class_id = selected_enrollment.class_id
                ORDER BY context_card.student_enrollment_id,
                    context_card.version DESC
            )
            SELECT
                subject.name AS subject_name,
                report_card_subject.subject_average,
                report_card_subject.applied_coefficient,
                report_card_subject.teacher_comment,
                class_average.subject_average AS class_average,
                class_average.highest_average,
                class_average.lowest_average
            FROM report_card_subjects AS report_card_subject
            JOIN class_subjects AS class_subject
              ON class_subject.id = report_card_subject.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            LEFT JOIN LATERAL (
                SELECT
                    avg(other_subject.subject_average) AS subject_average,
                    max(other_subject.subject_average) AS highest_average,
                    min(other_subject.subject_average) AS lowest_average
                FROM report_card_subjects AS other_subject
                JOIN latest_context_cards AS latest_card
                  ON latest_card.id = other_subject.report_card_id
                WHERE other_subject.class_subject_id = report_card_subject.class_subject_id
            ) AS class_average ON TRUE
            WHERE report_card_subject.report_card_id = :report_card_id
            ORDER BY subject.name
            """
        ),
        {"report_card_id": report_card_id},
    ).mappings().all()

    attendance = db.execute(
        text(
            """
            SELECT
                count(*) FILTER (
                    WHERE attendance_record.incident_type = 'ABSENT'
                      AND attendance_record.justification_status = 'JUSTIFIED'
                ) AS justified_absence_count,
                count(*) FILTER (
                    WHERE attendance_record.incident_type = 'ABSENT'
                      AND attendance_record.justification_status IN (
                          'UNJUSTIFIED',
                          'REJECTED'
                      )
                ) AS unjustified_absence_count,
                count(*) FILTER (
                    WHERE attendance_record.incident_type = 'ABSENT'
                      AND attendance_record.justification_status = 'PENDING'
                ) AS pending_absence_count,
                coalesce(
                    sum(attendance_record.late_minutes) FILTER (
                        WHERE attendance_record.incident_type = 'LATE'
                    ),
                    0
                ) AS late_minutes
            FROM attendance_records AS attendance_record
            JOIN attendance_events AS attendance_event
              ON attendance_event.id = attendance_record.attendance_event_id
            JOIN student_enrollments AS enrollment
              ON enrollment.id = attendance_record.student_enrollment_id
            JOIN report_cards AS report_card
              ON report_card.student_enrollment_id = enrollment.id
            JOIN reporting_periods AS reporting_period
              ON reporting_period.id = report_card.reporting_period_id
            WHERE report_card.id = :report_card_id
              AND attendance_record.deleted_at IS NULL
              AND attendance_event.attendance_date
                  BETWEEN reporting_period.start_date AND reporting_period.end_date
            """
        ),
        {"report_card_id": report_card_id},
    ).mappings().one()

    class_statistics = db.execute(
        text(
            """
            WITH selected_context AS (
                SELECT
                    report_card.id,
                    report_card.reporting_period_id,
                    enrollment.class_id,
                    reporting_period.start_date,
                    reporting_period.end_date
                FROM report_cards AS report_card
                JOIN student_enrollments AS enrollment
                  ON enrollment.id = report_card.student_enrollment_id
                JOIN reporting_periods AS reporting_period
                  ON reporting_period.id = report_card.reporting_period_id
                WHERE report_card.id = :report_card_id
            ), latest_context_cards AS (
                SELECT DISTINCT ON (context_card.student_enrollment_id)
                    context_card.id,
                    context_card.general_average
                FROM report_cards AS context_card
                JOIN student_enrollments AS context_enrollment
                  ON context_enrollment.id = context_card.student_enrollment_id
                JOIN selected_context AS selected_context ON TRUE
                WHERE context_card.reporting_period_id = selected_context.reporting_period_id
                  AND context_enrollment.class_id = selected_context.class_id
                ORDER BY context_card.student_enrollment_id,
                    context_card.version DESC
            ), ranked_cards AS (
                SELECT
                    latest_context_card.id,
                    rank() OVER (
                        ORDER BY latest_context_card.general_average DESC
                    ) AS class_rank,
                    avg(latest_context_card.general_average) OVER ()
                        AS class_general_average
                FROM latest_context_cards AS latest_context_card
            )
            SELECT
                ranked_card.class_rank,
                ranked_card.class_general_average,
                (
                    SELECT count(*)
                    FROM student_enrollments AS class_enrollment
                    JOIN selected_context AS selected_context ON TRUE
                    WHERE class_enrollment.class_id = selected_context.class_id
                      AND class_enrollment.start_date <= selected_context.end_date
                      AND (
                          class_enrollment.end_date IS NULL
                          OR class_enrollment.end_date >= selected_context.start_date
                      )
                ) AS class_student_count
            FROM ranked_cards AS ranked_card
            WHERE ranked_card.id = :report_card_id
            """
        ),
        {"report_card_id": report_card_id},
    ).mappings().one_or_none()

    result = dict(report_card)
    result["subjects"] = [dict(subject) for subject in subjects]
    result["justified_absence_count"] = attendance["justified_absence_count"]
    result["unjustified_absence_count"] = attendance["unjustified_absence_count"]
    result["pending_absence_count"] = attendance["pending_absence_count"]
    result["late_minutes"] = attendance["late_minutes"]
    result["class_rank"] = (
        class_statistics["class_rank"] if class_statistics else None
    )
    result["class_student_count"] = (
        class_statistics["class_student_count"] if class_statistics else None
    )
    result["class_general_average"] = (
        class_statistics["class_general_average"] if class_statistics else None
    )
    return result
