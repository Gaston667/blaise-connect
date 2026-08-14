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

    rows = db.execute(
        text(
            """
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
            WHERE (:school_year_id IS NULL OR school_year.id = :school_year_id)
              AND (:school_class_id IS NULL OR school_class.id = :school_class_id)
              AND (:reporting_period_id IS NULL OR reporting_period.id = :reporting_period_id)
            ORDER BY student.last_name, student.first_name, report_card.version DESC
            """
        ),
        {
            "school_year_id": school_year_id,
            "school_class_id": school_class_id,
            "reporting_period_id": reporting_period_id,
        },
    ).mappings().all()
    return [dict(row) for row in rows]
