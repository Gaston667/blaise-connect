"""Calculs scolaires officiels partagés par les fiches métier."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def _list_subject_averages_for_enrollment(
    db: Session,
    enrollment_id: UUID,
) -> list[dict]:
    """Calcule les moyennes pondérées des matières d'une inscription."""

    rows = db.execute(
        text(
            """
            WITH effective_grades AS (
                SELECT
                    class_subject.id AS class_subject_id,
                    class_subject.subject_id,
                    subject.name AS subject_name,
                    class_subject.coefficient AS class_coefficient,
                    assessment.coefficient AS assessment_coefficient,
                    grade.result_type,
                    grade.justification_status,
                    CASE
                        WHEN grade.result_type = 'SCORED'
                            THEN (grade.score / assessment.maximum_score) * 20
                        WHEN grade.result_type = 'ABSENT'
                         AND grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                            THEN 0
                        ELSE NULL
                    END AS effective_score
                FROM grades AS grade
                JOIN assessments AS assessment ON assessment.id = grade.assessment_id
                JOIN teacher_assignments AS assignment
                  ON assignment.id = assessment.teacher_assignment_id
                JOIN class_subjects AS class_subject
                  ON class_subject.id = assignment.class_subject_id
                JOIN subjects AS subject ON subject.id = class_subject.subject_id
                JOIN student_enrollments AS enrollment
                  ON enrollment.id = grade.student_enrollment_id
                 AND enrollment.class_id = class_subject.class_id
                WHERE enrollment.id = :enrollment_id
            )
            SELECT
                class_subject_id,
                subject_id,
                subject_name,
                class_coefficient,
                COUNT(*)::integer AS assessment_count,
                COUNT(*) FILTER (
                    WHERE result_type = 'ABSENT'
                      AND justification_status = 'PENDING'
                )::integer AS pending_absence_count,
                SUM(effective_score * assessment_coefficient)
                / NULLIF(
                    SUM(assessment_coefficient) FILTER (
                        WHERE effective_score IS NOT NULL
                    ),
                    0
                ) AS average_on_20
            FROM effective_grades
            GROUP BY class_subject_id, subject_id, subject_name, class_coefficient
            ORDER BY subject_name
            """
        ),
        {"enrollment_id": enrollment_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def _calculate_general_average(subject_averages: list[dict]) -> Decimal | None:
    """Pondère les moyennes de matière par `class_subjects.coefficient`."""

    available = [
        item for item in subject_averages if item["average_on_20"] is not None
    ]
    if not available:
        return None
    weighted_sum = sum(
        item["average_on_20"] * item["class_coefficient"]
        for item in available
    )
    coefficient_sum = sum(item["class_coefficient"] for item in available)
    return weighted_sum / coefficient_sum


def get_student_academic_summary(
    db: Session,
    student_id: UUID,
) -> dict | None:
    """Construit la scolarité courante et historique d'un élève."""

    student_exists = db.execute(
        text("SELECT id FROM students WHERE id = :student_id"),
        {"student_id": student_id},
    ).first()
    if student_exists is None:
        return None

    enrollment_rows = db.execute(
        text(
            """
            SELECT
                enrollment.id AS enrollment_id,
                school_class.id AS class_id,
                concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                school_year.id AS school_year_id,
                school_year.name AS school_year_name,
                enrollment.start_date,
                enrollment.end_date,
                enrollment.end_reason
            FROM student_enrollments AS enrollment
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            JOIN class_levels AS class_level
              ON class_level.id = school_class.class_level_id
            JOIN school_years AS school_year
              ON school_year.id = school_class.school_year_id
            WHERE enrollment.student_id = :student_id
            ORDER BY school_year.start_date DESC, enrollment.start_date DESC
            """
        ),
        {"student_id": student_id},
    ).mappings().all()

    history: list[dict] = []
    current_enrollment_id = None
    current_subject_averages: list[dict] = []
    current_general_average = None
    for enrollment in enrollment_rows:
        averages = _list_subject_averages_for_enrollment(
            db=db,
            enrollment_id=enrollment["enrollment_id"],
        )
        general_average = _calculate_general_average(averages)
        history.append(
            {
                **dict(enrollment),
                "general_average_on_20": general_average,
            }
        )
        if current_enrollment_id is None and enrollment["end_date"] is None:
            current_enrollment_id = enrollment["enrollment_id"]
            current_subject_averages = averages
            current_general_average = general_average

    counters = {
        "absence_count": 0,
        "late_count": 0,
        "scored_assessment_count": 0,
        "pending_absence_count": 0,
    }
    if current_enrollment_id is not None:
        row = db.execute(
            text(
                """
                SELECT
                    COUNT(DISTINCT attendance_record.id) FILTER (
                        WHERE attendance_record.incident_type = 'ABSENT'
                          AND attendance_record.deleted_at IS NULL
                    )::integer AS absence_count,
                    COUNT(DISTINCT attendance_record.id) FILTER (
                        WHERE attendance_record.incident_type = 'LATE'
                          AND attendance_record.deleted_at IS NULL
                    )::integer AS late_count,
                    COUNT(DISTINCT grade.id) FILTER (
                        WHERE grade.result_type = 'SCORED'
                    )::integer AS scored_assessment_count,
                    COUNT(DISTINCT grade.id) FILTER (
                        WHERE grade.result_type = 'ABSENT'
                          AND grade.justification_status = 'PENDING'
                    )::integer AS pending_absence_count
                FROM student_enrollments AS enrollment
                LEFT JOIN attendance_records AS attendance_record
                  ON attendance_record.student_enrollment_id = enrollment.id
                LEFT JOIN grades AS grade
                  ON grade.student_enrollment_id = enrollment.id
                WHERE enrollment.id = :enrollment_id
                GROUP BY enrollment.id
                """
            ),
            {"enrollment_id": current_enrollment_id},
        ).mappings().first()
        if row is not None:
            counters = dict(row)

    return {
        "student_id": student_id,
        "current_enrollment_id": current_enrollment_id,
        **counters,
        "general_average_on_20": current_general_average,
        "subject_averages": current_subject_averages,
        "history": history,
    }
