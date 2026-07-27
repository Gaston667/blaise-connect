"""Erreur levée lors d'une tentative de clôture d'une année déjà close."""


class SchoolYearAlreadyClosedError(Exception):
    """Signale qu'une année scolaire a déjà été clôturée."""

    def __init__(self, school_year_id) -> None:
        self.school_year_id = school_year_id
        super().__init__(
            f"L'année scolaire {school_year_id} est déjà clôturée."
        )