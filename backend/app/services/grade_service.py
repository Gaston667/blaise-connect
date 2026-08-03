"""Règles métier de consultation et de saisie des notes."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.schemas.grade_create import GradeCreate


def _append_actor_scope(sql: str, actor: Account) -> tuple[str, dict]:
    """Limite une requête aux affectations du professeur connecté."""

    if actor.role == "TEACHER":
        return sql + " AND teacher.account_id = :actor_account_id", {
            "actor_account_id": actor.id,
        }
    return sql, {}


def list_grades(
    db: Session,
    actor: Account,
    q: str | None = None,
    class_id: UUID | None = None,
    subject_id: UUID | None = None,
    reporting_period_id: UUID | None = None,
    grade_id: UUID | None = None,
) -> list[dict]:
    """Retourne les notes autorisées avec leur contexte scolaire complet."""

    sql = """
        SELECT
            grade.id,
            assessment.id AS assessment_id,
            assessment.title AS assessment_title,
            grade.student_enrollment_id,
            student.id AS student_id,
            account.registration_number,
            concat_ws(' ', student.first_name, student.last_name) AS student_name,
            school_class.id AS class_id,
            concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
            subject.id AS subject_id,
            subject.name AS subject_name,
            period.id AS reporting_period_id,
            period.name AS reporting_period_name,
            grade.result_type,
            grade.score,
            assessment.maximum_score,
            assessment.coefficient,
            assessment.assessment_date,
            grade.comment,
            grade.justification_status,
            grade.created_at
        FROM grades AS grade
        JOIN assessments AS assessment
          ON assessment.id = grade.assessment_id
        JOIN teacher_assignments AS assignment
          ON assignment.id = assessment.teacher_assignment_id
        JOIN teachers AS teacher
          ON teacher.id = assignment.teacher_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN subjects AS subject
          ON subject.id = class_subject.subject_id
        JOIN classes AS school_class
          ON school_class.id = class_subject.class_id
        JOIN class_levels AS class_level
          ON class_level.id = school_class.class_level_id
        JOIN student_enrollments AS enrollment
          ON enrollment.id = grade.student_enrollment_id
        JOIN students AS student
          ON student.id = enrollment.student_id
        JOIN accounts AS account
          ON account.id = student.account_id
        LEFT JOIN reporting_periods AS period
          ON period.school_year_id = school_class.school_year_id
         AND assessment.assessment_date BETWEEN period.start_date AND period.end_date
        WHERE 1 = 1
    """
    params: dict = {}
    sql, actor_params = _append_actor_scope(sql, actor)
    params.update(actor_params)

    if q:
        sql += """
            AND (
                student.first_name ILIKE :query
                OR student.last_name ILIKE :query
                OR account.registration_number ILIKE :query
            )
        """
        params["query"] = f"%{q.strip()}%"
    if class_id is not None:
        sql += " AND school_class.id = :class_id"
        params["class_id"] = class_id
    if subject_id is not None:
        sql += " AND subject.id = :subject_id"
        params["subject_id"] = subject_id
    if reporting_period_id is not None:
        sql += " AND period.id = :reporting_period_id"
        params["reporting_period_id"] = reporting_period_id
    if grade_id is not None:
        sql += " AND grade.id = :grade_id"
        params["grade_id"] = grade_id

    sql += " ORDER BY assessment.assessment_date DESC, student.last_name, student.first_name"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def _list_grade_classes(db: Session, actor: Account) -> list[dict]:
    """Liste les classes possédant au moins une évaluation accessible."""

    sql = """
        SELECT DISTINCT
            school_class.id,
            concat_ws(' ', class_level.name, school_class.group_label) AS name,
            school_year.id AS school_year_id,
            school_year.name AS school_year_name,
            school_year.start_date,
            class_level.display_order,
            school_class.group_label
        FROM assessments AS assessment
        JOIN teacher_assignments AS assignment
          ON assignment.id = assessment.teacher_assignment_id
        JOIN teachers AS teacher
          ON teacher.id = assignment.teacher_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN classes AS school_class
          ON school_class.id = class_subject.class_id
        JOIN class_levels AS class_level
          ON class_level.id = school_class.class_level_id
        JOIN school_years AS school_year
          ON school_year.id = school_class.school_year_id
        WHERE 1 = 1
    """
    sql, params = _append_actor_scope(sql, actor)
    sql += " ORDER BY school_year.start_date DESC, class_level.display_order, school_class.group_label"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def _list_grade_subjects(
    db: Session,
    actor: Account,
    class_id: UUID | None,
) -> list[dict]:
    """Liste les matières évaluées, éventuellement dans une classe donnée."""

    sql = """
        SELECT DISTINCT subject.id, subject.name
        FROM assessments AS assessment
        JOIN teacher_assignments AS assignment
          ON assignment.id = assessment.teacher_assignment_id
        JOIN teachers AS teacher
          ON teacher.id = assignment.teacher_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN subjects AS subject
          ON subject.id = class_subject.subject_id
        WHERE 1 = 1
    """
    sql, params = _append_actor_scope(sql, actor)
    if class_id is not None:
        sql += " AND class_subject.class_id = :class_id"
        params["class_id"] = class_id
    sql += " ORDER BY subject.name"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def _list_grade_periods(
    db: Session,
    actor: Account,
    class_id: UUID | None,
) -> list[dict]:
    """Liste les périodes des années contenant des évaluations accessibles."""

    sql = """
        SELECT DISTINCT
            period.id,
            period.school_year_id,
            period.name,
            period.start_date,
            period.end_date
        FROM reporting_periods AS period
        JOIN classes AS school_class
          ON school_class.school_year_id = period.school_year_id
        JOIN class_subjects AS class_subject
          ON class_subject.class_id = school_class.id
        JOIN teacher_assignments AS assignment
          ON assignment.class_subject_id = class_subject.id
        JOIN teachers AS teacher
          ON teacher.id = assignment.teacher_id
        JOIN assessments AS assessment
          ON assessment.teacher_assignment_id = assignment.id
        WHERE 1 = 1
    """
    sql, params = _append_actor_scope(sql, actor)
    if class_id is not None:
        sql += " AND school_class.id = :class_id"
        params["class_id"] = class_id
    sql += " ORDER BY period.start_date"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def _list_grade_assessments(
    db: Session,
    actor: Account,
    class_id: UUID | None,
    subject_id: UUID | None,
) -> list[dict]:
    """Liste les évaluations compatibles avec la sélection courante."""

    sql = """
        SELECT
            assessment.id,
            assessment.title,
            assessment.assessment_date,
            assessment.maximum_score,
            assessment.coefficient,
            class_subject.class_id,
            class_subject.subject_id,
            concat_ws(' ', teacher.first_name, teacher.last_name) AS teacher_name
        FROM assessments AS assessment
        JOIN teacher_assignments AS assignment
          ON assignment.id = assessment.teacher_assignment_id
        JOIN teachers AS teacher
          ON teacher.id = assignment.teacher_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN classes AS school_class
          ON school_class.id = class_subject.class_id
        JOIN school_years AS school_year
          ON school_year.id = school_class.school_year_id
        WHERE school_year.closed_at IS NULL
    """
    sql, params = _append_actor_scope(sql, actor)
    if class_id is not None:
        sql += " AND class_subject.class_id = :class_id"
        params["class_id"] = class_id
    if subject_id is not None:
        sql += " AND class_subject.subject_id = :subject_id"
        params["subject_id"] = subject_id
    sql += " ORDER BY assessment.assessment_date DESC, assessment.title"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def _list_grade_students(
    db: Session,
    actor: Account,
    assessment_id: UUID | None,
) -> list[dict]:
    """Liste les élèves évaluables qui n'ont pas encore de résultat."""

    if assessment_id is None:
        return []

    sql = """
        SELECT
            enrollment.id AS enrollment_id,
            student.id AS student_id,
            account.registration_number,
            concat_ws(' ', student.first_name, student.last_name) AS name
        FROM assessments AS assessment
        JOIN teacher_assignments AS assignment
          ON assignment.id = assessment.teacher_assignment_id
        JOIN teachers AS teacher
          ON teacher.id = assignment.teacher_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN student_enrollments AS enrollment
          ON enrollment.class_id = class_subject.class_id
         AND assessment.assessment_date >= enrollment.start_date
         AND assessment.assessment_date <= COALESCE(enrollment.end_date, assessment.assessment_date)
        JOIN students AS student
          ON student.id = enrollment.student_id
        JOIN accounts AS account
          ON account.id = student.account_id
        LEFT JOIN grades AS existing_grade
          ON existing_grade.assessment_id = assessment.id
         AND existing_grade.student_enrollment_id = enrollment.id
        WHERE assessment.id = :assessment_id
          AND existing_grade.id IS NULL
    """
    sql, actor_params = _append_actor_scope(sql, actor)
    params = {"assessment_id": assessment_id, **actor_params}
    sql += " ORDER BY student.last_name, student.first_name"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def get_grade_options(
    db: Session,
    actor: Account,
    class_id: UUID | None = None,
    subject_id: UUID | None = None,
    assessment_id: UUID | None = None,
) -> dict:
    """Regroupe les options autorisées pour les filtres et la saisie."""

    return {
        "classes": _list_grade_classes(db, actor),
        "subjects": _list_grade_subjects(db, actor, class_id),
        "periods": _list_grade_periods(db, actor, class_id),
        "assessments": _list_grade_assessments(db, actor, class_id, subject_id),
        "students": _list_grade_students(db, actor, assessment_id),
    }


def create_grade(
    db: Session,
    actor: Account,
    grade_data: GradeCreate,
) -> dict:
    """Crée une note après contrôle de l'évaluation et de son propriétaire."""

    context = db.execute(
        text(
            """
            SELECT teacher.account_id AS teacher_account_id
            FROM assessments AS assessment
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN teachers AS teacher
              ON teacher.id = assignment.teacher_id
            WHERE assessment.id = :assessment_id
            """
        ),
        {"assessment_id": grade_data.assessment_id},
    ).first()
    if context is None:
        raise LookupError("L'évaluation sélectionnée est introuvable.")
    if actor.role == "TEACHER" and context.teacher_account_id != actor.id:
        raise PermissionError("Vous ne pouvez saisir que les notes de vos évaluations.")

    justification_status = grade_data.justification_status
    if grade_data.result_type == "ABSENT" and justification_status is None:
        justification_status = "UNJUSTIFIED"

    grade_id = db.execute(
        text(
            """
            INSERT INTO grades (
                assessment_id,
                student_enrollment_id,
                result_type,
                score,
                comment,
                justification_status
            )
            VALUES (
                :assessment_id,
                :student_enrollment_id,
                :result_type,
                :score,
                :comment,
                :justification_status
            )
            RETURNING id
            """
        ),
        {
            "assessment_id": grade_data.assessment_id,
            "student_enrollment_id": grade_data.student_enrollment_id,
            "result_type": grade_data.result_type,
            "score": grade_data.score,
            "comment": grade_data.comment.strip() if grade_data.comment else None,
            "justification_status": justification_status,
        },
    ).scalar_one()
    db.commit()

    created_grades = list_grades(db=db, actor=actor, grade_id=grade_id)
    if not created_grades:
        raise RuntimeError("La note créée ne peut pas être relue.")
    return created_grades[0]
