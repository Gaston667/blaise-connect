"""Stockage et référencement des justificatifs d'absence aux évaluations."""

from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.services.account_storage_service import (
    ACCOUNT_STORAGE_ROOT,
    create_account_storage_directories,
)


MAX_JUSTIFICATION_SIZE = 5 * 1024 * 1024
ALLOWED_JUSTIFICATION_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _get_grade_document_context(
    db: Session,
    actor: Account,
    grade_id: UUID,
) -> object:
    """Vérifie l'absence et le droit d'accès au justificatif."""

    sql = """
        SELECT
            grade.id,
            grade.result_type,
            student_account.registration_number,
            teacher.account_id AS teacher_account_id
        FROM grades AS grade
        JOIN assessments AS assessment ON assessment.id = grade.assessment_id
        JOIN teacher_assignments AS assignment
          ON assignment.id = assessment.teacher_assignment_id
        JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
        JOIN student_enrollments AS enrollment
          ON enrollment.id = grade.student_enrollment_id
        JOIN students AS student ON student.id = enrollment.student_id
        JOIN accounts AS student_account ON student_account.id = student.account_id
        WHERE grade.id = :grade_id
    """
    row = db.execute(text(sql), {"grade_id": grade_id}).first()
    if row is None:
        raise LookupError("Note introuvable.")
    if actor.role == "TEACHER" and row.teacher_account_id != actor.id:
        raise PermissionError("Vous ne pouvez gérer que les justificatifs de vos évaluations.")
    if row.result_type != "ABSENT":
        raise ValueError("Un justificatif ne peut être lié qu'à une absence.")
    return row


def list_grade_documents(
    db: Session,
    actor: Account,
    grade_id: UUID,
) -> list[dict]:
    """Liste les métadonnées des justificatifs non archivés."""

    _get_grade_document_context(db=db, actor=actor, grade_id=grade_id)
    rows = db.execute(
        text(
            """
            SELECT
                document.id,
                document.title,
                document.original_filename,
                document.mime_type,
                document.size_bytes,
                document.sha256,
                document.uploaded_by_account_id,
                document.created_at
            FROM document_links AS link
            JOIN documents AS document ON document.id = link.document_id
            WHERE link.entity_type = 'ASSESSMENT'
              AND link.entity_id = :grade_id
              AND document.archived_at IS NULL
            ORDER BY document.created_at DESC
            """
        ),
        {"grade_id": grade_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def get_grade_document_file(
    db: Session,
    actor: Account,
    grade_id: UUID,
    document_id: UUID,
) -> tuple[Path, str, str]:
    """Résout un justificatif autorisé sans exposer son chemin physique."""

    _get_grade_document_context(db=db, actor=actor, grade_id=grade_id)
    document = db.execute(
        text(
            """
            SELECT document.storage_path, document.mime_type,
                   document.original_filename
            FROM document_links AS link
            JOIN documents AS document ON document.id = link.document_id
            WHERE link.entity_type = 'ASSESSMENT'
              AND link.entity_id = :grade_id
              AND link.document_id = :document_id
              AND document.archived_at IS NULL
            """
        ),
        {"grade_id": grade_id, "document_id": document_id},
    ).first()
    if document is None:
        raise LookupError("Justificatif introuvable.")

    storage_root = ACCOUNT_STORAGE_ROOT.parent.resolve()
    physical_path = (storage_root / document.storage_path).resolve()
    if not physical_path.is_relative_to(storage_root) or not physical_path.is_file():
        raise LookupError("Le fichier du justificatif est introuvable.")
    return physical_path, document.mime_type, document.original_filename


def upload_grade_justification(
    db: Session,
    actor: Account,
    grade_id: UUID,
    upload: UploadFile,
) -> dict:
    """Écrit un fichier contrôlé puis crée ses références dans une transaction."""

    context = _get_grade_document_context(db=db, actor=actor, grade_id=grade_id)
    mime_type = upload.content_type or ""
    if mime_type not in ALLOWED_JUSTIFICATION_TYPES:
        raise ValueError("Le justificatif doit être un PDF, JPEG, PNG ou WebP.")

    content = upload.file.read(MAX_JUSTIFICATION_SIZE + 1)
    if not content:
        raise ValueError("Le fichier est vide.")
    if len(content) > MAX_JUSTIFICATION_SIZE:
        raise ValueError("Le justificatif ne doit pas dépasser 5 Mo.")

    original_filename = Path(upload.filename or "justificatif").name
    suffix = ALLOWED_JUSTIFICATION_TYPES[mime_type]
    stored_filename = f"evaluation-{grade_id}-{uuid4().hex}{suffix}"
    account_directory = create_account_storage_directories(
        context.registration_number
    )
    physical_path = account_directory / "justificatifs" / stored_filename
    physical_path.write_bytes(content)
    logical_path = (
        f"accounts/{context.registration_number}/justificatifs/{stored_filename}"
    )

    try:
        document_id = db.execute(
            text(
                """
                INSERT INTO documents (
                    document_type_id,
                    title,
                    storage_path,
                    original_filename,
                    mime_type,
                    size_bytes,
                    sha256,
                    uploaded_by_account_id
                )
                SELECT
                    document_type.id,
                    :title,
                    :storage_path,
                    :original_filename,
                    :mime_type,
                    :size_bytes,
                    :sha256,
                    :uploaded_by_account_id
                FROM document_types AS document_type
                WHERE document_type.code = 'ASSESSMENT_JUSTIFICATION'
                  AND document_type.is_active = true
                RETURNING id
                """
            ),
            {
                "title": "Justificatif d'absence à une évaluation",
                "storage_path": logical_path,
                "original_filename": original_filename,
                "mime_type": mime_type,
                "size_bytes": len(content),
                "sha256": sha256(content).hexdigest(),
                "uploaded_by_account_id": actor.id,
            },
        ).scalar_one()
        db.execute(
            text(
                """
                INSERT INTO document_links (
                    document_id,
                    entity_type,
                    entity_id
                )
                VALUES (
                    :document_id,
                    'ASSESSMENT',
                    :grade_id
                )
                """
            ),
            {"grade_id": grade_id, "document_id": document_id},
        )
        db.execute(
            text(
                """
                UPDATE grades
                   SET justification_status = 'PENDING',
                       reviewed_by_account_id = NULL,
                       reviewed_at = NULL
                 WHERE id = :grade_id
                """
            ),
            {"grade_id": grade_id},
        )
        db.commit()
    except Exception:
        db.rollback()
        physical_path.unlink(missing_ok=True)
        raise

    documents = list_grade_documents(db=db, actor=actor, grade_id=grade_id)
    return documents[0]
