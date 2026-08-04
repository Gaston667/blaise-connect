"""Contrat de saisie collective des notes."""

from pydantic import BaseModel, Field, model_validator

from app.schemas.grade_sheet_entry import GradeSheetEntry


class GradeSheetSubmit(BaseModel):
    """Nouvelles lignes enregistrées atomiquement pour une évaluation."""

    entries: list[GradeSheetEntry] = Field(min_length=1)

    @model_validator(mode="after")
    def reject_duplicate_enrollments(self) -> "GradeSheetSubmit":
        """Refuse deux résultats pour la même inscription dans un même envoi."""

        enrollment_ids = [entry.student_enrollment_id for entry in self.entries]
        if len(enrollment_ids) != len(set(enrollment_ids)):
            raise ValueError("Un élève apparaît plusieurs fois dans la feuille transmise.")
        return self
