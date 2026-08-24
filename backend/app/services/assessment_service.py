"""Règles métier des évaluations et des feuilles de notes collectives."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.schemas.assessment_create import AssessmentCreate
from app.schemas.assessment_update import AssessmentUpdate
from app.schemas.grade_sheet_submit import GradeSheetSubmit


TWENTY = Decimal("20")


def normalize_score_on_20(score: Decimal, maximum_score: Decimal) -> Decimal:
    """Convertit une note vers vingt avec un arrondi scolaire à deux décimales."""

    return (score / maximum_score) * TWENTY


def get_effective_score_on_20(
    result_type: str | None,
    score: Decimal | None,
    maximum_score: Decimal,
    justification_status: str | None,
) -> Decimal | None:
    """Applique la règle officielle des absences pour les calculs.

    Une absence justifiée ou encore en attente est exclue. Une absence non
    justifiée ou rejetée vaut zéro uniquement pendant le calcul.
    """

    if result_type == "SCORED" and score is not None:
        return normalize_score_on_20(score, maximum_score)
    if result_type == "ABSENT" and justification_status in {
        "UNJUSTIFIED",
        "REJECTED",
    }:
        return Decimal("0.00")
    return None


def validate_score_against_scale(
    result_type: str,
    score: Decimal | None,
    maximum_score: Decimal,
) -> None:
    """Refuse une valeur supérieure au barème de l'évaluation."""

    if result_type == "SCORED" and score is not None and score > maximum_score:
        raise ValueError(
            f"La note doit être comprise entre 0 et {maximum_score}."
        )


def _actor_scope(actor: Account, teacher_alias: str = "teacher") -> tuple[str, dict]:
    """Produit la restriction SQL correspondant au compte connecté."""

    if actor.role == "TEACHER":
        return f" AND {teacher_alias}.account_id = :actor_account_id", {
            "actor_account_id": actor.id,
        }
    return "", {}


def _actor_view_scope(actor: Account, class_subject_alias: str = "class_subject") -> tuple[str, dict]:
    """Restriction SQL pour la CONSULTATION : un enseignant voit aussi les
    évaluations et notes saisies par son prédécesseur sur une matière de
    classe dont il est aujourd'hui le seul titulaire (remplacement en cours
    d'année). La saisie reste réservée au titulaire actuel via _actor_scope.
    """

    if actor.role == "TEACHER":
        return (
            f" AND {class_subject_alias}.id IN ("
            "SELECT current_assignment.class_subject_id "
            "FROM teacher_assignments AS current_assignment "
            "JOIN teachers AS current_teacher "
            "  ON current_teacher.id = current_assignment.teacher_id "
            "WHERE current_teacher.account_id = :actor_account_id "
            "  AND current_assignment.end_date IS NULL"
            ")",
            {"actor_account_id": actor.id},
        )
    return "", {}


def _assessment_select_sql() -> str:
    """Retourne la requête commune aux listes et fiches d'évaluation."""

    return """
        WITH eligible_enrollments AS (
            SELECT
                assessment.id AS assessment_id,
                COUNT(enrollment.id)::integer AS enrolled_count
            FROM assessments AS assessment
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            LEFT JOIN student_enrollments AS enrollment
              ON enrollment.class_id = class_subject.class_id
             AND assessment.assessment_date >= enrollment.start_date
             AND assessment.assessment_date <= COALESCE(
                    enrollment.end_date,
                    assessment.assessment_date
                 )
            GROUP BY assessment.id
        ),
        grade_statistics AS (
            SELECT
                grade.assessment_id,
                COUNT(grade.id)::integer AS grade_count,
                COUNT(grade.id) FILTER (
                    WHERE grade.result_type = 'SCORED'
                )::integer AS scored_count,
                COUNT(grade.id) FILTER (
                    WHERE grade.result_type = 'ABSENT'
                )::integer AS absent_count,
                COUNT(grade.id) FILTER (
                    WHERE grade.result_type = 'ABSENT'
                      AND grade.justification_status = 'PENDING'
                )::integer AS pending_absence_count,
                AVG(
                    CASE
                        WHEN grade.result_type = 'SCORED'
                            THEN (grade.score / assessment.maximum_score) * 20
                        WHEN grade.result_type = 'ABSENT'
                         AND grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                            THEN 0
                        ELSE NULL
                    END
                ) AS official_average_on_20
            FROM grades AS grade
            JOIN assessments AS assessment
              ON assessment.id = grade.assessment_id
            GROUP BY grade.assessment_id
        )
        SELECT
            assessment.id,
            assessment.teacher_assignment_id,
            assessment.title,
            assessment.description,
            assessment.assessment_date,
            assessment.maximum_score,
            assessment.coefficient,
            school_class.id AS class_id,
            concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
            school_year.id AS school_year_id,
            school_year.name AS school_year_name,
            subject.id AS subject_id,
            subject.name AS subject_name,
            teacher.id AS teacher_id,
            concat_ws(' ', teacher.first_name, teacher.last_name) AS teacher_name,
            period.id AS reporting_period_id,
            period.name AS reporting_period_name,
            COALESCE(eligible.enrolled_count, 0) AS enrolled_count,
            COALESCE(statistics.grade_count, 0) AS grade_count,
            COALESCE(statistics.scored_count, 0) AS scored_count,
            COALESCE(statistics.absent_count, 0) AS absent_count,
            COALESCE(statistics.pending_absence_count, 0) AS pending_absence_count,
            statistics.official_average_on_20,
            CASE
                WHEN COALESCE(statistics.pending_absence_count, 0) > 0
                    THEN 'PENDING_REVIEW'
                WHEN COALESCE(statistics.grade_count, 0) = 0
                    THEN 'EMPTY'
                WHEN COALESCE(statistics.grade_count, 0) >= COALESCE(eligible.enrolled_count, 0)
                    THEN 'COMPLETE'
                ELSE 'PARTIAL'
            END AS completion_status,
            assessment.created_at,
            assessment.updated_at
        FROM assessments AS assessment
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
        JOIN school_years AS school_year
          ON school_year.id = school_class.school_year_id
        LEFT JOIN reporting_periods AS period
          ON period.school_year_id = school_year.id
         AND assessment.assessment_date BETWEEN period.start_date AND period.end_date
        LEFT JOIN eligible_enrollments AS eligible
          ON eligible.assessment_id = assessment.id
        LEFT JOIN grade_statistics AS statistics
          ON statistics.assessment_id = assessment.id
        WHERE 1 = 1
    """


def list_assessments(
    db: Session,
    actor: Account,
    q: str | None = None,
    class_id: UUID | None = None,
    subject_id: UUID | None = None,
    reporting_period_id: UUID | None = None,
    teacher_id: UUID | None = None,
    assessment_id: UUID | None = None,
) -> list[dict]:
    """Liste les évaluations autorisées, même lorsqu'elles n'ont aucune note."""

    sql = _assessment_select_sql()
    scope_sql, params = _actor_view_scope(actor)
    sql += scope_sql

    if q:
        sql += """
            AND (
                assessment.title ILIKE :query
                OR subject.name ILIKE :query
                OR class_level.name ILIKE :query
                OR school_class.group_label ILIKE :query
                OR teacher.first_name ILIKE :query
                OR teacher.last_name ILIKE :query
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
    if teacher_id is not None:
        sql += " AND teacher.id = :teacher_id"
        params["teacher_id"] = teacher_id
    if assessment_id is not None:
        sql += " AND assessment.id = :assessment_id"
        params["assessment_id"] = assessment_id

    sql += " ORDER BY assessment.assessment_date DESC, assessment.title"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def list_assessment_assignment_options(
    db: Session,
    actor: Account,
    class_id: UUID | None = None,
) -> list[dict]:
    """Liste les affectations ouvertes utilisables pour une évaluation."""

    scope_sql, params = _actor_scope(actor)
    sql = """
        SELECT
            assignment.id,
            school_class.id AS class_id,
            concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
            subject.id AS subject_id,
            subject.name AS subject_name,
            teacher.id AS teacher_id,
            concat_ws(' ', teacher.first_name, teacher.last_name) AS teacher_name,
            school_year.id AS school_year_id,
            school_year.name AS school_year_name,
            assignment.start_date,
            assignment.end_date
        FROM teacher_assignments AS assignment
        JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN subjects AS subject ON subject.id = class_subject.subject_id
        JOIN classes AS school_class ON school_class.id = class_subject.class_id
        JOIN class_levels AS class_level
          ON class_level.id = school_class.class_level_id
        JOIN school_years AS school_year
          ON school_year.id = school_class.school_year_id
        WHERE school_year.closed_at IS NULL
          AND assignment.end_date IS NULL
          AND subject.is_active = true
    """
    sql += scope_sql
    if class_id is not None:
        sql += " AND school_class.id = :class_id"
        params["class_id"] = class_id
    sql += " ORDER BY school_year.start_date DESC, class_level.display_order, school_class.group_label, subject.name"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def get_assessment(db: Session, actor: Account, assessment_id: UUID) -> dict:
    """Retourne une évaluation visible ou signale son absence."""

    assessments = list_assessments(
        db=db,
        actor=actor,
        assessment_id=assessment_id,
    )
    if not assessments:
        raise LookupError("Évaluation introuvable ou non autorisée.")
    return assessments[0]


def _get_assignment_context(
    db: Session,
    actor: Account,
    teacher_assignment_id: UUID,
) -> object:
    """Vérifie que l'affectation est ouverte et accessible à l'acteur."""

    scope_sql, params = _actor_scope(actor)
    params["teacher_assignment_id"] = teacher_assignment_id
    row = db.execute(
        text(
            """
            SELECT
                assignment.id,
                assignment.start_date,
                assignment.end_date,
                school_year.start_date AS school_year_start_date,
                school_year.end_date AS school_year_end_date,
                school_year.closed_at
            FROM teacher_assignments AS assignment
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            WHERE assignment.id = :teacher_assignment_id
            """
            + scope_sql
            + " FOR UPDATE"
        ),
        params,
    ).first()
    if row is None:
        raise LookupError("Affectation pédagogique introuvable ou non autorisée.")
    if row.closed_at is not None:
        raise ValueError("L'année scolaire de cette affectation est clôturée.")
    return row


def create_assessment(
    db: Session,
    actor: Account,
    assessment_data: AssessmentCreate,
) -> dict:
    """Crée une évaluation dans une affectation autorisée."""

    context = _get_assignment_context(
        db=db,
        actor=actor,
        teacher_assignment_id=assessment_data.teacher_assignment_id,
    )
    effective_assignment_end = context.end_date or context.school_year_end_date
    if not context.start_date <= assessment_data.assessment_date <= effective_assignment_end:
        raise ValueError("La date doit appartenir à la période d'affectation de l'enseignant.")

    assessment_id = db.execute(
        text(
            """
            INSERT INTO assessments (
                teacher_assignment_id,
                title,
                description,
                assessment_date,
                maximum_score,
                coefficient
            )
            VALUES (
                :teacher_assignment_id,
                :title,
                :description,
                :assessment_date,
                :maximum_score,
                :coefficient
            )
            RETURNING id
            """
        ),
        assessment_data.model_dump(),
    ).scalar_one()
    db.commit()
    return get_assessment(db=db, actor=actor, assessment_id=assessment_id)


def update_assessment(
    db: Session,
    actor: Account,
    assessment_id: UUID,
    assessment_data: AssessmentUpdate,
) -> dict:
    """Modifie une évaluation sans invalider des résultats existants."""

    scope_sql, params = _actor_scope(actor)
    params["assessment_id"] = assessment_id
    current = db.execute(
        text(
            """
            SELECT
                assessment.id,
                assessment.assessment_date,
                assessment.maximum_score
            FROM assessments AS assessment
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            WHERE assessment.id = :assessment_id
            """
            + scope_sql
            + " FOR UPDATE OF assessment"
        ),
        params,
    ).first()
    if current is None:
        raise LookupError("Évaluation introuvable ou non autorisée.")

    grade_count = db.execute(
        text(
            """
            SELECT COUNT(*)::integer
            FROM grades
            WHERE assessment_id = :assessment_id
            """
        ),
        {"assessment_id": assessment_id},
    ).scalar_one()

    updates = assessment_data.model_dump(exclude_unset=True)
    if grade_count > 0:
        date_changed = (
            "assessment_date" in updates
            and updates["assessment_date"] != current.assessment_date
        )
        scale_changed = (
            "maximum_score" in updates
            and updates["maximum_score"] != current.maximum_score
        )
        if date_changed or scale_changed:
            raise ValueError(
                "La date et le barème ne sont plus modifiables après la première note."
            )

    allowed_columns = {
        "title",
        "description",
        "assessment_date",
        "maximum_score",
        "coefficient",
    }
    set_parts: list[str] = []
    update_params: dict = {"assessment_id": assessment_id}
    for column_name, value in updates.items():
        if column_name not in allowed_columns:
            continue
        set_parts.append(f"{column_name} = :{column_name}")
        update_params[column_name] = value

    if set_parts:
        db.execute(
            text(
                "UPDATE assessments SET "
                + ", ".join(set_parts)
                + " WHERE id = :assessment_id"
            ),
            update_params,
        )
        db.commit()
    return get_assessment(db=db, actor=actor, assessment_id=assessment_id)


def _list_grade_sheet_rows(
    db: Session,
    actor: Account,
    assessment_id: UUID,
) -> list[dict]:
    """Charge tous les inscrits, y compris ceux sans note."""

    scope_sql, params = _actor_view_scope(actor)
    params["assessment_id"] = assessment_id
    rows = db.execute(
        text(
            """
            SELECT
                enrollment.id AS student_enrollment_id,
                student.id AS student_id,
                account.registration_number,
                concat_ws(' ', student.first_name, student.last_name) AS student_name,
                grade.id AS grade_id,
                grade.result_type,
                grade.score,
                grade.comment,
                grade.justification_status,
                grade.reviewed_by_account_id,
                grade.reviewed_at,
                grade.created_at,
                grade.updated_at,
                assessment.maximum_score
            FROM assessments AS assessment
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            JOIN student_enrollments AS enrollment
              ON enrollment.class_id = class_subject.class_id
             AND assessment.assessment_date >= enrollment.start_date
             AND assessment.assessment_date <= COALESCE(
                    enrollment.end_date,
                    assessment.assessment_date
                 )
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN accounts AS account ON account.id = student.account_id
            LEFT JOIN grades AS grade
              ON grade.assessment_id = assessment.id
             AND grade.student_enrollment_id = enrollment.id
            WHERE assessment.id = :assessment_id
            """
            + scope_sql
            + " ORDER BY student.last_name, student.first_name"
        ),
        params,
    ).mappings().all()

    result: list[dict] = []
    for row in rows:
        item = dict(row)
        item["normalized_score_on_20"] = get_effective_score_on_20(
            result_type=row.result_type,
            score=row.score,
            maximum_score=row.maximum_score,
            justification_status=row.justification_status,
        )
        item.pop("maximum_score")
        result.append(item)
    return result


def calculate_assessment_statistics(rows: list[dict]) -> dict:
    """Calcule les indicateurs officiels à partir d'une feuille complète."""

    effective_scores = [
        row["normalized_score_on_20"]
        for row in rows
        if row["normalized_score_on_20"] is not None
    ]
    grade_rows = [row for row in rows if row["grade_id"] is not None]
    scored_count = sum(row["result_type"] == "SCORED" for row in grade_rows)
    absent_count = sum(row["result_type"] == "ABSENT" for row in grade_rows)
    pending_count = sum(
        row["result_type"] == "ABSENT"
        and row["justification_status"] == "PENDING"
        for row in grade_rows
    )

    average = None
    highest = None
    lowest = None
    if effective_scores:
        average = sum(effective_scores) / len(effective_scores)
        highest = max(effective_scores)
        lowest = min(effective_scores)

    return {
        "enrolled_count": len(rows),
        "grade_count": len(grade_rows),
        "scored_count": scored_count,
        "absent_count": absent_count,
        "missing_count": len(rows) - len(grade_rows),
        "pending_absence_count": pending_count,
        "official_average_on_20": average,
        "highest_score_on_20": highest,
        "lowest_score_on_20": lowest,
        "excellent_count": sum(score >= Decimal("16") for score in effective_scores),
        "good_count": sum(Decimal("12") <= score < Decimal("16") for score in effective_scores),
        "average_count": sum(Decimal("8") <= score < Decimal("12") for score in effective_scores),
        "weak_count": sum(score < Decimal("8") for score in effective_scores),
    }


def get_grade_sheet(
    db: Session,
    actor: Account,
    assessment_id: UUID,
) -> dict:
    """Retourne la feuille collective et ses calculs officiels."""

    assessment = get_assessment(db=db, actor=actor, assessment_id=assessment_id)
    rows = _list_grade_sheet_rows(db=db, actor=actor, assessment_id=assessment_id)
    return {
        "assessment": assessment,
        "rows": rows,
        "statistics": calculate_assessment_statistics(rows),
    }


def submit_grade_sheet(
    db: Session,
    actor: Account,
    assessment_id: UUID,
    sheet_data: GradeSheetSubmit,
) -> dict:
    """Enregistre atomiquement les nouvelles lignes d'une feuille collective."""

    scope_sql, params = _actor_scope(actor)
    params["assessment_id"] = assessment_id
    assessment = db.execute(
        text(
            """
            SELECT assessment.id, assessment.maximum_score
            FROM assessments AS assessment
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            WHERE assessment.id = :assessment_id
            """
            + scope_sql
            + " FOR UPDATE"
        ),
        params,
    ).first()
    if assessment is None:
        raise LookupError("Évaluation introuvable ou non autorisée.")

    enrollment_ids = [entry.student_enrollment_id for entry in sheet_data.entries]
    if len(enrollment_ids) != len(set(enrollment_ids)):
        raise ValueError("Un élève apparaît plusieurs fois dans la feuille transmise.")

    eligible_rows = db.execute(
        text(
            """
            SELECT enrollment.id
            FROM assessments AS assessment
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            JOIN student_enrollments AS enrollment
              ON enrollment.class_id = class_subject.class_id
             AND assessment.assessment_date >= enrollment.start_date
             AND assessment.assessment_date <= COALESCE(
                    enrollment.end_date,
                    assessment.assessment_date
                 )
            WHERE assessment.id = :assessment_id
              AND enrollment.id = ANY(CAST(:enrollment_ids AS uuid[]))
            FOR UPDATE OF enrollment
            """
        ),
        {
            "assessment_id": assessment_id,
            "enrollment_ids": enrollment_ids,
        },
    ).all()
    eligible_ids = {row.id for row in eligible_rows}
    if eligible_ids != set(enrollment_ids):
        raise ValueError("Au moins un élève n'appartient pas à la classe à la date de l'évaluation.")

    existing = db.execute(
        text(
            """
            SELECT student_enrollment_id
            FROM grades
            WHERE assessment_id = :assessment_id
              AND student_enrollment_id = ANY(CAST(:enrollment_ids AS uuid[]))
            FOR UPDATE
            """
        ),
        {
            "assessment_id": assessment_id,
            "enrollment_ids": enrollment_ids,
        },
    ).all()
    if existing:
        raise ValueError(
            "Une note existe déjà. Utilisez une demande de correction pour la modifier."
        )

    for entry in sheet_data.entries:
        validate_score_against_scale(
            result_type=entry.result_type,
            score=entry.score,
            maximum_score=assessment.maximum_score,
        )
        justification_status = entry.justification_status
        if entry.result_type == "ABSENT" and justification_status is None:
            justification_status = "UNJUSTIFIED"
        db.execute(
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
                """
            ),
            {
                "assessment_id": assessment_id,
                "student_enrollment_id": entry.student_enrollment_id,
                "result_type": entry.result_type,
                "score": entry.score,
                "comment": entry.comment.strip() if entry.comment else None,
                "justification_status": justification_status,
            },
        )

    db.commit()
    return get_grade_sheet(db=db, actor=actor, assessment_id=assessment_id)


def get_dashboard_summary(
    db: Session,
    actor: Account,
    q: str | None = None,
    class_id: UUID | None = None,
    subject_id: UUID | None = None,
    reporting_period_id: UUID | None = None,
) -> dict:
    """Agrège côté backend les indicateurs de l'écran Notes."""

    assessments = list_assessments(
        db=db,
        actor=actor,
        q=q,
        class_id=class_id,
        subject_id=subject_id,
        reporting_period_id=reporting_period_id,
    )
    all_rows: list[dict] = []
    student_ids: set[UUID] = set()
    for assessment in assessments:
        rows = _list_grade_sheet_rows(
            db=db,
            actor=actor,
            assessment_id=assessment["id"],
        )
        all_rows.extend(rows)
        student_ids.update(row["student_id"] for row in rows)

    statistics = calculate_assessment_statistics(all_rows)
    return {
        "assessments_count": len(assessments),
        "students_count": len(student_ids),
        "expected_grade_count": statistics["enrolled_count"],
        "grade_count": statistics["grade_count"],
        "scored_count": statistics["scored_count"],
        "absence_count": statistics["absent_count"],
        "missing_count": statistics["missing_count"],
        "official_average_on_20": statistics["official_average_on_20"],
        "excellent_count": statistics["excellent_count"],
        "good_count": statistics["good_count"],
        "average_count": statistics["average_count"],
        "weak_count": statistics["weak_count"],
    }
