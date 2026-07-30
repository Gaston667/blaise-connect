"""Contrat de lecture d'un responsable depuis le dossier d'un élève."""

from app.schemas.guardian_response import GuardianResponse


class StudentGuardianResponse(GuardianResponse):
    """Expose le responsable et les propriétés de son lien avec l'élève."""

    relationship_type: str
    relationship_details: str | None
    relationship_label: str
    is_legal_guardian: bool
    is_primary_contact: bool
    is_emergency_contact: bool
