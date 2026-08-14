"""Règles métier de consultation des notes par l'élève lui-même."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def get_my_class_name(db: Session, student_id: UUID) -> str | None:
    """Retourne le nom de la classe actuelle de l'élève, s'il en a une."""

    sql = """
        SELECT concat_ws(' ', class_level.name, school_class.group_label) AS class_name
        FROM student_enrollments AS enrollment
        JOIN classes AS school_class ON school_class.id = enrollment.class_id
        JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
        WHERE enrollment.student_id = :student_id AND enrollment.end_date IS NULL
        LIMIT 1
    """
    return db.execute(text(sql), {"student_id": student_id}).scalar_one_or_none()


def get_my_school_year_name(db: Session, student_id: UUID) -> str | None:
    """Retourne le nom de l'année scolaire de la classe actuelle de l'élève."""

    sql = """
        SELECT school_year.name
        FROM student_enrollments AS enrollment
        JOIN classes AS school_class ON school_class.id = enrollment.class_id
        JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
        WHERE enrollment.student_id = :student_id AND enrollment.end_date IS NULL
        LIMIT 1
    """
    return db.execute(text(sql), {"student_id": student_id}).scalar_one_or_none()

# Une absence non justifiée ou rejetée compte pour 0/20 dans les moyennes ;
# une absence justifiée ou en attente est exclue du calcul.
_EFFECTIVE_SCORE_SQL = """
    CASE
        WHEN grade.result_type = 'SCORED' THEN (grade.score / assessment.maximum_score) * 20
        WHEN grade.result_type = 'ABSENT' AND grade.justification_status IN ('UNJUSTIFIED', 'REJECTED') THEN 0
        ELSE NULL
    END
"""

_GRADE_BASE_JOIN = """
    FROM grades AS grade
    JOIN assessments AS assessment
      ON assessment.id = grade.assessment_id
    JOIN teacher_assignments AS assignment
      ON assignment.id = assessment.teacher_assignment_id
    JOIN class_subjects AS class_subject
      ON class_subject.id = assignment.class_subject_id
    JOIN subjects AS subject
      ON subject.id = class_subject.subject_id
    LEFT JOIN reporting_periods AS period
      ON period.school_year_id = (
          SELECT school_year_id FROM classes WHERE id = class_subject.class_id
      )
     AND assessment.assessment_date BETWEEN period.start_date AND period.end_date
    JOIN student_enrollments AS enrollment
      ON enrollment.id = grade.student_enrollment_id
    JOIN students AS student
      ON student.id = enrollment.student_id
"""


def list_my_grades(db: Session, student_id: UUID) -> list[dict]:
    """Retourne les notes de l'élève connecté, les plus récentes en premier."""

    sql = f"""
        SELECT
            grade.id,
            assessment.id AS assessment_id,
            assessment.title AS assessment_title,
            subject.id AS subject_id,
            subject.name AS subject_name,
            period.name AS reporting_period_name,
            grade.result_type,
            grade.score,
            assessment.maximum_score,
            assessment.coefficient,
            assessment.assessment_date,
            grade.comment,
            grade.justification_status,
            grade.created_at
        {_GRADE_BASE_JOIN}
        WHERE student.id = :student_id
        ORDER BY assessment.assessment_date DESC, grade.created_at DESC
    """
    rows = db.execute(text(sql), {"student_id": student_id}).mappings().all()
    return [dict(row) for row in rows]


def _get_class_appreciation(average: float | None) -> str | None:
    """Traduit une moyenne de classe sur 20 en appréciation informative."""

    if average is None:
        return None
    if average >= 16:
        return "Très bien"
    if average >= 14:
        return "Bien"
    if average >= 12:
        return "Assez bien"
    if average >= 10:
        return "Passable"
    return "À renforcer"


def get_my_assessment_detail(
    db: Session,
    student_id: UUID,
    assessment_id: UUID,
) -> dict:
    """Retourne une évaluation de l'élève et ses statistiques de classe anonymisées.

    La requête part toujours de l'inscription de l'élève connecté : il ne peut
    donc jamais lire une évaluation ou une note qui ne lui appartient pas.
    """

    sql = """
        WITH target AS (
            SELECT
                assessment.id AS assessment_id,
                assessment.title,
                assessment.description,
                assessment.assessment_date,
                assessment.maximum_score,
                assessment.coefficient,
                subject.name AS subject_name,
                concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                concat_ws(' ', teacher.first_name, teacher.last_name) AS teacher_name,
                grade.result_type,
                grade.score,
                grade.comment,
                grade.justification_status,
                enrollment.class_id
            FROM grades AS grade
            JOIN assessments AS assessment ON assessment.id = grade.assessment_id
            JOIN teacher_assignments AS assignment ON assignment.id = assessment.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            LEFT JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN student_enrollments AS enrollment ON enrollment.id = grade.student_enrollment_id
            WHERE enrollment.student_id = :student_id
              AND assessment.id = :assessment_id
        ),
        class_results AS (
            SELECT
                enrollment.student_id,
                CASE
                    WHEN grade.result_type = 'SCORED'
                        THEN (grade.score / assessment.maximum_score) * 20
                    WHEN grade.result_type = 'ABSENT'
                        AND grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                        THEN 0
                    ELSE NULL
                END AS effective_score
            FROM grades AS grade
            JOIN student_enrollments AS enrollment ON enrollment.id = grade.student_enrollment_id
            JOIN assessments AS assessment ON assessment.id = grade.assessment_id
            JOIN target ON target.assessment_id = assessment.id
            WHERE enrollment.class_id = target.class_id
              AND enrollment.start_date <= assessment.assessment_date
              AND (enrollment.end_date IS NULL OR enrollment.end_date >= assessment.assessment_date)
        ),
        ranked_results AS (
            SELECT
                student_id,
                effective_score,
                RANK() OVER (ORDER BY effective_score DESC) AS rank,
                COUNT(*) OVER () AS ranked_students_count
            FROM class_results
            WHERE effective_score IS NOT NULL
        ),
        statistics AS (
            SELECT
                MAX(effective_score) AS highest_score,
                MIN(effective_score) AS lowest_score,
                AVG(effective_score) AS class_average
            FROM class_results
            WHERE effective_score IS NOT NULL
        )
        SELECT
            target.*,
            statistics.highest_score,
            statistics.lowest_score,
            statistics.class_average,
            ranked_results.rank,
            COALESCE(ranked_results.ranked_students_count, 0) AS ranked_students_count
        FROM target
        CROSS JOIN statistics
        LEFT JOIN ranked_results ON ranked_results.student_id = :student_id
    """
    row = db.execute(
        text(sql),
        {"student_id": student_id, "assessment_id": assessment_id},
    ).mappings().one_or_none()

    if row is None:
        raise LookupError("Cette évaluation n'est pas disponible pour votre compte.")

    detail = dict(row)
    class_average = detail["class_average"]
    detail["class_appreciation"] = _get_class_appreciation(
        float(class_average) if class_average is not None else None
    )
    return detail


def get_my_grade_summary(db: Session, student_id: UUID) -> dict:
    """Calcule la moyenne générale, les moyennes par matière et les évaluations à venir."""

    subject_sql = f"""
        SELECT
            subject.id AS subject_id,
            subject.name AS subject_name,
            class_subject.coefficient AS subject_coefficient,
            SUM({_EFFECTIVE_SCORE_SQL} * assessment.coefficient)
                / NULLIF(SUM(CASE WHEN {_EFFECTIVE_SCORE_SQL} IS NOT NULL THEN assessment.coefficient END), 0)
                AS average
        {_GRADE_BASE_JOIN}
        WHERE student.id = :student_id
        GROUP BY subject.id, subject.name, class_subject.coefficient
        ORDER BY subject.name
    """
    subject_rows = db.execute(text(subject_sql), {"student_id": student_id}).mappings().all()

    period_sql = f"""
        SELECT
            period.id AS period_id,
            period.name AS period_name,
            period.start_date,
            SUM({_EFFECTIVE_SCORE_SQL} * assessment.coefficient)
                / NULLIF(SUM(CASE WHEN {_EFFECTIVE_SCORE_SQL} IS NOT NULL THEN assessment.coefficient END), 0)
                AS average
        {_GRADE_BASE_JOIN}
        WHERE student.id = :student_id AND period.id IS NOT NULL
        GROUP BY period.id, period.name, period.start_date
        ORDER BY period.start_date
    """
    period_rows = db.execute(text(period_sql), {"student_id": student_id}).mappings().all()

    overall_sql = f"""
        SELECT
            SUM({_EFFECTIVE_SCORE_SQL} * assessment.coefficient)
                / NULLIF(SUM(CASE WHEN {_EFFECTIVE_SCORE_SQL} IS NOT NULL THEN assessment.coefficient END), 0)
                AS average
        {_GRADE_BASE_JOIN}
        WHERE student.id = :student_id
    """
    overall_average = db.execute(text(overall_sql), {"student_id": student_id}).scalar_one_or_none()

    upcoming_sql = """
        SELECT
            assessment.id,
            assessment.title,
            subject.name AS subject_name,
            assessment.assessment_date
        FROM assessments AS assessment
        JOIN teacher_assignments AS assignment
          ON assignment.id = assessment.teacher_assignment_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN subjects AS subject
          ON subject.id = class_subject.subject_id
        WHERE class_subject.class_id = (
            SELECT class_id FROM student_enrollments
            WHERE student_id = :student_id AND end_date IS NULL
            LIMIT 1
        )
        AND assessment.assessment_date >= CURRENT_DATE
        ORDER BY assessment.assessment_date ASC
        LIMIT 5
    """
    upcoming_rows = db.execute(text(upcoming_sql), {"student_id": student_id}).mappings().all()

    rank, class_size = _get_my_rank(db, student_id)

    return {
        "overall_average": float(overall_average) if overall_average is not None else None,
        "rank": rank,
        "class_size": class_size,
        "subject_averages": [
            {
                "subject_id": row.subject_id,
                "subject_name": row.subject_name,
                "coefficient": float(row.subject_coefficient),
                "average": float(row.average) if row.average is not None else None,
            }
            for row in subject_rows
        ],
        "period_averages": [
            {
                "period_id": row.period_id,
                "period_name": row.period_name,
                "average": float(row.average) if row.average is not None else None,
            }
            for row in period_rows
        ],
        "upcoming_assessments": [dict(row) for row in upcoming_rows],
    }


def _get_my_rank(db: Session, student_id: UUID) -> tuple[int | None, int | None]:
    """Classe l'élève parmi les autres élèves actuellement inscrits dans sa classe.

    Ne compare que les élèves ayant au moins une note (limite connue du MVP :
    un élève sans aucune note n'entre ni dans le classement ni dans l'effectif).
    """

    sql = f"""
        WITH classmate AS (
            SELECT student_id FROM student_enrollments
            WHERE end_date IS NULL
              AND class_id = (
                  SELECT class_id FROM student_enrollments
                  WHERE student_id = :student_id AND end_date IS NULL
                  LIMIT 1
              )
        ),
        classmate_average AS (
            SELECT
                student.id AS student_id,
                SUM({_EFFECTIVE_SCORE_SQL} * assessment.coefficient)
                    / NULLIF(SUM(CASE WHEN {_EFFECTIVE_SCORE_SQL} IS NOT NULL THEN assessment.coefficient END), 0)
                    AS average
            {_GRADE_BASE_JOIN}
            WHERE student.id IN (SELECT student_id FROM classmate)
            GROUP BY student.id
            HAVING SUM(CASE WHEN {_EFFECTIVE_SCORE_SQL} IS NOT NULL THEN assessment.coefficient END) > 0
        ),
        ranked AS (
            SELECT
                student_id,
                RANK() OVER (ORDER BY average DESC) AS rank,
                COUNT(*) OVER () AS class_size
            FROM classmate_average
        )
        SELECT rank, class_size FROM ranked WHERE student_id = :student_id
    """
    row = db.execute(text(sql), {"student_id": student_id}).first()
    if row is None:
        return None, None
    return row.rank, row.class_size
