"""Services du portail parents : lecture seule des enfants rattachés au responsable."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.report_card_service import get_report_card_detail


def list_guardian_children(db: Session, guardian_id: UUID) -> list[dict]:
    """Liste les élèves non archivés rattachés au responsable, avec leur classe."""

    rows = db.execute(
        text(
            """
            SELECT
                student.id,
                student.first_name,
                student.last_name,
                student.gender,
                student.photo_path,
                link.relationship_type,
                link.relationship_details,
                link.is_legal_guardian,
                link.is_primary_contact,
                concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                school_year.name AS school_year_name
            FROM student_guardians AS link
            JOIN students AS student ON student.id = link.student_id
            LEFT JOIN student_enrollments AS enrollment
              ON enrollment.student_id = student.id AND enrollment.end_date IS NULL
            LEFT JOIN classes AS school_class ON school_class.id = enrollment.class_id
            LEFT JOIN class_levels AS class_level
              ON class_level.id = school_class.class_level_id
            LEFT JOIN school_years AS school_year
              ON school_year.id = school_class.school_year_id
            WHERE link.guardian_id = :guardian_id
              AND student.archived_at IS NULL
            ORDER BY student.first_name, student.last_name
            """
        ),
        {"guardian_id": guardian_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def list_child_report_cards(db: Session, student_id: UUID) -> list[dict]:
    """Retourne les bulletins validés de l'élève (dernière version par période).

    Un bulletin en brouillon n'est jamais visible par les familles : il peut
    encore être modifié ou invalidé par l'établissement.
    """

    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (report_card.student_enrollment_id, report_card.reporting_period_id)
                report_card.id,
                report_card.version,
                report_card.general_average,
                report_card.validated_at,
                reporting_period.name AS reporting_period_name,
                reporting_period.start_date AS period_start_date,
                reporting_period.end_date AS period_end_date,
                school_year.name AS school_year_name,
                concat_ws(' ', class_level.name, school_class.group_label) AS class_name
            FROM report_cards AS report_card
            JOIN student_enrollments AS enrollment
              ON enrollment.id = report_card.student_enrollment_id
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            JOIN reporting_periods AS reporting_period
              ON reporting_period.id = report_card.reporting_period_id
            WHERE enrollment.student_id = :student_id
              AND report_card.validated_at IS NOT NULL
            ORDER BY report_card.student_enrollment_id,
                     report_card.reporting_period_id,
                     report_card.version DESC
            """
        ),
        {"student_id": student_id},
    ).mappings().all()
    cards = [dict(row) for row in rows]
    cards.sort(key=lambda card: card["period_start_date"], reverse=True)
    return cards


def get_child_report_card(db: Session, student_id: UUID, report_card_id: UUID) -> dict:
    """Retourne le détail d'un bulletin validé appartenant bien à cet élève."""

    owned = db.execute(
        text(
            """
            SELECT 1
            FROM report_cards AS report_card
            JOIN student_enrollments AS enrollment
              ON enrollment.id = report_card.student_enrollment_id
            WHERE report_card.id = :report_card_id
              AND enrollment.student_id = :student_id
              AND report_card.validated_at IS NOT NULL
            """
        ),
        {"report_card_id": report_card_id, "student_id": student_id},
    ).first()
    if owned is None:
        raise LookupError("Bulletin introuvable.")
    return get_report_card_detail(db=db, report_card_id=report_card_id)
