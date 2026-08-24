"""Stockage securise des justificatifs d'absence et de retard."""

from datetime import date, timedelta
from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.services.account_storage_service import (
    ACCOUNT_STORAGE_ROOT,
    get_account_justification_directory,
)


MAX_JUSTIFICATION_SIZE = 5 * 1024 * 1024
ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

# Nombre de jours, apres la date de l'incident, pendant lesquels l'eleve
# peut encore soumettre un justificatif.
JUSTIFICATION_DEADLINE_DAYS = 7


def _get_record_owner(db: Session, record_id: UUID):
    """Retourne le compte eleve proprietaire de l'incident."""

    row = db.execute(text("""
        SELECT record.id, record.justification_status,
               event.attendance_date,
               student.id AS student_id, student.account_id,
               account.registration_number
        FROM attendance_records AS record
        JOIN attendance_events AS event ON event.id = record.attendance_event_id
        JOIN student_enrollments AS enrollment
          ON enrollment.id = record.student_enrollment_id
        JOIN students AS student ON student.id = enrollment.student_id
        JOIN accounts AS account ON account.id = student.account_id
        WHERE record.id = :record_id AND record.deleted_at IS NULL
    """), {"record_id": record_id}).mappings().first()
    if row is None:
        raise LookupError("Incident d'assiduite introuvable.")
    return row


def _can_read_record(db: Session, actor: Account, record_id: UUID) -> bool:
    """Controle l'acces au justificatif selon le role et l'affectation."""

    if actor.role == "ADMIN":
        return True
    if actor.role == "STUDENT":
        return _get_record_owner(db, record_id)["account_id"] == actor.id
    if actor.role == "TEACHER":
        return bool(db.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM attendance_records AS record
                JOIN attendance_events AS event ON event.id = record.attendance_event_id
                JOIN teacher_assignments AS assignment
                  ON assignment.id = event.teacher_assignment_id
                JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
                WHERE record.id = :record_id AND teacher.account_id = :account_id
            )
        """), {"record_id": record_id, "account_id": actor.id}).scalar_one())
    return False


def upload_attendance_justification(
    db: Session,
    student_account: Account,
    record_id: UUID,
    reason: str,
    upload: UploadFile | None,
) -> dict:
    """Enregistre le fichier et place le justificatif en attente."""

    owner = _get_record_owner(db, record_id)
    if owner["account_id"] != student_account.id:
        raise PermissionError("Cet incident n'appartient pas a cet eleve.")
    if owner["justification_status"] == "REJECTED":
        raise ValueError(
            "Ce justificatif a ete refuse par l'administration et ne peut plus etre soumis a nouveau."
        )
    if owner["justification_status"] == "PENDING":
        raise ValueError("Un justificatif est deja en attente de traitement pour cet incident.")
    if owner["justification_status"] == "JUSTIFIED":
        raise ValueError("Cet incident est deja justifie.")
    deadline = owner["attendance_date"] + timedelta(days=JUSTIFICATION_DEADLINE_DAYS)
    if date.today() > deadline:
        raise ValueError(
            f"Le delai de justification ({JUSTIFICATION_DEADLINE_DAYS} jours) est depasse "
            f"pour cet incident. Il n'est plus possible de le justifier en ligne."
        )
    cleaned_reason = reason.strip()
    if len(cleaned_reason) < 3:
        raise ValueError("Le motif doit contenir au moins 3 caracteres.")
    if upload is None:
        db.execute(text("""
            UPDATE attendance_records
               SET reason = :reason, justification_status = 'PENDING',
                   reviewed_by_account_id = NULL, reviewed_at = NULL
             WHERE id = :record_id
        """), {"reason": cleaned_reason, "record_id": record_id})
        db.commit()
        return {"document_id": None, "justification_status": "PENDING"}

    mime_type = upload.content_type or ""
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError("Le justificatif doit etre un PDF, JPEG, PNG ou WebP.")
    content = upload.file.read(MAX_JUSTIFICATION_SIZE + 1)
    if not content:
        raise ValueError("Le fichier est vide.")
    if len(content) > MAX_JUSTIFICATION_SIZE:
        raise ValueError("Le justificatif ne doit pas depasser 5 Mo.")

    suffix = ALLOWED_MIME_TYPES[mime_type]
    stored_filename = f"justificatif-{uuid4().hex}{suffix}"
    directory = get_account_justification_directory(owner["registration_number"])
    physical_path = directory / stored_filename
    physical_path.write_bytes(content)
    logical_path = (
        f"accounts/{owner['registration_number']}/justificatifs/{stored_filename}"
    )
    try:
        document_id = db.execute(text("""
            INSERT INTO documents (
                document_type_id, title, storage_path, original_filename,
                mime_type, size_bytes, sha256, uploaded_by_account_id
            )
            SELECT id, :title, :storage_path, :original_filename,
                   :mime_type, :size_bytes, :sha256, :actor_id
            FROM document_types
            WHERE code = 'ATTENDANCE_JUSTIFICATION' AND is_active = true
            RETURNING id
        """), {
            "title": f"Justificatif - {cleaned_reason[:100]}",
            "storage_path": logical_path,
            "original_filename": Path(upload.filename or "justificatif").name,
            "mime_type": mime_type,
            "size_bytes": len(content),
            "sha256": sha256(content).hexdigest(),
            "actor_id": student_account.id,
        }).scalar_one_or_none()
        if document_id is None:
            raise ValueError("Le type de justificatif est indisponible.")
        db.execute(text("""
            INSERT INTO attendance_record_documents (attendance_record_id, document_id)
            VALUES (:record_id, :document_id)
        """), {"record_id": record_id, "document_id": document_id})
        db.execute(text("""
            UPDATE attendance_records
               SET reason = :reason, justification_status = 'PENDING',
                   reviewed_by_account_id = NULL, reviewed_at = NULL
             WHERE id = :record_id
        """), {"reason": cleaned_reason, "record_id": record_id})
        db.commit()
    except Exception:
        db.rollback()
        physical_path.unlink(missing_ok=True)
        raise
    return {"document_id": document_id, "justification_status": "PENDING"}


def list_attendance_documents(
    db: Session,
    actor: Account,
    record_id: UUID,
) -> list[dict]:
    """Liste les justificatifs visibles sans exposer leur chemin."""

    if not _can_read_record(db, actor, record_id):
        raise PermissionError("Vous ne pouvez pas consulter ce justificatif.")
    rows = db.execute(text("""
        SELECT document.id, document.title, document.original_filename,
               document.mime_type, document.size_bytes, document.created_at
        FROM attendance_record_documents AS link
        JOIN documents AS document ON document.id = link.document_id
        WHERE link.attendance_record_id = :record_id
          AND document.archived_at IS NULL
        ORDER BY document.created_at DESC
    """), {"record_id": record_id}).mappings().all()
    return [dict(row) for row in rows]


def get_attendance_document_file(
    db: Session,
    actor: Account,
    record_id: UUID,
    document_id: UUID,
) -> tuple[Path, str, str]:
    """Resout un justificatif autorise vers son fichier prive."""

    if not _can_read_record(db, actor, record_id):
        raise PermissionError("Vous ne pouvez pas consulter ce justificatif.")
    row = db.execute(text("""
        SELECT document.storage_path, document.mime_type,
               document.original_filename
        FROM attendance_record_documents AS link
        JOIN documents AS document ON document.id = link.document_id
        WHERE link.attendance_record_id = :record_id
          AND document.id = :document_id AND document.archived_at IS NULL
    """), {"record_id": record_id, "document_id": document_id}).first()
    if row is None:
        raise LookupError("Justificatif introuvable.")
    storage_root = ACCOUNT_STORAGE_ROOT.parent.resolve()
    physical_path = (storage_root / row.storage_path).resolve()
    if not physical_path.is_relative_to(storage_root) or not physical_path.is_file():
        raise LookupError("Fichier justificatif introuvable.")
    return physical_path, row.mime_type, row.original_filename
