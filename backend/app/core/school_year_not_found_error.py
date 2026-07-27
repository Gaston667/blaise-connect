"""Erreur levée quand une année scolaire référencée n'existe pas."""


class SchoolYearNotFoundError(Exception):
    """Signale qu'aucune année scolaire ne correspond à l'identifiant donné."""

    def __init__(self, school_year_id) -> None:
        self.school_year_id = school_year_id
        super().__init__(f"Année scolaire introuvable : {school_year_id}")