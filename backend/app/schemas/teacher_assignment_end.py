"""Contrat de fin d'une affectation pédagogique."""

from datetime import date

from pydantic import BaseModel


class TeacherAssignmentEnd(BaseModel):
    """Renseigne la date de fin sans supprimer l'historique."""

    end_date: date
