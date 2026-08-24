"""Contrat de lecture d'un justificatif lié à une absence d'évaluation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GradeDocumentResponse(BaseModel):
    """Métadonnées d'un fichier sans exposer son chemin physique."""

    id: UUID
    title: str | None
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    uploaded_by_account_id: UUID
    created_at: datetime
