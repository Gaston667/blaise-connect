"""Contrats de sauvegarde des appréciations de période."""

from uuid import UUID

from pydantic import BaseModel, Field


class SubjectAppreciationSave(BaseModel):
    """Appréciation d'un enseignant sur sa matière pour un élève."""

    class_subject_id: UUID
    reporting_period_id: UUID
    comment: str = Field(min_length=1, max_length=2000)


class OverallAppreciationSave(BaseModel):
    """Appréciation générale du professeur principal."""

    reporting_period_id: UUID
    comment: str = Field(min_length=1, max_length=2000)
