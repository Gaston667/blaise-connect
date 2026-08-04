"""Workflow contrôlé des corrections de notes."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.schemas.grade_change_request_create import GradeChangeRequestCreate
from app.schemas.grade_change_request_decision import GradeChangeRequestDecision
from app.services.assessment_service import validate_score_against_scale


def _request_actor_scope(actor: Account) -> tuple[str, dict]:
    """Limite un enseignant à ses demandes et aux classes qu'il encadre."""

    if actor.role == "TEACHER":
        return """
            AND (
                teacher.account_id = :actor_account_id
                OR EXISTS (
                    SELECT 1
                    FROM teachers AS reviewer_teacher
                    WHERE reviewer_teacher.account_id = :actor_account_id
                      AND reviewer_teacher.id = school_class.main_teacher_id
                      AND change_request.requested_by_account_id <> :actor_account_id
                )
            )
        """, {"actor_account_id": actor.id, "actor_role": actor.role}
    return "", {"actor_account_id": actor.id, "actor_role": actor.role}


def can_review_grade_change(
    reviewer: Account,
    reviewer_teacher_id: UUID | None,
    main_teacher_id: UUID,
    requested_by_account_id: UUID,
) -> bool:
    """Applique la règle de validation sans permettre l'auto-validation."""

    if reviewer.role == "ADMIN":
        return True
    if reviewer.id == requested_by_account_id:
        return False
    return (
        reviewer.role == "TEACHER"
        and reviewer_teacher_id is not None
        and reviewer_teacher_id == main_teacher_id
    )


def list_grade_change_requests(
    db: Session,
    actor: Account,
    status_filter: str | None = None,
    grade_id: UUID | None = None,
    assessment_id: UUID | None = None,
    request_id: UUID | None = None,
) -> list[dict]:
    """Liste les demandes visibles par l'administrateur ou l'enseignant."""

    sql = """
        SELECT
            change_request.id,
            change_request.grade_id,
            assessment.id AS assessment_id,
            assessment.title AS assessment_title,
            concat_ws(' ', student.first_name, student.last_name) AS student_name,
            student_account.registration_number,
            concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
            subject.name AS subject_name,
            CASE
                WHEN change_request.requested_by_account_id = :actor_account_id
                    THEN false
                WHEN :actor_role = 'ADMIN'
                    THEN true
                ELSE EXISTS (
                    SELECT 1
                    FROM teachers AS reviewer_teacher
                    WHERE reviewer_teacher.account_id = :actor_account_id
                      AND reviewer_teacher.id = school_class.main_teacher_id
                )
            END AS can_review,
            change_request.requested_by_account_id,
            requester.registration_number AS requested_by_registration_number,
            change_request.previous_result_type,
            change_request.previous_score,
            change_request.previous_justification_status,
            change_request.proposed_result_type,
            change_request.proposed_score,
            change_request.proposed_justification_status,
            change_request.request_reason,
            change_request.status,
            change_request.reviewed_by_account_id,
            change_request.reviewed_at,
            change_request.decision_comment,
            change_request.created_at,
            change_request.updated_at
        FROM grade_change_requests AS change_request
        JOIN grades AS grade ON grade.id = change_request.grade_id
        JOIN assessments AS assessment ON assessment.id = grade.assessment_id
        JOIN teacher_assignments AS assignment
          ON assignment.id = assessment.teacher_assignment_id
        JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN subjects AS subject ON subject.id = class_subject.subject_id
        JOIN classes AS school_class ON school_class.id = class_subject.class_id
        JOIN class_levels AS class_level
          ON class_level.id = school_class.class_level_id
        JOIN student_enrollments AS enrollment
          ON enrollment.id = grade.student_enrollment_id
        JOIN students AS student ON student.id = enrollment.student_id
        JOIN accounts AS student_account ON student_account.id = student.account_id
        JOIN accounts AS requester
          ON requester.id = change_request.requested_by_account_id
        WHERE 1 = 1
    """
    scope_sql, params = _request_actor_scope(actor)
    sql += scope_sql
    if status_filter:
        sql += " AND change_request.status = :status_filter"
        params["status_filter"] = status_filter
    if grade_id is not None:
        sql += " AND change_request.grade_id = :grade_id"
        params["grade_id"] = grade_id
    if assessment_id is not None:
        sql += " AND assessment.id = :assessment_id"
        params["assessment_id"] = assessment_id
    if request_id is not None:
        sql += " AND change_request.id = :request_id"
        params["request_id"] = request_id
    sql += " ORDER BY change_request.created_at DESC"
    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def create_grade_change_request(
    db: Session,
    actor: Account,
    request_data: GradeChangeRequestCreate,
) -> dict:
    """Mémorise l'ancienne valeur et crée une demande atomique."""

    scope_sql, params = _request_actor_scope(actor)
    params["grade_id"] = request_data.grade_id
    grade = db.execute(
        text(
            """
            SELECT
                grade.id,
                grade.result_type,
                grade.score,
                grade.justification_status,
                assessment.maximum_score
            FROM grades AS grade
            JOIN assessments AS assessment ON assessment.id = grade.assessment_id
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            WHERE grade.id = :grade_id
            """
            + scope_sql
            + " FOR UPDATE OF grade"
        ),
        params,
    ).first()
    if grade is None:
        raise LookupError("Note introuvable ou non autorisée.")

    validate_score_against_scale(
        result_type=request_data.proposed_result_type,
        score=request_data.proposed_score,
        maximum_score=grade.maximum_score,
    )

    request_id = db.execute(
        text(
            """
            INSERT INTO grade_change_requests (
                grade_id,
                requested_by_account_id,
                previous_result_type,
                previous_score,
                previous_justification_status,
                proposed_result_type,
                proposed_score,
                proposed_justification_status,
                request_reason
            )
            VALUES (
                :grade_id,
                :requested_by_account_id,
                :previous_result_type,
                :previous_score,
                :previous_justification_status,
                :proposed_result_type,
                :proposed_score,
                :proposed_justification_status,
                :request_reason
            )
            RETURNING id
            """
        ),
        {
            "grade_id": request_data.grade_id,
            "requested_by_account_id": actor.id,
            "previous_result_type": grade.result_type,
            "previous_score": grade.score,
            "previous_justification_status": grade.justification_status,
            "proposed_result_type": request_data.proposed_result_type,
            "proposed_score": request_data.proposed_score,
            "proposed_justification_status": request_data.proposed_justification_status,
            "request_reason": request_data.request_reason,
        },
    ).scalar_one()
    db.commit()
    created = list_grade_change_requests(
        db=db,
        actor=actor,
        request_id=request_id,
    )
    return created[0]


def review_grade_change_request(
    db: Session,
    reviewer: Account,
    request_id: UUID,
    decision: GradeChangeRequestDecision,
) -> dict:
    """Valide ou rejette une correction autorisée sous verrou transactionnel."""

    change_request = db.execute(
        text(
            """
            SELECT
                change_request.id,
                change_request.grade_id,
                change_request.previous_result_type,
                change_request.previous_score,
                change_request.previous_justification_status,
                change_request.proposed_result_type,
                change_request.proposed_score,
                change_request.proposed_justification_status,
                change_request.requested_by_account_id,
                school_class.main_teacher_id,
                change_request.status
            FROM grade_change_requests AS change_request
            JOIN grades AS grade ON grade.id = change_request.grade_id
            JOIN assessments AS assessment ON assessment.id = grade.assessment_id
            JOIN teacher_assignments AS assignment
              ON assignment.id = assessment.teacher_assignment_id
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            WHERE change_request.id = :request_id
            FOR UPDATE OF change_request
            """
        ),
        {"request_id": request_id},
    ).first()
    if change_request is None:
        raise LookupError("Demande de correction introuvable.")
    if change_request.status != "PENDING":
        raise ValueError("Cette demande a déjà reçu une décision.")

    reviewer_teacher_id = None
    if reviewer.role == "TEACHER":
        reviewer_teacher_id = db.execute(
            text("SELECT id FROM teachers WHERE account_id = :account_id"),
            {"account_id": reviewer.id},
        ).scalar_one_or_none()
    if not can_review_grade_change(
        reviewer=reviewer,
        reviewer_teacher_id=reviewer_teacher_id,
        main_teacher_id=change_request.main_teacher_id,
        requested_by_account_id=change_request.requested_by_account_id,
    ):
        raise PermissionError("Vous ne pouvez pas valider cette demande de correction.")

    grade = db.execute(
        text(
            """
            SELECT grade.id, grade.result_type, grade.score,
                   grade.justification_status, assessment.maximum_score
            FROM grades AS grade
            JOIN assessments AS assessment ON assessment.id = grade.assessment_id
            WHERE grade.id = :grade_id
            FOR UPDATE OF grade
            """
        ),
        {"grade_id": change_request.grade_id},
    ).first()
    if grade is None:
        raise LookupError("La note concernée n'existe plus.")

    unchanged = (
        grade.result_type == change_request.previous_result_type
        and grade.score == change_request.previous_score
        and grade.justification_status == change_request.previous_justification_status
    )
    if not unchanged:
        raise ValueError(
            "La note a changé depuis la demande. La décision est annulée pour éviter un écrasement."
        )

    if decision.status == "APPROVED":
        validate_score_against_scale(
            result_type=change_request.proposed_result_type,
            score=change_request.proposed_score,
            maximum_score=grade.maximum_score,
        )
        final_absence = (
            change_request.proposed_result_type == "ABSENT"
            and change_request.proposed_justification_status in {"JUSTIFIED", "REJECTED"}
        )
        db.execute(
            text(
                """
                UPDATE grades
                   SET result_type = :result_type,
                       score = :score,
                       justification_status = :justification_status,
                       reviewed_by_account_id = :reviewed_by_account_id,
                       reviewed_at = CASE
                           WHEN :reviewed_by_account_id IS NULL THEN NULL
                           ELSE now()
                       END
                 WHERE id = :grade_id
                """
            ),
            {
                "result_type": change_request.proposed_result_type,
                "score": change_request.proposed_score,
                "justification_status": change_request.proposed_justification_status,
                "reviewed_by_account_id": reviewer.id if final_absence else None,
                "grade_id": change_request.grade_id,
            },
        )

    db.execute(
        text(
            """
            UPDATE grade_change_requests
               SET status = :status,
                   reviewed_by_account_id = :reviewed_by_account_id,
                   reviewed_at = now(),
                   decision_comment = :decision_comment
             WHERE id = :request_id
            """
        ),
        {
            "status": decision.status,
            "reviewed_by_account_id": reviewer.id,
            "decision_comment": decision.decision_comment,
            "request_id": request_id,
        },
    )
    db.commit()
    reviewed = list_grade_change_requests(
        db=db,
        actor=reviewer,
        request_id=request_id,
    )
    return reviewed[0]
