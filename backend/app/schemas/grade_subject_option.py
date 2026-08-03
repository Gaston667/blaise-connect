"""Option de matière pour l'écran des notes."""

from uuid import UUID

from pydantic import BaseModel


class GradeSubjectOption(BaseModel):
    """Matière disponible dans les classes accessibles."""

    id: UUID
    name: str
