"""Erreur levée quand une période référencée n'existe pas."""


class ReportingPeriodNotFoundError(Exception):
    """Signale qu'aucune période ne correspond à l'identifiant donné."""

    def __init__(self, reporting_period_id) -> None:
        self.reporting_period_id = reporting_period_id
        super().__init__(f"Période introuvable : {reporting_period_id}")