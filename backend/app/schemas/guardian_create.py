"""Contrat de création d'un responsable légal, avec lien optionnel à un élève."""
from pydantic import BaseModel, Field


class GuardianCreate(BaseModel):
    """Données du responsable. Si `student_id` est fourni, le lien est créé dans la foulée."""
    first_name: str
    last_name: str
    phone: str
    email: str | None = None
    address: str | None = None
    occupation: str | None = None
    employer: str | None = None

    student_id: str | None = None
    relationship: str | None = Field(None, description="PERE, MERE, TUTEUR ou AUTRE")
    is_primary_contact: bool = False