"""Contrat de modification des spécialités d'un élève."""

from uuid import UUID

from pydantic import BaseModel, field_validator


class StudentSpecialtiesUpdate(BaseModel):
    """Liste complète des spécialités choisies pour l'inscription actuelle."""

    subject_ids: list[UUID]

    @field_validator("subject_ids")
    @classmethod
    def validate_unique_subjects(
        cls,
        subject_ids: list[UUID],
    ) -> list[UUID]:
        """Empêche d'envoyer deux fois la même matière."""

        if len(subject_ids) != len(set(subject_ids)):
            raise ValueError(
                "Une même spécialité ne peut pas être sélectionnée plusieurs fois."
            )

        return subject_ids