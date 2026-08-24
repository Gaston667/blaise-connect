"""Gestion des documents généraux associés au dossier d'un élève."""

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.account import Account
from app.services.account_storage_service import (
    ACCOUNT_STORAGE_ROOT,
    get_account_document_directory,
)


MAX_DOCUMENT_SIZE = 5 * 1024 * 1024

ALLOWED_DOCUMENT_TYPES = {
    "ADMINISTRATIVE",
    "OTHER",
}

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _get_student_document_context(
    db: Session,
    student_id: UUID,
):
    """Récupère l'élève et son matricule pour le stockage."""

    row = db.execute(
        text(
            """
            SELECT
                student.id,
                student.account_id,
                account.registration_number
            FROM students AS student
            JOIN accounts AS account
              ON account.id = student.account_id
            WHERE student.id = :student_id
            """
        ),
        {"student_id": student_id},
    ).first()

    if row is None:
        raise LookupError("Élève introuvable.")

    return row


def list_student_documents(
    db: Session,
    student_id: UUID,
) -> list[dict]:
    """Liste les documents actifs du dossier d'un élève."""

    _get_student_document_context(
        db=db,
        student_id=student_id,
    )

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
                document.created_at,
                document.uploaded_by_account_id,

                document_type.code AS document_type_code,
                document_type.label AS document_type_label,

                uploader.registration_number AS uploaded_by_registration_number

            FROM document_links AS link

            JOIN documents AS document
              ON document.id = link.document_id

            JOIN document_types AS document_type
              ON document_type.id = document.document_type_id

            JOIN accounts AS uploader
              ON uploader.id = document.uploaded_by_account_id

            WHERE link.entity_type = 'STUDENT'
              AND link.entity_id = :student_id
              AND document.archived_at IS NULL

            ORDER BY document.created_at DESC
            """
        ),
        {"student_id": student_id},
    ).mappings().all()

    return [dict(row) for row in rows]


def upload_student_document(
    db: Session,
    actor: Account,
    student_id: UUID,
    title: str,
    document_type_code: str,
    upload: UploadFile,
) -> dict:
    """Téléverse un document puis le rattache à l'élève."""

    context = _get_student_document_context(
        db=db,
        student_id=student_id,
    )

    cleaned_title = title.strip()

    if not cleaned_title:
        raise ValueError("Le titre du document est obligatoire.")

    if len(cleaned_title) > 150:
        raise ValueError(
            "Le titre du document ne doit pas dépasser 150 caractères."
        )

    if document_type_code not in ALLOWED_DOCUMENT_TYPES:
        raise ValueError(
            "Le type de document sélectionné n'est pas autorisé."
        )

    mime_type = upload.content_type or ""

    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError(
            "Le fichier doit être un PDF, JPEG, PNG ou WebP."
        )

    content = upload.file.read(MAX_DOCUMENT_SIZE + 1)

    if not content:
        raise ValueError("Le fichier est vide.")

    if len(content) > MAX_DOCUMENT_SIZE:
        raise ValueError(
            "Le document ne doit pas dépasser 5 Mo."
        )

    original_filename = Path(
        upload.filename or "document"
    ).name

    suffix = ALLOWED_MIME_TYPES[mime_type]

    stored_filename = (
        f"document-{uuid4().hex}{suffix}"
    )

    document_directory = get_account_document_directory(
        context.registration_number
    )

    physical_path = (
        document_directory / stored_filename
    )

    physical_path.write_bytes(content)

    logical_path = (
        f"accounts/"
        f"{context.registration_number}/"
        f"documents/"
        f"{stored_filename}"
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
                WHERE document_type.code = :document_type_code
                  AND document_type.is_active = true
                RETURNING id
                """
            ),
            {
                "title": cleaned_title,
                "storage_path": logical_path,
                "original_filename": original_filename,
                "mime_type": mime_type,
                "size_bytes": len(content),
                "sha256": sha256(content).hexdigest(),
                "uploaded_by_account_id": actor.id,
                "document_type_code": document_type_code,
            },
        ).scalar_one_or_none()

        if document_id is None:
            raise ValueError(
                "Le type de document sélectionné est indisponible."
            )

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
                    'STUDENT',
                    :student_id
                )
                """
            ),
            {
                "document_id": document_id,
                "student_id": student_id,
            },
        )

        db.commit()

    except Exception:
        db.rollback()
        physical_path.unlink(missing_ok=True)
        raise

    documents = list_student_documents(
        db=db,
        student_id=student_id,
    )

    return next(
        document
        for document in documents
        if document["id"] == document_id
    )


def get_student_document_file(
    db: Session,
    student_id: UUID,
    document_id: UUID,
) -> tuple[Path, str, str]:
    """Retourne le fichier physique sans exposer son chemin au client."""

    _get_student_document_context(
        db=db,
        student_id=student_id,
    )

    document = db.execute(
        text(
            """
            SELECT
                document.storage_path,
                document.mime_type,
                document.original_filename

            FROM document_links AS link

            JOIN documents AS document
              ON document.id = link.document_id

            WHERE link.entity_type = 'STUDENT'
              AND link.entity_id = :student_id
              AND document.id = :document_id
              AND document.archived_at IS NULL
            """
        ),
        {
            "student_id": student_id,
            "document_id": document_id,
        },
    ).first()

    if document is None:
        raise LookupError("Document introuvable.")

    storage_root = ACCOUNT_STORAGE_ROOT.parent.resolve()

    physical_path = (
        storage_root / document.storage_path
    ).resolve()

    if (
        not physical_path.is_relative_to(storage_root)
        or not physical_path.is_file()
    ):
        raise LookupError(
            "Le fichier associé au document est introuvable."
        )

    return (
        physical_path,
        document.mime_type,
        document.original_filename,
    )


def archive_student_document(
    db: Session,
    student_id: UUID,
    document_id: UUID,
) -> None:
    """Archive un document sans supprimer son historique."""

    document = db.execute(
        text(
            """
            SELECT document.id

            FROM document_links AS link

            JOIN documents AS document
              ON document.id = link.document_id

            WHERE link.entity_type = 'STUDENT'
              AND link.entity_id = :student_id
              AND document.id = :document_id
              AND document.archived_at IS NULL
            """
        ),
        {
            "student_id": student_id,
            "document_id": document_id,
        },
    ).first()

    if document is None:
        raise LookupError("Document introuvable.")

    db.execute(
        text(
            """
            UPDATE documents
            SET archived_at = :archived_at
            WHERE id = :document_id
            """
        ),
        {
            "document_id": document_id,
            "archived_at": datetime.now(timezone.utc),
        },
    )

    db.commit()
