"""Règles métier des appréciations de période avant bulletin."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.schemas.appreciation_save import OverallAppreciationSave, SubjectAppreciationSave


def _get_teacher_id(db: Session, actor: Account) -> UUID:
    """Retourne le dossier enseignant du compte connecté."""

    if actor.role != "TEACHER":
        raise PermissionError("Seul un enseignant peut rédiger une appréciation.")
    teacher_id = db.execute(
        text("SELECT id FROM teachers WHERE account_id = :account_id"),
        {"account_id": actor.id},
    ).scalar_one_or_none()
    if teacher_id is None:
        raise PermissionError("Le dossier enseignant associé au compte est introuvable.")
    return teacher_id


def _is_validated(db: Session, enrollment_id: UUID, period_id: UUID) -> bool:
    """Indique si un bulletin validé rend le contexte immuable."""

    return bool(db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1 FROM report_cards
                WHERE student_enrollment_id = :enrollment_id
                  AND reporting_period_id = :period_id
                  AND validated_at IS NOT NULL
            )
            """
        ),
        {"enrollment_id": enrollment_id, "period_id": period_id},
    ).scalar_one())


def _validate_subject_context(
    db: Session,
    actor: Account,
    enrollment_id: UUID,
    class_subject_id: UUID,
    period_id: UUID,
) -> UUID:
    """Vérifie cohérence, période et droit de l'enseignant sur la matière."""

    teacher_id = _get_teacher_id(db, actor)
    row = db.execute(
        text(
            """
            SELECT assignment.teacher_id
            FROM student_enrollments AS enrollment
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            JOIN class_subjects AS class_subject
              ON class_subject.class_id = school_class.id
            JOIN reporting_periods AS period
              ON period.school_year_id = school_class.school_year_id
            JOIN teacher_assignments AS assignment
              ON assignment.class_subject_id = class_subject.id
             AND assignment.end_date IS NULL
            WHERE enrollment.id = :enrollment_id
              AND class_subject.id = :class_subject_id
              AND period.id = :period_id
            """
        ),
        {
            "enrollment_id": enrollment_id,
            "class_subject_id": class_subject_id,
            "period_id": period_id,
        },
    ).first()
    if row is None:
        raise LookupError("L'élève, la matière ou la période est introuvable dans ce contexte.")
    if row.teacher_id != teacher_id:
        raise PermissionError("Vous n'êtes pas l'enseignant affecté à cette matière.")
    if _is_validated(db, enrollment_id, period_id):
        raise ValueError("Le bulletin est validé : cette appréciation ne peut plus être modifiée.")
    return teacher_id


def get_appreciation_contexts(db: Session, actor: Account) -> list[dict]:
    """Liste les contextes de rédaction autorisés pour un enseignant."""

    teacher_id = _get_teacher_id(db, actor)
    rows = db.execute(
        text(
            """
            SELECT
                class_subject.id AS class_subject_id,
                school_class.id AS class_id,
                concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                subject.name AS subject_name,
                period.id AS reporting_period_id,
                period.name AS reporting_period_name,
                school_class.main_teacher_id = :teacher_id AS is_main_teacher
            FROM teacher_assignments AS assignment
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN reporting_periods AS period ON period.school_year_id = school_class.school_year_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            WHERE assignment.teacher_id = :teacher_id
              AND assignment.end_date IS NULL
              AND school_year.closed_at IS NULL
            ORDER BY school_year.start_date DESC, class_level.display_order, school_class.group_label, subject.name, period.start_date
            """
        ),
        {"teacher_id": teacher_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def get_subject_appreciations(
    db: Session, actor: Account, class_subject_id: UUID, period_id: UUID,
) -> list[dict]:
    """Retourne les élèves et le brouillon d'appréciation d'une matière."""

    teacher_id = _get_teacher_id(db, actor)
    rows = db.execute(
        text(
            """
            SELECT
                enrollment.id AS student_enrollment_id,
                concat_ws(' ', student.first_name, student.last_name) AS student_name,
                account.registration_number,
                appreciation.comment,
                EXISTS (
                    SELECT 1 FROM report_cards AS report_card
                    WHERE report_card.student_enrollment_id = enrollment.id
                      AND report_card.reporting_period_id = :period_id
                      AND report_card.validated_at IS NOT NULL
                ) AS is_locked
            FROM class_subjects AS class_subject
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN reporting_periods AS period ON period.school_year_id = school_class.school_year_id
            JOIN teacher_assignments AS assignment
              ON assignment.class_subject_id = class_subject.id AND assignment.end_date IS NULL
            JOIN student_enrollments AS enrollment ON enrollment.class_id = school_class.id
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN accounts AS account ON account.id = student.account_id
            LEFT JOIN student_subject_appreciations AS appreciation
              ON appreciation.student_enrollment_id = enrollment.id
             AND appreciation.class_subject_id = class_subject.id
             AND appreciation.reporting_period_id = period.id
            WHERE class_subject.id = :class_subject_id
              AND period.id = :period_id
              AND assignment.teacher_id = :teacher_id
            ORDER BY student.last_name, student.first_name
            """
        ),
        {"class_subject_id": class_subject_id, "period_id": period_id, "teacher_id": teacher_id},
    ).mappings().all()
    if not rows:
        raise LookupError("Aucun élève ou aucune affectation active n'a été trouvé.")
    return [dict(row) for row in rows]


def save_subject_appreciation(
    db: Session, actor: Account, enrollment_id: UUID, data: SubjectAppreciationSave,
) -> dict:
    """Enregistre une appréciation par matière sans supprimer l'historique."""

    teacher_id = _validate_subject_context(db, actor, enrollment_id, data.class_subject_id, data.reporting_period_id)
    row = db.execute(
        text(
            """
            INSERT INTO student_subject_appreciations (
                student_enrollment_id, class_subject_id, reporting_period_id, comment, created_by_teacher_id
            ) VALUES (:enrollment_id, :class_subject_id, :period_id, :comment, :teacher_id)
            ON CONFLICT (student_enrollment_id, class_subject_id, reporting_period_id)
            DO UPDATE SET comment = EXCLUDED.comment, created_by_teacher_id = EXCLUDED.created_by_teacher_id
            RETURNING id, comment, updated_at
            """
        ),
        {"enrollment_id": enrollment_id, "class_subject_id": data.class_subject_id,
         "period_id": data.reporting_period_id, "comment": data.comment.strip(), "teacher_id": teacher_id},
    ).mappings().one()
    db.commit()
    return dict(row)


def _validate_overall_context(db: Session, actor: Account, enrollment_id: UUID, period_id: UUID) -> UUID:
    """Vérifie que l'auteur est le professeur principal de la classe."""

    teacher_id = _get_teacher_id(db, actor)
    exists = db.execute(
        text(
            """
            SELECT 1
            FROM student_enrollments AS enrollment
            JOIN classes AS school_class ON school_class.id = enrollment.class_id
            JOIN reporting_periods AS period ON period.school_year_id = school_class.school_year_id
            WHERE enrollment.id = :enrollment_id
              AND period.id = :period_id
              AND school_class.main_teacher_id = :teacher_id
            """
        ),
        {"enrollment_id": enrollment_id, "period_id": period_id, "teacher_id": teacher_id},
    ).first()
    if exists is None:
        raise PermissionError("Seul le professeur principal peut rédiger l'appréciation générale.")
    if _is_validated(db, enrollment_id, period_id):
        raise ValueError("Le bulletin est validé : cette appréciation ne peut plus être modifiée.")
    return teacher_id


def get_overall_appreciations(db: Session, actor: Account, class_id: UUID, period_id: UUID) -> list[dict]:
    """Retourne les brouillons généraux de la classe du professeur principal."""

    teacher_id = _get_teacher_id(db, actor)
    rows = db.execute(text(
        """
        SELECT enrollment.id AS student_enrollment_id,
               concat_ws(' ', student.first_name, student.last_name) AS student_name,
               account.registration_number, appreciation.comment,
               EXISTS (SELECT 1 FROM report_cards AS report_card
                       WHERE report_card.student_enrollment_id = enrollment.id
                         AND report_card.reporting_period_id = :period_id
                         AND report_card.validated_at IS NOT NULL) AS is_locked
        FROM classes AS school_class
        JOIN reporting_periods AS period ON period.school_year_id = school_class.school_year_id
        JOIN student_enrollments AS enrollment ON enrollment.class_id = school_class.id
        JOIN students AS student ON student.id = enrollment.student_id
        JOIN accounts AS account ON account.id = student.account_id
        LEFT JOIN student_overall_appreciations AS appreciation
          ON appreciation.student_enrollment_id = enrollment.id
         AND appreciation.reporting_period_id = period.id
        WHERE school_class.id = :class_id
          AND period.id = :period_id
          AND school_class.main_teacher_id = :teacher_id
        ORDER BY student.last_name, student.first_name
        """),
        {"class_id": class_id, "period_id": period_id, "teacher_id": teacher_id},
    ).mappings().all()
    if not rows:
        raise LookupError("Cette classe n'est pas sous votre responsabilité ou ne contient aucun élève.")
    return [dict(row) for row in rows]


def save_overall_appreciation(
    db: Session, actor: Account, enrollment_id: UUID, data: OverallAppreciationSave,
) -> dict:
    """Enregistre une appréciation générale du professeur principal."""

    teacher_id = _validate_overall_context(db, actor, enrollment_id, data.reporting_period_id)
    row = db.execute(text(
        """
        INSERT INTO student_overall_appreciations (
            student_enrollment_id, reporting_period_id, comment, created_by_teacher_id
        ) VALUES (:enrollment_id, :period_id, :comment, :teacher_id)
        ON CONFLICT (student_enrollment_id, reporting_period_id)
        DO UPDATE SET comment = EXCLUDED.comment, created_by_teacher_id = EXCLUDED.created_by_teacher_id
        RETURNING id, comment, updated_at
        """),
        {"enrollment_id": enrollment_id, "period_id": data.reporting_period_id,
         "comment": data.comment.strip(), "teacher_id": teacher_id},
    ).mappings().one()
    db.commit()
    return dict(row)
