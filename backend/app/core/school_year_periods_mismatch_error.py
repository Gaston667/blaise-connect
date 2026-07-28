"""Erreur métier liée au contenu du formulaire global d'une année."""


class SchoolYearPeriodsMismatchError(Exception):
    """Signale que le formulaire ne contient pas exactement les périodes attendues."""

