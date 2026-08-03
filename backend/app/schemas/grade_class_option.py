"""Option de classe pour l'écran des notes."""

from uuid import UUID

from pydantic import BaseModel


class GradeClassOption(BaseModel):
    """Classe accessible au compte connecté."""

    id: UUID
    name: str
    school_year_id: UUID
    school_year_name: str
