"""Contrat de lecture d'un niveau scolaire."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ClassLevelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    name: str
    education_stage: str
    display_order: int
    is_active: bool