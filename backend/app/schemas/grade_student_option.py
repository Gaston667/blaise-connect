"""Option d'élève pour saisir une note."""

from uuid import UUID

from pydantic import BaseModel


class GradeStudentOption(BaseModel):
    """Élève et inscription compatibles avec l'évaluation choisie."""

    enrollment_id: UUID
    student_id: UUID
    registration_number: str
    name: str
