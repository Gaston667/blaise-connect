"""Regles metier des appels, absences, retards et corrections."""

from datetime import date
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.account import Account
from app.schemas.attendance_change_request_create import AttendanceChangeRequestCreate
from app.schemas.attendance_change_request_review import AttendanceChangeRequestReview
from app.schemas.attendance_event_create import AttendanceEventCreate
from app.schemas.attendance_record_update import AttendanceRecordUpdate


def _teacher_id_for_account(db: Session, account_id: UUID) -> UUID | None:
    """Retourne le dossier enseignant lie au compte."""

    return db.execute(
        text("SELECT id FROM teachers WHERE account_id = :account_id"),
        {"account_id": account_id},
    ).scalar_one_or_none()


def _require_assignment_access(
    db: Session,
    actor: Account,
    assignment_id: UUID,
) -> None:
    """Autorise l'admin ou l'enseignant proprietaire de l'affectation."""

    if actor.role == "ADMIN":
        return
    teacher_id = _teacher_id_for_account(db, actor.id)
    allowed = db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1 FROM teacher_assignments
                WHERE id = :assignment_id AND teacher_id = :teacher_id
            )
            """
        ),
        {"assignment_id": assignment_id, "teacher_id": teacher_id},
    ).scalar_one()
    if not allowed:
        raise PermissionError("Cet appel n'appartient pas a cet enseignant.")


def list_attendance_options(db: Session, actor: Account) -> list[dict]:
    """Liste les cours pouvant servir de contexte a un appel."""

    scope = ""
    params: dict = {}
    if actor.role == "TEACHER":
        scope = "AND teacher.account_id = :account_id"
        params["account_id"] = actor.id
    rows = db.execute(
        text(
            f"""
            SELECT assignment.id,
                   class_subject.class_id,
                   subject.name AS subject_name,
                   concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                   school_year.name AS school_year_name,
                   teacher.id AS teacher_id,
                   concat_ws(' ', teacher.first_name, teacher.last_name) AS teacher_name,
                   assignment.start_date,
                   assignment.end_date
            FROM teacher_assignments AS assignment
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
            WHERE (assignment.end_date IS NULL OR assignment.end_date >= CURRENT_DATE)
              {scope}
            ORDER BY school_year.start_date DESC, class_level.display_order,
                     school_class.group_label, subject.name
            """
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]


def list_attendance_roster(
    db: Session,
    actor: Account,
    assignment_id: UUID,
    attendance_date: date,
) -> list[dict]:
    """Retourne les inscriptions actives dans la classe a la date du cours."""

    _require_assignment_access(db, actor, assignment_id)
    rows = db.execute(
        text(
            """
            SELECT enrollment.id AS student_enrollment_id,
                   student.id AS student_id,
                   account.registration_number,
                   student.first_name,
                   student.last_name,
                   student.photo_path
            FROM teacher_assignments AS assignment
            JOIN class_subjects AS class_subject
              ON class_subject.id = assignment.class_subject_id
            JOIN student_enrollments AS enrollment
              ON enrollment.class_id = class_subject.class_id
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN accounts AS account ON account.id = student.account_id
            WHERE assignment.id = :assignment_id
              AND enrollment.start_date <= :attendance_date
              AND (enrollment.end_date IS NULL OR enrollment.end_date >= :attendance_date)
              AND student.status = 'ACTIVE'
              AND student.archived_at IS NULL
            ORDER BY student.last_name, student.first_name
            """
        ),
        {"assignment_id": assignment_id, "attendance_date": attendance_date},
    ).mappings().all()
    return [dict(row) for row in rows]


def create_attendance_event(
    db: Session,
    actor: Account,
    event_data: AttendanceEventCreate,
) -> dict:
    """Cree atomiquement l'appel et uniquement ses incidents."""

    _require_assignment_access(db, actor, event_data.teacher_assignment_id)
    roster_ids = {
        row["student_enrollment_id"]
        for row in list_attendance_roster(
            db, actor, event_data.teacher_assignment_id, event_data.attendance_date
        )
    }
    submitted_ids = {item.student_enrollment_id for item in event_data.incidents}
    if not submitted_ids.issubset(roster_ids):
        raise ValueError("Un eleve signale n'appartient pas a cette classe a cette date.")

    try:
        event_id = db.execute(
            text(
                """
                INSERT INTO attendance_events (
                    teacher_assignment_id, attendance_date,
                    course_start_time, course_end_time, created_by_account_id
                ) VALUES (
                    :assignment_id, :attendance_date,
                    :start_time, :end_time, :actor_id
                ) RETURNING id
                """
            ),
            {
                "assignment_id": event_data.teacher_assignment_id,
                "attendance_date": event_data.attendance_date,
                "start_time": event_data.course_start_time,
                "end_time": event_data.course_end_time,
                "actor_id": actor.id,
            },
        ).scalar_one()
        for incident in event_data.incidents:
            db.execute(
                text(
                    """
                    INSERT INTO attendance_records (
                        attendance_event_id, student_enrollment_id,
                        incident_type, late_minutes, reason,
                        justification_status, recorded_by_account_id
                    ) VALUES (
                        :event_id, :enrollment_id, :incident_type,
                        :late_minutes, :reason, 'UNJUSTIFIED', :actor_id
                    )
                    """
                ),
                {
                    "event_id": event_id,
                    "enrollment_id": incident.student_enrollment_id,
                    "incident_type": incident.incident_type,
                    "late_minutes": incident.late_minutes,
                    "reason": incident.reason.strip() if incident.reason else None,
                    "actor_id": actor.id,
                },
            )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ValueError("Cet appel existe deja ou contient des donnees incoherentes.") from error
    return get_attendance_event(db, actor, event_id)


def _event_scope(actor: Account) -> tuple[str, dict]:
    """Construit la restriction SQL des appels visibles."""

    if actor.role == "TEACHER":
        return "AND teacher.account_id = :actor_id", {"actor_id": actor.id}
    return "", {}


def list_attendance_events(
    db: Session,
    actor: Account,
    class_id: UUID | None = None,
    attendance_date: date | None = None,
) -> list[dict]:
    """Liste les appels visibles et leurs totaux d'incidents."""

    scope, params = _event_scope(actor)
    filters = scope
    if class_id:
        filters += " AND school_class.id = :class_id"
        params["class_id"] = class_id
    if attendance_date:
        filters += " AND event.attendance_date = :attendance_date"
        params["attendance_date"] = attendance_date
    rows = db.execute(
        text(
            f"""
            SELECT event.id, event.teacher_assignment_id, event.attendance_date,
                   event.course_start_time, event.course_end_time, event.created_at,
                   concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                   subject.name AS subject_name,
                   concat_ws(' ', teacher.first_name, teacher.last_name) AS teacher_name,
                   COUNT(record.id) FILTER (
                       WHERE record.incident_type = 'ABSENT' AND record.deleted_at IS NULL
                   ) AS absence_count,
                   COUNT(record.id) FILTER (
                       WHERE record.incident_type = 'LATE' AND record.deleted_at IS NULL
                   ) AS late_count
            FROM attendance_events AS event
            JOIN teacher_assignments AS assignment ON assignment.id = event.teacher_assignment_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            LEFT JOIN attendance_records AS record ON record.attendance_event_id = event.id
            WHERE 1 = 1 {filters}
            GROUP BY event.id, class_level.name, school_class.group_label,
                     subject.name, teacher.first_name, teacher.last_name
            ORDER BY event.attendance_date DESC, event.course_start_time DESC
            """
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]


def get_attendance_event(db: Session, actor: Account, event_id: UUID) -> dict:
    """Retourne un appel avec tous les eleves; PRESENT est calcule."""

    header = db.execute(
        text(
            """
            SELECT event.id, event.teacher_assignment_id, event.attendance_date,
                   event.course_start_time, event.course_end_time,
                   concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                   subject.name AS subject_name,
                   concat_ws(' ', teacher.first_name, teacher.last_name) AS teacher_name
            FROM attendance_events AS event
            JOIN teacher_assignments AS assignment ON assignment.id = event.teacher_assignment_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            WHERE event.id = :event_id
            """
        ),
        {"event_id": event_id},
    ).mappings().first()
    if header is None:
        raise LookupError("Appel introuvable.")
    _require_assignment_access(db, actor, header["teacher_assignment_id"])
    students = list_attendance_roster(
        db, actor, header["teacher_assignment_id"], header["attendance_date"]
    )
    records = list_attendance_records(db, actor, event_id=event_id)
    records_by_enrollment = {row["student_enrollment_id"]: row for row in records}
    roster = []
    for student in students:
        incident = records_by_enrollment.get(student["student_enrollment_id"])
        roster.append({**student, "status": incident["incident_type"] if incident else "PRESENT", "record": incident})
    return {**dict(header), "students": roster}


def list_attendance_records(
    db: Session,
    actor: Account,
    event_id: UUID | None = None,
    justification_status: str | None = None,
) -> list[dict]:
    """Liste les incidents visibles par le personnel connecte."""

    scope, params = _event_scope(actor)
    if event_id:
        scope += " AND event.id = :event_id"
        params["event_id"] = event_id
    if justification_status:
        scope += " AND record.justification_status = :justification_status"
        params["justification_status"] = justification_status
    rows = db.execute(
        text(
            f"""
            SELECT record.id, record.attendance_event_id,
                   record.student_enrollment_id, record.incident_type,
                   record.late_minutes, record.reason, record.justification_status,
                   record.reviewed_at, record.created_at,
                   event.attendance_date, event.course_start_time, event.course_end_time,
                   subject.name AS subject_name,
                   concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
                   concat_ws(' ', student.first_name, student.last_name) AS student_name,
                   student_account.registration_number,
                   concat_ws(' ', teacher.first_name, teacher.last_name) AS teacher_name,
                   EXISTS (
                       SELECT 1 FROM attendance_record_documents AS link
                       JOIN documents AS document ON document.id = link.document_id
                       WHERE link.attendance_record_id = record.id
                         AND document.archived_at IS NULL
                   ) AS has_document
            FROM attendance_records AS record
            JOIN attendance_events AS event ON event.id = record.attendance_event_id
            JOIN teacher_assignments AS assignment ON assignment.id = event.teacher_assignment_id
            JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN classes AS school_class ON school_class.id = class_subject.class_id
            JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
            JOIN student_enrollments AS enrollment ON enrollment.id = record.student_enrollment_id
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN accounts AS student_account ON student_account.id = student.account_id
            WHERE record.deleted_at IS NULL {scope}
            ORDER BY event.attendance_date DESC, student.last_name, student.first_name
            """
        ),
        params,
    ).mappings().all()
    return [dict(row) for row in rows]


def get_attendance_record_detail(
    db: Session,
    actor: Account,
    record_id: UUID,
) -> dict:
    """Retourne le détail autorisé d'une absence ou d'un retard."""

    row = db.execute(text("""
        SELECT record.id, record.incident_type, record.late_minutes,
               record.reason, record.justification_status,
               record.reviewed_at, record.last_change_reason,
               record.created_at, record.updated_at,
               event.attendance_date, event.course_start_time,
               event.course_end_time,
               subject.name AS subject_name,
               concat_ws(' ', class_level.name, school_class.group_label)
                   AS class_name,
               concat_ws(' ', student.first_name, student.last_name)
                   AS student_name,
               student_account.registration_number,
               student.account_id AS student_account_id,
               teacher.account_id AS teacher_account_id,
               concat_ws(' ', teacher.first_name, teacher.last_name)
                   AS teacher_name,
               recorder.registration_number AS recorded_by,
               reviewer.registration_number AS reviewed_by
        FROM attendance_records AS record
        JOIN attendance_events AS event ON event.id = record.attendance_event_id
        JOIN teacher_assignments AS assignment
          ON assignment.id = event.teacher_assignment_id
        JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
        JOIN class_subjects AS class_subject
          ON class_subject.id = assignment.class_subject_id
        JOIN subjects AS subject ON subject.id = class_subject.subject_id
        JOIN classes AS school_class ON school_class.id = class_subject.class_id
        JOIN class_levels AS class_level
          ON class_level.id = school_class.class_level_id
        JOIN student_enrollments AS enrollment
          ON enrollment.id = record.student_enrollment_id
        JOIN students AS student ON student.id = enrollment.student_id
        JOIN accounts AS student_account ON student_account.id = student.account_id
        JOIN accounts AS recorder ON recorder.id = record.recorded_by_account_id
        LEFT JOIN accounts AS reviewer
          ON reviewer.id = record.reviewed_by_account_id
        WHERE record.id = :record_id AND record.deleted_at IS NULL
    """), {"record_id": record_id}).mappings().first()
    if row is None:
        raise LookupError("Incident d'assiduité introuvable.")
    if actor.role == "TEACHER" and row["teacher_account_id"] != actor.id:
        raise PermissionError("Vous ne pouvez pas consulter cet incident.")
    if actor.role == "STUDENT" and row["student_account_id"] != actor.id:
        raise PermissionError("Vous ne pouvez pas consulter cet incident.")
    if actor.role not in {"ADMIN", "TEACHER", "STUDENT"}:
        raise PermissionError("Vous ne pouvez pas consulter cet incident.")

    result = dict(row)
    result.pop("teacher_account_id", None)
    result.pop("student_account_id", None)
    result["history"] = []
    if actor.role in {"ADMIN", "TEACHER"}:
        history = db.execute(text("""
            SELECT history.id, history.change_action,
                   history.old_incident_type, history.new_incident_type,
                   history.old_late_minutes, history.new_late_minutes,
                   history.old_reason, history.new_reason,
                   history.old_justification_status,
                   history.new_justification_status,
                   history.change_reason, history.changed_at,
                   account.registration_number AS changed_by
            FROM attendance_record_history AS history
            JOIN accounts AS account ON account.id = history.changed_by_account_id
            WHERE history.attendance_record_id = :record_id
            ORDER BY history.changed_at DESC
        """), {"record_id": record_id}).mappings().all()
        result["history"] = [dict(item) for item in history]
    return result


def _lock_record(db: Session, record_id: UUID):
    """Verrouille l'incident pendant une correction atomique."""

    row = db.execute(
        text("SELECT * FROM attendance_records WHERE id = :id AND deleted_at IS NULL FOR UPDATE"),
        {"id": record_id},
    ).mappings().first()
    if row is None:
        raise LookupError("Incident d'assiduite introuvable.")
    return row


def _insert_history(
    db: Session,
    record,
    actor_id: UUID,
    action: str,
    reason: str,
    new_type: str | None,
    new_minutes: int | None,
    new_reason: str | None,
    new_status: str | None,
) -> None:
    """Conserve l'etat avant et apres une correction effective."""

    db.execute(
        text(
            """
            INSERT INTO attendance_record_history (
                attendance_record_id, change_action,
                old_incident_type, new_incident_type,
                old_late_minutes, new_late_minutes,
                old_reason, new_reason,
                old_justification_status, new_justification_status,
                changed_by_account_id, change_reason
            ) VALUES (
                :record_id, :action, :old_type, :new_type,
                :old_minutes, :new_minutes, :old_reason, :new_reason,
                :old_status, :new_status, :actor_id, :reason
            )
            """
        ),
        {
            "record_id": record["id"], "action": action,
            "old_type": record["incident_type"], "new_type": new_type,
            "old_minutes": record["late_minutes"], "new_minutes": new_minutes,
            "old_reason": record["reason"], "new_reason": new_reason,
            "old_status": record["justification_status"], "new_status": new_status,
            "actor_id": actor_id, "reason": reason.strip(),
        },
    )


def update_attendance_record(
    db: Session,
    admin: Account,
    record_id: UUID,
    update_data: AttendanceRecordUpdate,
) -> dict:
    """Corrige directement un incident en tant qu'administrateur."""

    record = _lock_record(db, record_id)
    _insert_history(db, record, admin.id, "UPDATE", update_data.change_reason,
                    update_data.incident_type, update_data.late_minutes,
                    update_data.reason, record["justification_status"])
    db.execute(
        text(
            """
            UPDATE attendance_records
               SET incident_type = :incident_type, late_minutes = :late_minutes,
                   reason = :reason, updated_by_account_id = :actor_id,
                   last_change_reason = :change_reason
             WHERE id = :record_id
            """
        ),
        {"incident_type": update_data.incident_type,
         "late_minutes": update_data.late_minutes,
         "reason": update_data.reason, "actor_id": admin.id,
         "change_reason": update_data.change_reason.strip(), "record_id": record_id},
    )
    db.commit()
    return {"id": record_id, "message": "Incident corrige."}


def delete_attendance_record(
    db: Session,
    admin: Account,
    record_id: UUID,
    change_reason: str,
) -> dict:
    """Supprime logiquement un incident tout en conservant son historique."""

    record = _lock_record(db, record_id)
    _insert_history(
        db, record, admin.id, "DELETE", change_reason,
        None, None, None, None,
    )
    db.execute(
        text(
            """
            UPDATE attendance_records
               SET deleted_at = now(), deleted_by_account_id = :actor_id,
                   updated_by_account_id = :actor_id,
                   last_change_reason = :change_reason
             WHERE id = :record_id
            """
        ),
        {
            "actor_id": admin.id,
            "change_reason": change_reason.strip(),
            "record_id": record_id,
        },
    )
    db.commit()
    return {"id": record_id, "message": "Incident supprime logiquement."}


def create_attendance_change_request(
    db: Session,
    teacher: Account,
    record_id: UUID,
    request_data: AttendanceChangeRequestCreate,
) -> dict:
    """Permet a l'enseignant proprietaire de signaler une correction."""

    if teacher.role != "TEACHER":
        raise PermissionError("Cette action est reservee aux enseignants.")
    assignment_id = db.execute(
        text(
            """
            SELECT event.teacher_assignment_id
            FROM attendance_records AS record
            JOIN attendance_events AS event ON event.id = record.attendance_event_id
            WHERE record.id = :record_id AND record.deleted_at IS NULL
            """
        ), {"record_id": record_id}
    ).scalar_one_or_none()
    if assignment_id is None:
        raise LookupError("Incident d'assiduite introuvable.")
    _require_assignment_access(db, teacher, assignment_id)
    try:
        request_id = db.execute(
            text(
                """
                INSERT INTO attendance_change_requests (
                    attendance_record_id, requested_by_account_id, requested_action,
                    proposed_incident_type, proposed_late_minutes,
                    proposed_reason, request_reason
                ) VALUES (
                    :record_id, :actor_id, :action, :incident_type,
                    :late_minutes, :reason, :request_reason
                ) RETURNING id
                """
            ),
            {"record_id": record_id, "actor_id": teacher.id,
             "action": request_data.requested_action,
             "incident_type": request_data.proposed_incident_type,
             "late_minutes": request_data.proposed_late_minutes,
             "reason": request_data.proposed_reason,
             "request_reason": request_data.request_reason.strip()},
        ).scalar_one()
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ValueError("Une demande est deja en attente pour cet incident.") from error
    return {"id": request_id, "status": "PENDING"}


def list_attendance_change_requests(
    db: Session,
    admin: Account,
    status_filter: str | None = None,
) -> list[dict]:
    """Liste les demandes de correction destinees aux administrateurs."""

    params: dict = {}
    filter_sql = ""
    if status_filter:
        filter_sql = "AND request.status = :status"
        params["status"] = status_filter
    rows = db.execute(
        text(
            f"""
            SELECT request.*, event.attendance_date,
                   concat_ws(' ', student.first_name, student.last_name) AS student_name,
                   subject.name AS subject_name,
                   requester.registration_number AS requested_by_registration_number
            FROM attendance_change_requests AS request
            JOIN attendance_records AS record ON record.id = request.attendance_record_id
            JOIN attendance_events AS event ON event.id = record.attendance_event_id
            JOIN teacher_assignments AS assignment ON assignment.id = event.teacher_assignment_id
            JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
            JOIN subjects AS subject ON subject.id = class_subject.subject_id
            JOIN student_enrollments AS enrollment ON enrollment.id = record.student_enrollment_id
            JOIN students AS student ON student.id = enrollment.student_id
            JOIN accounts AS requester ON requester.id = request.requested_by_account_id
            WHERE 1 = 1 {filter_sql}
            ORDER BY request.created_at DESC
            """
        ), params
    ).mappings().all()
    return [dict(row) for row in rows]


def review_attendance_change_request(
    db: Session,
    admin: Account,
    request_id: UUID,
    review: AttendanceChangeRequestReview,
) -> dict:
    """Approuve ou rejette atomiquement une correction enseignante."""

    request = db.execute(
        text("SELECT * FROM attendance_change_requests WHERE id = :id FOR UPDATE"),
        {"id": request_id},
    ).mappings().first()
    if request is None:
        raise LookupError("Demande de correction introuvable.")
    if request["status"] != "PENDING":
        raise ValueError("Cette demande a deja ete traitee.")
    if review.decision == "APPROVED":
        record = _lock_record(db, request["attendance_record_id"])
        if request["requested_action"] == "DELETE":
            _insert_history(db, record, admin.id, "DELETE", request["request_reason"],
                            None, None, None, None)
            db.execute(text("""
                UPDATE attendance_records SET deleted_at = now(),
                    deleted_by_account_id = :actor_id,
                    updated_by_account_id = :actor_id,
                    last_change_reason = :reason WHERE id = :record_id
            """), {"actor_id": admin.id, "reason": request["request_reason"],
                    "record_id": record["id"]})
        else:
            _insert_history(db, record, admin.id, "UPDATE", request["request_reason"],
                            request["proposed_incident_type"],
                            request["proposed_late_minutes"], request["proposed_reason"],
                            record["justification_status"])
            db.execute(text("""
                UPDATE attendance_records SET incident_type = :incident_type,
                    late_minutes = :late_minutes, reason = :reason,
                    updated_by_account_id = :actor_id,
                    last_change_reason = :change_reason WHERE id = :record_id
            """), {"incident_type": request["proposed_incident_type"],
                    "late_minutes": request["proposed_late_minutes"],
                    "reason": request["proposed_reason"], "actor_id": admin.id,
                    "change_reason": request["request_reason"], "record_id": record["id"]})
    db.execute(text("""
        UPDATE attendance_change_requests
           SET status = :decision, reviewed_by_account_id = :actor_id,
               reviewed_at = now(), review_comment = :comment
         WHERE id = :request_id
    """), {"decision": review.decision, "actor_id": admin.id,
            "comment": review.review_comment, "request_id": request_id})
    db.commit()
    return {"id": request_id, "status": review.decision}


def review_attendance_justification(
    db: Session,
    admin: Account,
    record_id: UUID,
    status_value: str,
    comment: str | None,
) -> dict:
    """Valide ou rejette un justificatif en conservant l'historique."""

    record = _lock_record(db, record_id)
    if record["justification_status"] not in ("PENDING", "REJECTED"):
        raise ValueError(
            "Seul un justificatif en attente ou deja refuse peut etre traite."
        )
    reason = comment.strip() if comment else "Traitement du justificatif"
    _insert_history(db, record, admin.id, "UPDATE", reason,
                    record["incident_type"], record["late_minutes"],
                    record["reason"], status_value)
    db.execute(text("""
        UPDATE attendance_records SET justification_status = :status,
            reviewed_by_account_id = :actor_id, reviewed_at = now(),
            updated_by_account_id = :actor_id, last_change_reason = :reason
        WHERE id = :record_id
    """), {"status": status_value, "actor_id": admin.id,
            "reason": reason, "record_id": record_id})
    db.commit()
    return {"id": record_id, "justification_status": status_value}


def get_student_attendance(db: Session, student_id: UUID) -> dict:
    """Retourne au seul eleve concerne ses incidents et ses totaux."""

    rows = db.execute(text("""
        SELECT record.id, record.incident_type, record.late_minutes,
               record.reason, record.justification_status,
               event.attendance_date, event.course_start_time, event.course_end_time,
               subject.name AS subject_name,
               concat_ws(' ', class_level.name, school_class.group_label) AS class_name,
               EXISTS (
                   SELECT 1 FROM attendance_record_documents AS link
                   JOIN documents AS document ON document.id = link.document_id
                   WHERE link.attendance_record_id = record.id
                     AND document.archived_at IS NULL
               ) AS has_document
        FROM attendance_records AS record
        JOIN attendance_events AS event ON event.id = record.attendance_event_id
        JOIN teacher_assignments AS assignment ON assignment.id = event.teacher_assignment_id
        JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
        JOIN subjects AS subject ON subject.id = class_subject.subject_id
        JOIN classes AS school_class ON school_class.id = class_subject.class_id
        JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
        JOIN student_enrollments AS enrollment ON enrollment.id = record.student_enrollment_id
        WHERE enrollment.student_id = :student_id AND record.deleted_at IS NULL
        ORDER BY event.attendance_date DESC, event.course_start_time DESC
    """), {"student_id": student_id}).mappings().all()
    incidents = [dict(row) for row in rows]
    return {
        "absence_count": sum(item["incident_type"] == "ABSENT" for item in incidents),
        "late_count": sum(item["incident_type"] == "LATE" for item in incidents),
        "pending_justification_count": sum(item["justification_status"] == "PENDING" for item in incidents),
        "incidents": incidents,
    }
