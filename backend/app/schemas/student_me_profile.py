"""Contrat de profil résumé pour l'en-tête du tableau de bord élève."""

from pydantic import BaseModel


class StudentMeProfile(BaseModel):
    first_name: str
    last_name: str
    gender: str | None
    class_name: str | None
